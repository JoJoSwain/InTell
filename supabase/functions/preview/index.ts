import { z } from "zod";
import { GrovePack, PreviewManifest, RegionPack } from "../_shared/from-shared/packs.ts";
import {
  getAuthHeader,
  serviceClient,
  userClient,
} from "../_shared/clients.ts";
import { json } from "../_shared/http.ts";
import { buildGrovePackObject } from "../_shared/buildGrovePack.ts";
import { assembleRegionPackObject } from "../_shared/buildRegionPack.ts";
import { PackBuildError } from "../_shared/packBuildError.ts";
import {
  loadGroveWorkingOverlay,
  loadReleaseOverlay,
} from "../_shared/packSource.ts";

const Body = z
  .object({
    releaseId: z.string().uuid().optional(),
    release_id: z.string().uuid().optional(),
    groveId: z.string().uuid().optional(),
    grove_id: z.string().uuid().optional(),
  })
  .refine((b) => !!(b.releaseId || b.release_id || b.groveId || b.grove_id), {
    message: "releaseId or groveId required",
  });

const PREVIEW_TTL_SEC = 3600;
const PREVIEW_ROLES = new Set(["writer", "sound", "editor", "admin"]);
const PREVIEW_STATUSES = new Set(["draft", "scheduled", "failed"]);

type AssetMeta = { sha: string; ext: string; kind: string; isPublic: boolean };

async function signAssets(
  svc: ReturnType<typeof serviceClient>,
  assetMeta: Map<string, AssetMeta>,
  expiresAt: string,
): Promise<{ sha: string; ext: string; url: string; expiresAt: string }[]> {
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
        // Missing staging object — still list with empty url; Simulator warns.
        assets.push({
          sha: meta.sha,
          ext: meta.ext,
          url: "",
          expiresAt,
        });
        continue;
      }
      assets.push({
        sha: meta.sha,
        ext: meta.ext,
        url: signed.signedUrl,
        expiresAt,
      });
    }
  }
  return assets;
}

async function resolveAssetPublicFlags(
  svc: ReturnType<typeof serviceClient>,
  assetMeta: Map<string, AssetMeta>,
  assetShas: string[],
): Promise<void> {
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
}

function staffPreviewBuildError(err: PackBuildError): string {
  const who = err.entityId ? `${err.entity} ${err.entityId.slice(0, 8)}` : err.entity;
  return `${err.code}: ${err.message} (fix this ${who} first)`;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const auth = getAuthHeader(req);
  if (!auth) return json({ error: "unauthorized" }, 401);

  const caller = userClient(auth);
  const { data: userData, error: userErr } = await caller.auth.getUser();
  if (userErr || !userData.user) {
    return json({ error: "staff required" }, 401);
  }
  const { data: staff, error: staffErr } = await caller
    .from("staff")
    .select("role, active")
    .eq("user_id", userData.user.id)
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

  const groveId = body.groveId ?? body.grove_id;
  const releaseId = body.releaseId ?? body.release_id;
  const svc = serviceClient();
  const generatedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + PREVIEW_TTL_SEC * 1000).toISOString();

  // —— Grove-scoped Simulator pack (working overlay + region) ——
  if (groveId) {
    const overlay = await loadGroveWorkingOverlay(svc, groveId);
    let assembled: Awaited<ReturnType<typeof buildGrovePackObject>>;
    try {
      assembled = await buildGrovePackObject(svc, groveId, { overlay });
    } catch (err) {
      if (err instanceof PackBuildError) {
        return json({ error: staffPreviewBuildError(err) }, 422);
      }
      const message = err instanceof Error ? err.message : String(err);
      return json({ error: message }, 500);
    }

    let grovePack;
    try {
      grovePack = GrovePack.parse(assembled.pack);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return json({ error: `GrovePack schema: ${message}` }, 500);
    }

    let regionPack = null;
    try {
      const regionAssembled = await assembleRegionPackObject(
        svc,
        grovePack.regionId,
        { copyLandcover: false },
      );
      regionPack = RegionPack.parse(regionAssembled.pack);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return json({ error: `RegionPack: ${message}` }, 500);
    }

    const assetMeta = new Map<string, AssetMeta>();
    for (const a of grovePack.assets) {
      assetMeta.set(a.sha, {
        sha: a.sha,
        ext: a.ext,
        kind: a.kind,
        isPublic: false,
      });
    }
    for (const a of regionPack.assets) {
      if (!assetMeta.has(a.sha)) {
        assetMeta.set(a.sha, {
          sha: a.sha,
          ext: a.ext,
          kind: a.kind,
          isPublic: false,
        });
      }
    }
    await resolveAssetPublicFlags(svc, assetMeta, [
      ...assembled.assetShas,
      ...regionPack.assets.map((a) => a.sha),
    ]);
    const assets = await signAssets(svc, assetMeta, expiresAt);

    return json({
      schema: "simulate/1",
      groveId,
      regionId: grovePack.regionId,
      generatedAt,
      expiresAt,
      grove: grovePack,
      region: regionPack,
      assets,
    });
  }

  // —— Release-scoped preview (existing) ——
  const { data: release, error: relErr } = await svc
    .from("releases")
    .select("id, status")
    .eq("id", releaseId!)
    .maybeSingle();
  if (relErr || !release) return json({ error: "release not found" }, 404);
  if (!PREVIEW_STATUSES.has(String(release.status))) {
    return json({
      error: "release not previewable",
      status: release.status,
    }, 409);
  }

  const overlay = await loadReleaseOverlay(svc, releaseId!);
  const groveIds = [...overlay.groveIds].sort();
  if (groveIds.length === 0) {
    const empty = PreviewManifest.parse({
      schema: "preview/1",
      releaseId: releaseId!,
      generatedAt,
      expiresAt,
      groves: [],
      assets: [],
    });
    return json(empty);
  }

  const packs: unknown[] = [];
  const assetMeta = new Map<string, AssetMeta>();

  for (const gid of groveIds) {
    let assembled: Awaited<ReturnType<typeof buildGrovePackObject>>;
    try {
      assembled = await buildGrovePackObject(svc, gid, { overlay });
    } catch (err) {
      if (err instanceof PackBuildError) {
        return json({ error: staffPreviewBuildError(err) }, 422);
      }
      const message = err instanceof Error ? err.message : String(err);
      return json({ error: message }, 500);
    }
    const { pack, assetShas } = assembled;
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
    await resolveAssetPublicFlags(svc, assetMeta, assetShas);
    packs.push(parsed);
  }

  const assets = await signAssets(svc, assetMeta, expiresAt);
  const manifest = PreviewManifest.parse({
    schema: "preview/1",
    releaseId: releaseId!,
    generatedAt,
    expiresAt,
    groves: packs,
    assets,
  });

  const dumped = JSON.stringify(manifest);
  if (dumped.includes("marker_code") || /\"markerCode\"\s*:\s*\"[A-Z0-9]{8}\"/i.test(dumped)) {
    return json({ error: "preview must not include marker codes" }, 500);
  }

  return json(manifest);
});
