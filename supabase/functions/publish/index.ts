import { z } from "zod";
import { MusicCondition } from "../_shared/from-shared/music.ts";
import { serviceClient, userClient, getAuthHeader } from "../_shared/clients.ts";
import {
  json,
  matchesSecretKey,
  serviceCredentialFrom,
  timingSafeEqual,
} from "../_shared/http.ts";
import { publishableKey } from "../_shared/keys.ts";
import { copyStagingImageToPublic, copyStagingToPublic } from "../_shared/storage.ts";

const Body = z.object({
  releaseId: z.string().uuid().optional(),
  release_id: z.string().uuid().optional(),
}).refine((b) => !!(b.releaseId || b.release_id), {
  message: "releaseId required",
});

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  // Service path (run-jobs) or staff editor JWT — check credentials first.
  const credential = serviceCredentialFrom(req);
  const pub = publishableKey();
  const isService =
    credential.length > 0 &&
    !(pub && timingSafeEqual(credential, pub)) &&
    matchesSecretKey(credential);

  if (!isService) {
    const auth = getAuthHeader(req);
    if (!auth || !auth.toLowerCase().startsWith("bearer ")) {
      return json({ error: "unauthorized" }, 401);
    }
    const jwt = auth.slice("Bearer ".length).trim();
    if (!jwt) return json({ error: "unauthorized" }, 401);

    const caller = userClient(auth);
    const { data: userData, error: userErr } = await caller.auth.getUser(jwt);
    if (userErr || !userData.user) {
      return json({ error: "unauthorized" }, 401);
    }
    const { data: allowed, error: roleErr } = await caller.rpc(
      "fn_is_editor_or_admin",
    );
    if (roleErr || !allowed) {
      return json({ error: "editor required", detail: roleErr?.message }, 403);
    }
  }

  const svc = serviceClient();

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return json({ error: "invalid body" }, 400);
  }
  const releaseId = (body.releaseId ?? body.release_id)!;

  // CONDITION_SCHEMA for music cues in the release (zod in edge; SQL can't run zod)
  const { data: cueItems } = await svc
    .from("release_items")
    .select("entity_id")
    .eq("release_id", releaseId)
    .eq("entity", "music_cue");
  for (const item of cueItems ?? []) {
    const id = item.entity_id as string;
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
          entity: "music_cue",
          entity_id: id,
        }],
      }, 400);
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
              entity: "music_cue",
              entity_id: id,
            }],
          }, 400);
        }
      }
    }
  }

  const { data: checked, error: checkErr } = await svc.rpc("fn_publish_check", {
    p_release_id: releaseId,
  });
  if (checkErr) return json({ error: checkErr.message }, 400);
  if (!checked?.ok) {
    // Scheduled go-live check failure → mark failed
    await svc.from("releases").update({
      status: "failed",
      last_check: checked,
    }).eq("id", releaseId);
    return json(checked, 400);
  }

  const audioShas = (checked.asset_shas_to_publish as string[] | undefined) ?? [];
  const imageShas = (checked.image_shas_to_publish as string[] | undefined) ?? [];

  for (const sha of audioShas) {
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

  for (const sha of imageShas) {
    const { data: img, error: iErr } = await svc
      .from("image_assets")
      .select("ext")
      .eq("sha256", sha)
      .single();
    if (iErr || !img) {
      return json({ error: `image missing for sha ${sha}` }, 400);
    }
    try {
      await copyStagingImageToPublic(svc, sha, img.ext as string);
    } catch (e) {
      return json({ error: String(e), partial: true }, 500);
    }
  }

  const { data: committed, error: commitErr } = await svc.rpc("fn_publish_commit", {
    p_release_id: releaseId,
  });
  if (commitErr) return json({ error: commitErr.message }, 500);
  return json(committed ?? { ok: true, committed: true });
});
