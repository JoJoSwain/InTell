import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { listAllNames } from "./storage.ts";

/** R1: public-media/a/ matches union of latest manifest asset shas. */
export async function reconcilePublicAudio(client: SupabaseClient): Promise<{
  keepCount: number;
  deleted: number;
  markedPrivate: number;
}> {
  const { data: index, error: idxErr } = await client.rpc("get_pack_index");
  if (idxErr) throw new Error(idxErr.message);
  const listedScopes = new Set(
    ((index as { scope: string; id: string }[]) ?? []).map(
      (e) => `${e.scope}:${e.id}`,
    ),
  );

  const { data: builds, error } = await client
    .from("pack_builds")
    .select("scope, scope_id, id, asset_hashes")
    .order("id", { ascending: false });
  if (error) throw new Error(error.message);

  const seen = new Set<string>();
  const keep = new Set<string>();
  for (const row of builds ?? []) {
    const key = `${row.scope}:${row.scope_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (!listedScopes.has(key)) continue;
    for (const sha of (row.asset_hashes as string[]) ?? []) {
      keep.add(sha.toLowerCase());
    }
  }

  let deleted = 0;
  const names = await listAllNames(client, "a");
  for (const name of names) {
    const m = /^([a-f0-9]{64})\./i.exec(name);
    if (!m) continue;
    const sha = m[1]!.toLowerCase();
    if (keep.has(sha)) continue;
    const path = `a/${name}`;
    const { error: rm } = await client.storage.from("public-media").remove([path]);
    if (rm) throw new Error(rm.message);
    deleted += 1;
  }

  const { data: pubRows } = await client
    .from("audio_assets")
    .select("id, sha256, is_public")
    .eq("is_public", true);
  let markedPrivate = 0;
  for (const row of pubRows ?? []) {
    const sha = String(row.sha256).toLowerCase();
    if (keep.has(sha)) continue;
    if (row.is_public) {
      await client.from("audio_assets").update({ is_public: false }).eq("id", row.id);
      markedPrivate += 1;
    }
  }

  for (const sha of keep) {
    await client
      .from("audio_assets")
      .update({ is_public: true })
      .eq("sha256", sha)
      .eq("is_public", false);
  }

  return { keepCount: keep.size, deleted, markedPrivate };
}
