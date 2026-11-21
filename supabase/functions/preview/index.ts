import { z } from "zod";
import { GrovePack, PreviewManifest } from "../_shared/from-shared/packs.ts";
import {
  getAuthHeader,
  serviceClient,
  userClient,
} from "../_shared/clients.ts";
import { json } from "../_shared/http.ts";
import { buildGrovePackObject } from "../_shared/buildGrovePack.ts";
import { loadReleaseOverlay } from "../_shared/packSource.ts";

const Body = z.object({
  releaseId: z.string().uuid().optional(),
  release_id: z.string().uuid().optional(),
}).refine((b) => !!(b.releaseId || b.release_id), {
  message: "releaseId required",
});

const PREVIEW_TTL_SEC = 3600;
const PREVIEW_ROLES = new Set(["writer", "sound", "editor", "admin"]);
const PREVIEW_STATUSES = new Set(["draft", "scheduled", "failed"]);

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const auth = getAuthHeader(req);
  if (!auth) return json({ error: "unauthorized" }, 401);

  const caller = userClient(auth);
  const { data: staff, error: staffErr } = await caller
    .from("staff")
    .select("role, active")
    .maybeSingle();
  if (staffErr || !staff?.active) {
    return json({ error: "staff required" }, 401);
  }
  if (!PREVIEW_ROLES.has(String(staff.role))) {
    return json({ error: "forbidden" }, 403);
  }

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return json({ error: "invalid body" }, 400);
  }
  const releaseId = (body.releaseId ?? body.release_id)!;

  const svc = serviceClient();
  const { data: release, error: relErr } = await svc
    .from("releases")
    .select("id, status")
    .eq("id", releaseId)
    .maybeSingle();
  if (relErr || !release) return json({ error: "release not found" }, 404);
  if (!PREVIEW_STATUSES.has(String(release.status))) {
    return json({
      error: "release not previewable",
      status: release.status,
    }, 409);
  }

  const overlay = await loadReleaseOverlay(svc, releaseId);
  const groveIds = [...overlay.groveIds].sort();
  if (groveIds.length === 0) {
    // Empty release: still valid preview with no groves
    const generatedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + PREVIEW_TTL_SEC * 1000).toISOString();
    const empty = PreviewManifest.parse({
      schema: "preview/1",
      releaseId,
      generatedAt,
      expiresAt,
      groves: [],
      assets: [],
    });
    return json(empty);
  }

  const packs: unknown[] = [];
  const assetMeta = new Map<string, { sha: string; ext: string; kind: string; isPublic: boolean }>();

  for (const groveId of groveIds) {
    const { pack, assetShas } = await buildGrovePackObject(svc, groveId, {
      overlay,
    });
    const parsed = GrovePack.parse(pack);
    const asJson = JSON.stringify(parsed);
    if (
      asJson.includes("marker_code") ||
      asJson.includes("indigeny_earth") ||
      asJson.includes("indigeny_world") ||
      asJson.includes("indigeny_body")
    ) {
      return json({ error: "preview leaked forbidden fields" }, 500);
    }
    for (const a of parsed.assets) {
      if (!assetMeta.has(a.sha)) {
        assetMeta.set(a.sha, {
          sha: a.sha,
          ext: a.ext,
          kind: a.kind,
          isPublic: false,
        });
      }
    }
    // Resolve is_public from DB
    for (const sha of assetShas) {
      const meta = assetMeta.get(sha.toLowerCase()) ?? assetMeta.get(sha);
      if (!meta) continue;
      if (meta.kind === "image") {
        const { data: img } = await svc
          .from("image_assets")
          .select("is_public, ext, sha256")
          .eq("sha256", meta.sha)
          .maybeSingle();
        if (img) {
          meta.isPublic = !!img.is_public;
          meta.ext = String(img.ext);
        }
      } else {
        const { data: audio } = await svc
          .from("audio_assets")
          .select("is_public, ext, sha256")
          .eq("sha256", meta.sha)
          .maybeSingle();
        if (audio) {
          meta.isPublic = !!audio.is_public;
          meta.ext = String(audio.ext);
        }
      }
    }
    packs.push(parsed);
  }

  const generatedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + PREVIEW_TTL_SEC * 1000).toISOString();
  const baseUrl = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");

  const assets: {
    sha: string;
    ext: string;
    url: string;
    expiresAt: string;
  }[] = [];

  for (const meta of [...assetMeta.values()].sort((a, b) =>
    a.sha.localeCompare(b.sha)
  )) {
    if (meta.isPublic) {
      const prefix = meta.kind === "image" ? "i" : "a";
      assets.push({
        sha: meta.sha,
        ext: meta.ext,
        url: `${baseUrl}/storage/v1/object/public/public-media/${prefix}/${meta.sha}.${meta.ext}`,
        expiresAt,
      });
    } else {
      const bucket = meta.kind === "image" ? "staging-images" : "staging-audio";
      const path = `${meta.sha}.${meta.ext}`;
      const { data: signed, error: signErr } = await svc.storage
        .from(bucket)
        .createSignedUrl(path, PREVIEW_TTL_SEC);
      if (signErr || !signed?.signedUrl) {
        return json({
          error: `signed url failed for ${path}: ${signErr?.message}`,
        }, 500);
      }
      assets.push({
        sha: meta.sha,
        ext: meta.ext,
        url: signed.signedUrl,
        expiresAt,
      });
    }
  }

  const manifest = PreviewManifest.parse({
    schema: "preview/1",
    releaseId,
    generatedAt,
    expiresAt,
    groves: packs,
    assets,
  });

  // Hard check: no plaintext marker codes in the payload
  const dumped = JSON.stringify(manifest);
  if (dumped.includes("marker_code") || /\"markerCode\"\s*:\s*\"[A-Z0-9]{8}\"/i.test(dumped)) {
    return json({ error: "preview must not include marker codes" }, 500);
  }

  return json(manifest);
});
