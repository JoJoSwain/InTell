import { serviceClient } from "../_shared/clients.ts";
import { json, requireServiceRole } from "../_shared/http.ts";
import { functionsBaseUrl } from "../_shared/supabase.ts";

const MAX_ATTEMPTS = 5;

type JobRow = {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  status: string;
  attempts: number;
};

async function invoke(path: string, body: Record<string, unknown>): Promise<void> {
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const res = await fetch(`${functionsBaseUrl()}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${path} ${res.status}: ${text}`);
  }
}

Deno.serve(async (req) => {
  const denied = requireServiceRole(req);
  if (denied) return denied;
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const client = serviceClient();
  const now = new Date().toISOString();
  const { data: queued, error } = await client
    .from("jobs")
    .select("*")
    .eq("status", "queued")
    .lte("run_after", now)
    .order("created_at", { ascending: true })
    .limit(50);
  if (error) return json({ error: error.message }, 500);

  const jobs = (queued ?? []) as JobRow[];
  const rebuilds = jobs.filter((j) => j.kind === "rebuild_pack");
  const purges = jobs.filter((j) => j.kind === "purge_asset");
  const ordered = [...rebuilds, ...purges];

  const processed: unknown[] = [];
  for (const job of ordered) {
    const { data: claimed, error: claimErr } = await client
      .from("jobs")
      .update({
        status: "running",
        attempts: job.attempts + 1,
      })
      .eq("id", job.id)
      .eq("status", "queued")
      .select()
      .maybeSingle();
    if (claimErr || !claimed) continue;

    try {
      if (job.kind === "rebuild_pack") {
        const payload = job.payload ?? {};
        await invoke("build-pack", {
          grove_id: payload.grove_id,
          region_id: payload.region_id,
          reason: `job:${job.id}`,
        });
      } else if (job.kind === "purge_asset") {
        await invoke("purge-assets", {});
      }
      await client
        .from("jobs")
        .update({ status: "done", last_error: null })
        .eq("id", job.id);
      processed.push({ id: job.id, ok: true });
    } catch (e) {
      const attempts = job.attempts + 1;
      const failed = attempts >= MAX_ATTEMPTS;
      const backoffMin = Math.min(60, 2 ** attempts);
      const runAfter = new Date(Date.now() + backoffMin * 60_000).toISOString();
      await client
        .from("jobs")
        .update({
          status: failed ? "failed" : "queued",
          last_error: String(e).slice(0, 2000),
          run_after: failed ? now : runAfter,
        })
        .eq("id", job.id);
      processed.push({ id: job.id, ok: false, error: String(e) });
    }
  }

  return json({ ok: true, processed });
});