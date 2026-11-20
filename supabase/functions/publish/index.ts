import { z } from "zod";
import { MusicCondition } from "../_shared/from-shared/music.ts";
import { serviceClient, userClient, getAuthHeader } from "../_shared/clients.ts";
import { json } from "../_shared/http.ts";
import { copyStagingToPublic } from "../_shared/storage.ts";

const Body = z.object({
  entity: z.enum(["revision", "music_cue"]),
  ids: z.array(z.string().uuid()).min(1),
});

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const auth = getAuthHeader(req);
  if (!auth) return json({ error: "unauthorized" }, 401);

  const caller = userClient(auth);
  const { data: allowed, error: roleErr } = await caller.rpc("has_role", {
    roles: ["editor", "admin"],
  });
  if (roleErr || !allowed) return json({ error: "editor required" }, 403);

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return json({ error: "invalid body" }, 400);
  }

  if (body.entity === "music_cue") {
    const svc = serviceClient();
    for (const id of body.ids) {
      const { data: cue, error } = await svc
        .from("music_cues")
        .select("conditions")
        .eq("id", id)
        .single();
      if (error) return json({ error: error.message }, 400);
      const cond = MusicCondition.safeParse(cue?.conditions ?? {});
      if (!cond.success) {
        return json({
          ok: false,
          failures: [{
            code: "CONDITION_SCHEMA",
            severity: "error",
            message: cond.error.message,
            entity_id: id,
          }],
        });
      }
      const { data: stems } = await svc
        .from("music_cue_stems")
        .select("state_gains")
        .eq("cue_id", id);
      for (const stem of stems ?? []) {
        const rules = Array.isArray(stem.state_gains) ? stem.state_gains : [];
        for (const rule of rules) {
          const when = (rule as { when?: unknown }).when ?? {};
          const parsed = MusicCondition.safeParse(when);
          if (!parsed.success) {
            return json({
              ok: false,
              failures: [{
                code: "CONDITION_SCHEMA",
                severity: "error",
                message: parsed.error.message,
                entity_id: id,
              }],
            });
          }
        }
      }
    }
  }

  const { data: checked, error: checkErr } = await caller.rpc("fn_publish_check", {
    p_entity: body.entity,
    p_ids: body.ids,
  });
  if (checkErr) return json({ error: checkErr.message }, 400);
  if (!checked?.ok) return json(checked, 400);

  const shas = (checked.asset_shas_to_publish as string[] | undefined) ?? [];
  const svc = serviceClient();
  for (const sha of shas) {
    const { data: asset, error: aErr } = await svc
      .from("audio_assets")
      .select("ext")
      .eq("sha256", sha)
      .single();
    if (aErr || !asset) {
      return json({ error: `asset missing for sha ${sha}` }, 400);
    }
    try {
      await copyStagingToPublic(svc, sha, asset.ext as string);
    } catch (e) {
      return json({ error: String(e), partial: true }, 500);
    }
  }

  // Storage copy used service client; commit also via service after staff gate (review #6)
  const { data: committed, error: commitErr } = await svc.rpc("fn_publish_commit", {
    p_entity: body.entity,
    p_ids: body.ids,
  });
  if (commitErr) return json({ error: commitErr.message }, 500);
  return json(committed ?? { ok: true, committed: true });
});