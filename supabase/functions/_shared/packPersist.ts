import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { canonicalJson, contentSha256 } from "./from-shared/canonicalJson.ts";
import { GrovePack, RegionPack } from "./from-shared/packs.ts";
import { sha256Hex } from "./digest.ts";
import {
  copyStagingImageToPublic,
  copyStagingToPublic,
  deletePublicPrefixExcept,
  uploadManifest,
} from "./storage.ts";

type Scope = "grove" | "region";

export type PackPersistInput = {
  scope: Scope;
  scopeId: string;
  body: Record<string, unknown>;
  assetShas: string[];
  bytesTotal: number;
  reason?: string;
  /** When set, build is live=false until fn_release_go_live. */
  releaseId?: string | null;
  /** Grove opening root coords (M3e); omitted for region / missing opening. */
  opening?: { lat: number; lng: number } | null;
  /** Grove pack bbox [west, south, east, north] from the derived shape. */
  bbox?: [number, number, number, number] | null;
};

export type PackPersistResult =
  | { noop: true; contentSha256: string; releaseId?: string | null }
  | {
      noop: false;
      version: number;
      manifestPath: string;
      manifestSha256: string;
      contentSha256: string;
      releaseId?: string | null;
    };

async function copyPackAssets(
  client: SupabaseClient,
  assetShas: string[],
): Promise<void> {
  for (const sha of assetShas) {
    const { data: audio } = await client
      .from("audio_assets")
      .select("ext")
      .eq("sha256", sha)
      .maybeSingle();
    if (audio?.ext) {
      try {
        await copyStagingToPublic(client, sha, audio.ext as string);
      } catch (e) {
        console.error(`copy audio ${sha}: ${e}`);
      }
      continue;
    }
    const { data: image } = await client
      .from("image_assets")
      .select("ext")
      .eq("sha256", sha)
      .maybeSingle();
    if (image?.ext) {
      try {
        await copyStagingImageToPublic(client, sha, image.ext as string);
      } catch (e) {
        console.error(`copy image ${sha}: ${e}`);
      }
    }
  }
}

export async function persistPackIfChanged(
  client: SupabaseClient,
  input: PackPersistInput,
): Promise<PackPersistResult> {
  const forHash = { ...input.body };
  delete forHash.packVersion;
  delete forHash.builtAt;
  const contentSha = await contentSha256(forHash, sha256Hex);

  const table = input.scope === "grove" ? "groves" : "regions";
  const releaseId = input.releaseId ?? null;
  // Builds tagged with a release start non-live; unpublish rebuilds are live immediately (R4).
  const live = releaseId == null;

  const { data: latest } = await client
    .from("pack_builds")
    .select("version, content_sha256, manifest_path")
    .eq("scope", input.scope)
    .eq("scope_id", input.scopeId)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latest?.content_sha256 === contentSha) {
    // Still copy staging → public: first build may have run before seed media
    // upload finished; a later no-op must heal missing public objects.
    await copyPackAssets(client, input.assetShas);
    // No-op is still success for go-live (R4): run-jobs marks the job done, then
    // fn_release_go_live runs when no rebuild_pack jobs remain queued/running/failed.
    return { noop: true, contentSha256: contentSha, releaseId };
  }

  const { data: place, error: placeErr } = await client
    .from(table)
    .select("pack_version")
    .eq("id", input.scopeId)
    .single();
  if (placeErr || !place) throw new Error(`${table} ${input.scopeId} not found`);

  const newVersion = (place.pack_version as number) + 1;
  const full = {
    ...input.body,
    packVersion: newVersion,
    builtAt: input.body.builtAt as string,
  };

  const schema = input.scope === "grove" ? GrovePack : RegionPack;
  const parsed = schema.safeParse(full);
  if (!parsed.success) {
    throw new Error(`pack zod: ${parsed.error.message}`);
  }

  const jsonUtf8 = canonicalJson(full);
  const { path, manifestSha256 } = await uploadManifest(
    client,
    input.scope,
    input.scopeId,
    newVersion,
    jsonUtf8,
  );

  const { error: bumpErr } = await client
    .from(table)
    .update({ pack_version: newVersion })
    .eq("id", input.scopeId);
  if (bumpErr) throw new Error(`bump ${table}: ${bumpErr.message}`);

  const opening =
    input.scope === "grove" && input.opening
      ? {
          opening_lat: input.opening.lat,
          opening_lng: input.opening.lng,
        }
      : { opening_lat: null, opening_lng: null };

  const bbox =
    input.scope === "grove" && input.bbox
      ? { bbox: input.bbox }
      : { bbox: null };

  const { error: insErr } = await client.from("pack_builds").insert({
    scope: input.scope,
    scope_id: input.scopeId,
    version: newVersion,
    manifest_path: path,
    manifest_sha256: manifestSha256,
    content_sha256: contentSha,
    asset_hashes: input.assetShas,
    bytes_total: input.bytesTotal,
    reason: input.reason ?? null,
    release_id: releaseId,
    live,
    ...opening,
    ...bbox,
  });
  if (insErr) throw new Error(`pack_builds insert: ${insErr.message}`);

  // Live builds supersede prior live rows for this scope so the keep-set below
  // can drop their storage objects. Release-tagged builds stay non-live until
  // go-live; those leave the current live row alone until a later live rebuild.
  if (live) {
    const { error: demoteErr } = await client
      .from("pack_builds")
      .update({ live: false })
      .eq("scope", input.scope)
      .eq("scope_id", input.scopeId)
      .eq("live", true)
      .neq("version", newVersion);
    if (demoteErr) {
      throw new Error(`demote prior live packs: ${demoteErr.message}`);
    }
  }

  // Keep every still-live manifest for this scope, plus the build we just wrote
  // (which may be non-live until go-live). Deletes only other prefix files.
  const { data: liveBuilds, error: liveErr } = await client
    .from("pack_builds")
    .select("manifest_path")
    .eq("scope", input.scope)
    .eq("scope_id", input.scopeId)
    .eq("live", true);
  if (liveErr) throw new Error(`list live manifests: ${liveErr.message}`);

  const keep = new Set<string>([path]);
  for (const row of liveBuilds ?? []) {
    if (typeof row.manifest_path === "string" && row.manifest_path.length > 0) {
      keep.add(row.manifest_path);
    }
  }

  const prefix = `packs/${input.scope}/${input.scopeId}`;
  await deletePublicPrefixExcept(client, prefix, keep);

  await copyPackAssets(client, input.assetShas);

  await client.rpc("fn_enqueue_purge_reconcile", {
    p_reason: "rebuild",
    p_detail: { scope: input.scope, scope_id: input.scopeId, version: newVersion },
  });

  return {
    noop: false,
    version: newVersion,
    manifestPath: path,
    manifestSha256,
    contentSha256: contentSha,
    releaseId,
  };
}
