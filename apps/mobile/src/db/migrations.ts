/** Forward-only. Never edit a shipped migration; append the next version. */
export const MIGRATION_001 = [
  `CREATE TABLE packs (
    scope TEXT NOT NULL CHECK (scope IN ('grove', 'region')),
    id TEXT NOT NULL,
    version INTEGER NOT NULL,
    manifest_json TEXT NOT NULL,
    installed_at TEXT NOT NULL,
    PRIMARY KEY (scope, id)
  )`,
  `CREATE TABLE assets (
    sha TEXT PRIMARY KEY,
    ext TEXT NOT NULL,
    bytes INTEGER NOT NULL,
    local_uri TEXT NOT NULL,
    last_used_at TEXT
  )`,
  `CREATE TABLE completions (
    fragment_id TEXT NOT NULL,
    revision_no INTEGER NOT NULL,
    time_window TEXT NOT NULL CHECK (time_window IN ('day', 'night')),
    completed_at TEXT NOT NULL,
    on_site INTEGER NOT NULL CHECK (on_site IN (0, 1)),
    trigger TEXT NOT NULL,
    session_id TEXT NOT NULL,
    PRIMARY KEY (fragment_id, revision_no, time_window)
  )`,
  `CREATE TABLE unlocks (
    fragment_id TEXT PRIMARY KEY,
    unlocked_at TEXT NOT NULL
  )`,
  `CREATE TABLE progress (
    fragment_id TEXT NOT NULL,
    revision_no INTEGER NOT NULL,
    time_window TEXT NOT NULL CHECK (time_window IN ('day', 'night')),
    max_progress_ms INTEGER NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (fragment_id, revision_no, time_window)
  )`,
  `CREATE TABLE visits (
    session_id TEXT NOT NULL,
    grove_id TEXT NOT NULL,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    fragments_completed INTEGER NOT NULL,
    time_window TEXT NOT NULL CHECK (time_window IN ('day', 'night')),
    PRIMARY KEY (session_id, grove_id)
  )`,
  `CREATE TABLE met_characters (
    character_id TEXT PRIMARY KEY,
    met_at TEXT NOT NULL,
    fragment_id TEXT NOT NULL
  )`,
  `CREATE TABLE my_entries (
    client_entry_id TEXT PRIMARY KEY,
    grove_id TEXT,
    anchor_fragment_id TEXT,
    kind TEXT NOT NULL,
    body TEXT,
    voice_uri TEXT,
    status TEXT NOT NULL,
    links_json TEXT,
    submitted_at TEXT,
    synced INTEGER NOT NULL CHECK (synced IN (0, 1))
  )`,
  `CREATE TABLE preview (
    release_id TEXT PRIMARY KEY,
    manifest_json TEXT NOT NULL,
    fetched_at TEXT NOT NULL
  )`,
  `CREATE TABLE event_queue (
    id INTEGER PRIMARY KEY,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE checkin_queue (
    id INTEGER PRIMARY KEY,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE kv (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
];

export const MIGRATIONS: readonly (readonly string[])[] = [MIGRATION_001];

export const DEVICE_TABLES = [
  "packs",
  "assets",
  "completions",
  "unlocks",
  "progress",
  "visits",
  "met_characters",
  "my_entries",
  "preview",
  "event_queue",
  "checkin_queue",
  "kv",
] as const;
