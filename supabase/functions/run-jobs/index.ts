import { serviceClient } from "../_shared/clients.ts";
import { json, requireServiceCaller } from "../_shared/http.ts";
import { serviceKey } from "../_shared/keys.ts";
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
  const key = serviceKey();
  const res = await fetch(`${functionsBaseUrl()}/${path}`, {
    method: "POST",
    headers: {
      apikey: key,
      // Transition: receivers still accept Bearer while callers move to apikey.
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
  const denied = requireServiceCaller(req);
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
  const publishReleases = jobs.filter((j) => j.kind === "publish_release");
  const rebuilds = jobs.filter((j) => j.kind === "rebuild_pack");
  const purges = jobs.filter((j) => j.kind === "purge_asset");
  // Order: publish_release → rebuild_pack → purge_asset (DATA_MODEL §10)
  const ordered = [...publishReleases, ...rebuilds, ...purges];

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
      if (job.kind === "publish_release") {
        const releaseId = String(
          job.payload.release_id ?? job.payload.releaseId ?? "",
        );
        if (!releaseId) throw new Error("publish_release missing release_id");
        await invoke("publish", { release_id: releaseId });
      } else if (job.kind === "rebuild_pack") {
        const payload = job.payload ?? {};
        const releaseId = payload.release_id ?? payload.releaseId;
        await invoke("build-pack", {
          grove_id: payload.grove_id,
          region_id: payload.region_id,
          release_id: releaseId,
          reason: `job:${job.id}`,
        });
        // Mark done before go-live: fn_release_go_live treats status
        // queued|running|failed as blocking, so this job must not still be running.
        await client
          .from("jobs")
          .update({ status: "done", last_error: null })
          .eq("id", job.id);
        if (releaseId) {
          const { error: liveErr } = await client.rpc("fn_release_go_live", {
            p_release_id: String(releaseId),
          });
          if (liveErr) throw new Error(`fn_release_go_live: ${liveErr.message}`);
        }
        processed.push({ id: job.id, ok: true });
        continue;
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

      // R4: exhausted rebuild for a release → mark release failed
      if (failed && job.kind === "rebuild_pack") {
        const releaseId = job.payload?.release_id ?? job.payload?.releaseId;
        if (releaseId) {
          await client.from("releases").update({
            status: "failed",
            last_check: {
              ok: false,
              failures: [{
                code: "PACK_BUILD_FAILED",
                severity: "error",
                message: String(e).slice(0, 500),
                entity: job.payload.grove_id ? "grove" : "region",
                entity_id: job.payload.grove_id ?? job.payload.region_id ?? null,
              }],
            },
          }).eq("id", releaseId);
        }
      }

      processed.push({ id: job.id, ok: false, error: String(e) });
    }
  }

  return json({ ok: true, processed });
});
