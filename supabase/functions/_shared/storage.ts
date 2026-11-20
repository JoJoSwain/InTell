import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export const CACHE_AUDIO = "public, max-age=3600";
export const CACHE_MANIFEST = "public, max-age=60";

export async function copyStagingToPublic(
  client: SupabaseClient,
  sha: string,
  ext: string,
): Promise<void> {
  const fromPath = `${sha}.${ext}`;
  const toPath = `a/${sha}.${ext}`;
  const { data: blob, error: dl } = await client.storage
    .from("staging-audio")
    .download(fromPath);
  if (dl || !blob) {
    throw new Error(`staging download failed for ${fromPath}: ${dl?.message ?? "missing"}`);
  }
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const { error: up } = await client.storage.from("public-media").upload(toPath, bytes, {
    contentType: mimeForExt(ext),
    upsert: true,
    cacheControl: CACHE_AUDIO,
  });
  if (up) throw new Error(`public upload failed for ${toPath}: ${up.message}`);
}

export async function uploadManifest(
  client: SupabaseClient,
  scope: "grove" | "region",
  scopeId: string,
  version: number,
  jsonUtf8: string,
): Promise<{ path: string; manifestSha256: string; bytes: number }> {
  const path = `packs/${scope}/${scopeId}/${version}.json`;
  const bytes = new TextEncoder().encode(jsonUtf8);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  const manifestSha256 = [...new Uint8Array(hash)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const { error } = await client.storage.from("public-media").upload(path, bytes, {
    contentType: "application/json",
    upsert: true,
    cacheControl: CACHE_MANIFEST,
  });
  if (error) throw new Error(`manifest upload ${path}: ${error.message}`);
  return { path, manifestSha256, bytes: bytes.byteLength };
}

export async function deletePublicPrefixExcept(
  client: SupabaseClient,
  prefix: string,
  keepPaths: Set<string>,
): Promise<string[]> {
  const deleted: string[] = [];
  const { data: list, error } = await client.storage.from("public-media").list(prefix, {
    limit: 1000,
  });
  if (error) throw new Error(`list ${prefix}: ${error.message}`);
  for (const item of list ?? []) {
    if (!item.name) continue;
    const full = `${prefix}/${item.name}`;
    if (keepPaths.has(full)) continue;
    const { error: rm } = await client.storage.from("public-media").remove([full]);
    if (rm) throw new Error(`remove ${full}: ${rm.message}`);
    deleted.push(full);
  }
  return deleted;
}

export async function listPublicAudioShas(client: SupabaseClient): Promise<string[]> {
  const { data, error } = await client.storage.from("public-media").list("a", { limit: 10000 });
  if (error) throw new Error(`list a/: ${error.message}`);
  const shas: string[] = [];
  for (const obj of data ?? []) {
    const m = /^([a-f0-9]{64})\./i.exec(obj.name ?? "");
    if (m) shas.push(m[1].toLowerCase());
  }
  return shas;
}

function mimeForExt(ext: string): string {
  switch (ext.toLowerCase()) {
    case "wav":
      return "audio/wav";
    case "mp3":
      return "audio/mpeg";
    case "m4a":
      return "audio/mp4";
    case "ogg":
      return "audio/ogg";
    default:
      return "application/octet-stream";
  }
}