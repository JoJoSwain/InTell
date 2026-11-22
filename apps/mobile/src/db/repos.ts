import type { SqlDriver, SqlValue } from "./driver";

export type PackRow = {
  scope: string;
  id: string;
  version: number;
  manifest_json: string;
  installed_at: string;
};

export type AssetRow = {
  sha: string;
  ext: string;
  bytes: number;
  local_uri: string;
  last_used_at: string | null;
};

export type PreviewRow = {
  release_id: string;
  manifest_json: string;
  fetched_at: string;
};

export type CompletionRow = {
  fragment_id: string;
  revision_no: number;
  time_window: string;
  completed_at: string;
  on_site: number;
  trigger: string;
  session_id: string;
};

export async function listPacks(db: SqlDriver): Promise<PackRow[]> {
  return db.getAll<PackRow>("SELECT scope, id, version, manifest_json, installed_at FROM packs");
}

export async function upsertPack(db: SqlDriver, row: PackRow): Promise<void> {
  await db.run(
    `INSERT INTO packs (scope, id, version, manifest_json, installed_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (scope, id) DO UPDATE SET
       version = excluded.version,
       manifest_json = excluded.manifest_json,
       installed_at = excluded.installed_at`,
    [row.scope, row.id, row.version, row.manifest_json, row.installed_at],
  );
}

export async function deletePack(db: SqlDriver, scope: string, id: string): Promise<void> {
  await db.run("DELETE FROM packs WHERE scope = ? AND id = ?", [scope, id]);
}

export async function listAssets(db: SqlDriver): Promise<AssetRow[]> {
  return db.getAll<AssetRow>("SELECT sha, ext, bytes, local_uri, last_used_at FROM assets");
}

export async function getAsset(db: SqlDriver, sha: string): Promise<AssetRow | null> {
  return db.getFirst<AssetRow>(
    "SELECT sha, ext, bytes, local_uri, last_used_at FROM assets WHERE sha = ?",
    [sha],
  );
}

export async function upsertAsset(
  db: SqlDriver,
  row: {
    sha: string;
    ext: string;
    bytes: number;
    local_uri: string;
    last_used_at: string | null;
  },
): Promise<void> {
  await db.run(
    `INSERT INTO assets (sha, ext, bytes, local_uri, last_used_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (sha) DO UPDATE SET
       ext = excluded.ext,
       bytes = excluded.bytes,
       local_uri = excluded.local_uri,
       last_used_at = excluded.last_used_at`,
    [row.sha, row.ext, row.bytes, row.local_uri, row.last_used_at],
  );
}

export async function deleteAsset(db: SqlDriver, sha: string): Promise<void> {
  await db.run("DELETE FROM assets WHERE sha = ?", [sha]);
}

/** Keeps the first on-site completion. Replays do not write a new row. */
export async function insertCompletionIgnore(db: SqlDriver, row: CompletionRow): Promise<void> {
  await db.run(
    `INSERT OR IGNORE INTO completions (
      fragment_id, revision_no, time_window, completed_at, on_site, trigger, session_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      row.fragment_id,
      row.revision_no,
      row.time_window,
      row.completed_at,
      row.on_site,
      row.trigger,
      row.session_id,
    ],
  );
}

export async function getCompletion(
  db: SqlDriver,
  fragmentId: string,
  revisionNo: number,
  timeWindow: string,
): Promise<CompletionRow | null> {
  return db.getFirst<CompletionRow>(
    `SELECT fragment_id, revision_no, time_window, completed_at, on_site, trigger, session_id
     FROM completions
     WHERE fragment_id = ? AND revision_no = ? AND time_window = ?`,
    [fragmentId, revisionNo, timeWindow],
  );
}

export async function listPreview(db: SqlDriver): Promise<PreviewRow[]> {
  return db.getAll<PreviewRow>("SELECT release_id, manifest_json, fetched_at FROM preview");
}

export async function upsertPreview(db: SqlDriver, row: PreviewRow): Promise<void> {
  await db.run(
    `INSERT INTO preview (release_id, manifest_json, fetched_at)
     VALUES (?, ?, ?)
     ON CONFLICT (release_id) DO UPDATE SET
       manifest_json = excluded.manifest_json,
       fetched_at = excluded.fetched_at`,
    [row.release_id, row.manifest_json, row.fetched_at],
  );
}

export async function deleteAllPreview(db: SqlDriver): Promise<void> {
  await db.run("DELETE FROM preview");
}

export async function getKv(db: SqlDriver, key: string): Promise<string | null> {
  const row = await db.getFirst<{ value: string }>("SELECT value FROM kv WHERE key = ?", [key]);
  return row?.value ?? null;
}

export async function setKv(db: SqlDriver, key: string, value: string): Promise<void> {
  await db.run(
    `INSERT INTO kv (key, value) VALUES (?, ?)
     ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
    [key, value],
  );
}

export function asSql(value: string | number | null | undefined): SqlValue {
  return value ?? null;
}
