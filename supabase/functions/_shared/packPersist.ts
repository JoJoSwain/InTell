import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { canonicalJson, contentSha256 } from "./from-shared/canonicalJson.ts";
import { GrovePack, RegionPack } from "./from-shared/packs.ts";
import { sha256Hex } from "./digest.ts";
import { deletePublicPrefixExcept, uploadManifest } from "./storage.ts";

type Scope = "grove" | "region";

export type PackPersistInput = {
  scope: Scope;
  scopeId: string;
  body: Record<string, unknown>;
  assetShas: string[];
  bytesTotal: number;
  reason?: string;
};

export type PackPersistResult =
  | { noop: true; contentSha256: string }
  | {
      noop: false;
      version: number;
      manifestPath: string;
      manifestSha256: string;
      contentSha256: string;
    };

export async function persistPackIfChanged(
  client: SupabaseClient,
  input: PackPersistInput,
): Promise<PackPersistResult> {
  const forHash = { ...input.body };
  delete forHash.packVersion;
  delete forHash.builtAt;
  const contentSha = await contentSha256(forHash, sha256Hex);

  const versionCol = input.scope === "grove" ? "pack_version" : "pack_version";
  const table = input.scope === "grove" ? "groves" : "regions";

  const { data: latest } = await client
    .from("pack_builds")
    .select("version, content_sha256, manifest_path")
    .eq("scope", input.scope)
    .eq("scope_id", input.scopeId)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latest?.content_sha256 === contentSha) {
    return { noop: true, contentSha256: contentSha };
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
  const { path, manifestSha256, bytes } = await uploadManifest(
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
  });
  if (insErr) throw new Error(`pack_builds insert: ${insErr.message}`);

  const prefix = `packs/${input.scope}/${input.scopeId}`;
  await deletePublicPrefixExcept(client, prefix, new Set([path]));

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
  };
}