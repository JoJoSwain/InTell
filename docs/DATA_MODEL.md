# InTell — Data Model & Content Backend (v3)

This is the single source of truth for the database, storage and content packaging. Other docs refer to tables by the names used here. v3 incorporates ADR 0004 (product realignment, 2026-11-20). **The merged M2 migrations implement v2. The M3 schema realignment PR (`docs/briefs/M3-admin.md`, M3a) brings the database to v3 with new migrations only; merged migrations are never edited.**

**Stack:** Supabase Postgres + PostGIS + pg_cron + pg_net, Supabase Storage, and Edge Functions (Deno). Schema changes go only through `supabase/migrations/*.sql`.

> **Shorthand:** `id uuid pk` means `id uuid primary key default gen_random_uuid()`. `…ts` means `created_at timestamptz not null default now(), updated_at timestamptz not null default now()` plus an `updated_at` trigger. `L10n` means a `jsonb` object keyed by language, e.g. `{"en":"…"}`, validated by the zod `L10n` schema. Content is English-only for now; the L10n shape stays so languages can be added without a migration. Write full, valid SQL in the migrations.

---

## 0. Design decisions

1. **Replaceplace produces everything that plays.** There are no outside contributors, consents, credits or audio licenses. An asset is publicly reachable only while a current pack references it.
2. **Places are geometry.** Groves (story places), ambience zones and music zones are PostGIS polygons that may overlap. Fragments are points. Coordinates live in Postgres and in packs (fragment points are public on the map). Marker codes never leave Postgres; packs carry only their sha256.
3. **The server publishes static packs; devices don't query live while exploring.** Publishing builds versioned JSON **packs** (grove, region) into Storage. Devices download packs plus the assets they reference, so playback is smooth with the screen locked. The base map is online (ADR 0002). The database is the authoring system; packs are the delivery system.
4. **Releases are the only way content reaches phones.** Staff edit freely; a published **release** writes immutable snapshots that the pack builder reads. Edits to live content are staged until the next release.
5. **One story world.** Characters and threads are story-wide. Prerequisites can cross groves.
6. **Story time is versioned, not seasonal.** Fragments have revisions, each a Story Contingency or a Story Correction, with Day and/or Night versions. There are no rings or crossroads.
7. **Listener data is owned by an anonymous device.** Journal entries and check-ins are keyed by a random `device_id`. Completion, unlock and Chronicle state stay on the phone only.

---

## 1. Extensions and enums
```sql
create extension if not exists postgis;
create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists pgcrypto;

create type staff_role          as enum ('admin','editor','writer','sound','moderator','viewer');
create type publish_status      as enum ('draft','in_review','approved','published','retired','unpublished');
                                -- in_review / approved are unused (no review workflow) and hidden in the admin
create type tier                as enum ('root','branch','leaf');
create type fragment_visibility as enum ('standard','physical');
create type lang                as enum ('en','es');
create type asset_kind          as enum ('narration','sfx_oneshot','sfx_bed','music_stem','voice_cue','growth_cue');
create type time_window         as enum ('day','night');
create type change_kind         as enum ('contingency','correction');
create type character_prominence as enum ('major','minor');
create type release_status      as enum ('draft','scheduled','publishing','published','failed','cancelled');
create type entry_kind          as enum ('next','character','noticed','answer','memory');
create type entry_status        as enum ('submitted','read','sprouting','grown','resting','hidden');
```
Removed from v2: `rights_status`, `approval_status`, `asset_source`, `license_kind`, `ring_status`, `crossroads_status`, `seed_kind`, `seed_status`; `fragment_visibility` values `marked`/`unmarked`/`protected` (→ `standard`/`physical`); `time_window` values `dawn`/`dusk`; `asset_kind` value `writer_note` (→ `growth_cue` for the "your idea grew" moment).

---

## 2. Regions
```sql
create table regions (
  id uuid pk, slug text unique not null, name text not null,
  timezone text not null default 'America/Denver',
  sun_reference geography(Point,4326) not null,    -- sunrise/sunset for Day/Night are computed here
  bounds geography(Polygon,4326),                  -- for the region pack & landcover export
  pack_version int not null default 0,             -- bumped on every region pack rebuild
  …ts
);
```
Regions carry the timezone, the Day/Night sun reference and the shared surroundings and music pack. **Removed in v3:** `sites`, `site_approvals` (their useful fields moved to `groves`).

---

## 3. Media assets
```sql
create table audio_assets (
  id uuid pk,
  kind asset_kind not null,
  sha256 text unique not null,                     -- content address
  ext text not null check (ext in ('m4a','mp3','wav','caf','ogg')),
  bytes int not null, duration_ms int not null,
  channels smallint not null check (channels in (1,2)),
  sample_rate int not null,
  bitrate_kbps int,                                -- measured at upload; checked against AUDIO_SPEC §6
  loudness_lufs numeric(5,2), true_peak_dbtp numeric(5,2),  -- measured at upload in the browser
  loop_start_ms int, loop_end_ms int,              -- beds and music stems
  title text not null, tags text[] not null default '{}',
  staging_path text not null,                      -- staging-audio/{sha256}.{ext}
  is_public boolean not null default false,        -- mirrors public-media/a/{sha256}.{ext}; set only by the reconciler
  created_by uuid references auth.users(id),
  …ts
);

create table image_assets (                        -- character portraits (and later other artwork)
  id uuid pk,
  sha256 text unique not null,
  ext text not null check (ext in ('webp','png','jpg')),
  bytes int not null, width int not null, height int not null,
  title text not null,
  alt_text jsonb not null default '{}',            -- L10n; required before publish (accessibility)
  staging_path text not null,                      -- staging-images/{sha256}.{ext}
  is_public boolean not null default false,        -- mirrors public-media/i/{sha256}.{ext}
  created_by uuid references auth.users(id),
  …ts
);
```
**Removed in v3:** `contributors`, `consents`, `asset_rights`, `audio_assets.source`. Day/Night is **not** a property of a file; it's set where a file is used (§4 versions, §5 layers, §6 cues), so one file can be placed under both tags.

---

## 4. Story layer
```sql
create table groves (
  id uuid pk, region_id uuid not null references regions(id),
  slug text not null, name jsonb not null, premise jsonb not null default '{}',   -- L10n
  access_notes jsonb not null default '{}',        -- L10n per key: parking, transit, restrooms, terrain, hours, accessibility
  website_url text, gatherings_url text,
  allows_speaker_wildlife_sounds boolean not null default false,
  boundary geography(Polygon,4326) not null,
  growth_cue_id uuid references audio_assets(id),  -- "This part grew from ideas listeners shared… including yours."
  status publish_status not null default 'draft',
  pack_version int not null default 0,
  published_at timestamptz,
  …ts, unique (region_id, slug)
);
create index on groves using gist (boundary);

-- Story Notes (staff only, story-wide, never in packs)
create table threads (
  id uuid pk, title text not null, notes text, …ts
);

create table characters (                          -- story-wide; can appear in any grove
  id uuid pk,
  name text not null, notes text,                  -- internal (Story Notes)
  public_name jsonb not null default '{}',         -- L10n; shown in the Chronicle only once met
  public_intro jsonb not null default '{}',        -- L10n; spoiler-free opening of the character card
  portrait_image_id uuid references image_assets(id),
  status publish_status not null default 'draft',
  …ts
);

create table fragments (
  id uuid pk, grove_id uuid not null references groves(id) on delete cascade,
  tier tier not null,                              -- weight and priority only (ADR 0003)
  is_ending boolean not null default false,        -- Root End
  title jsonb not null,                            -- shown only once playable
  teaser jsonb not null default '{}',              -- L10n, required to publish: place cue + story cue
  location geography(Point,4326) not null,
  visibility fragment_visibility not null default 'standard',
  trigger_radius_m numeric(5,2) not null default 10.67
    check (trigger_radius_m between 4.57 and 10.67),  -- 15–35 ft; admin shows feet; unused for physical
  marker_code text unique,                         -- required when physical; printed as a QR link
  story_order numeric not null,                    -- canonical narrative order (Chronicle views)
  indigeny_earth text, indigeny_world text, indigeny_body text,   -- Story Notes: the Indigeny note
  status publish_status not null default 'draft',  -- 'retired' hides from the map, keeps the Chronicle
  …ts,
  check (not is_ending or tier = 'root')
);
create index on fragments using gist (location);
-- trigger fn_fragment_guard: ST_Covers(grove.boundary, location); physical ⇒ marker_code not null

-- Prerequisites (ADR 0003 as amended): unlocked ⇔ EVERY group has ≥1 member the device has completed
-- for that member's latest contingency. No groups ⇒ unlocked from the start. Members may be in ANY grove.
create table fragment_prereq_groups (
  id uuid pk, fragment_id uuid not null references fragments(id) on delete cascade,
  sort_order int not null default 0,
  …ts
);
create table fragment_prereq_members (
  group_id uuid not null references fragment_prereq_groups(id) on delete cascade,
  requires_fragment_id uuid not null references fragments(id) on delete restrict,
  sort_order int not null default 0,
  primary key (group_id, requires_fragment_id)
);
-- trigger fn_prereq_guard: not itself; no cycles story-wide (recursive check under one story-wide
-- advisory lock, so concurrent edits can't create a cycle together). The same-grove rule is removed.

create table fragment_threads (
  fragment_id uuid references fragments(id) on delete cascade,
  thread_id uuid references threads(id) on delete cascade,
  primary key (fragment_id, thread_id)
);
create table fragment_characters (
  fragment_id uuid references fragments(id) on delete cascade,
  character_id uuid references characters(id) on delete cascade,
  prominence character_prominence not null default 'minor',
  introduces boolean not null default false,       -- completing this fragment means the listener has "met" them
  card_line jsonb not null default '{}',           -- L10n; added to the character card when this fragment is completed
  primary key (fragment_id, character_id)
);

create table fragment_revisions (
  id uuid pk, fragment_id uuid not null references fragments(id) on delete cascade,
  revision_no int not null,
  change_kind change_kind not null,                -- the first revision counts as a contingency (enforced)
  status publish_status not null default 'draft',
  release_id uuid,                                 -- the release that published it (FK to releases, §8)
  change_note text,                                -- internal: why this revision exists
  created_by uuid references auth.users(id),
  …ts, unique (fragment_id, revision_no),
  check (revision_no > 1 or change_kind = 'contingency')
);
-- A published revision is immutable; any change is a new revision.

create table revision_versions (
  id uuid pk, revision_id uuid not null references fragment_revisions(id) on delete cascade,
  language lang not null default 'en',
  time_window time_window not null,                -- Day or Night
  narration_asset_id uuid not null references audio_assets(id),
  transcript text not null, vtt text,
  …ts, unique (revision_id, language, time_window)
);
```
**Removed in v3:** `rings`, `revision_contributors`, `fragments.gap_hint` (→ `teaser`), `fragments.introduced_in_ring_id`, `fragment_revisions.ring_id`, `publish_at` (scheduling moved to releases), `requires_outcome_option_id`, `content_note` (public change notes aren't shown), the grove scoping of `threads` and `characters`.

**Contingency number.** For a fragment's current revision, `contingency_revision_no` = the highest `revision_no` ≤ the current one whose `change_kind = 'contingency'`. A device's completion of revision *n* satisfies prerequisites while *n* ≥ `contingency_revision_no`. Corrections carry completion forward; a contingency starts a new requirement.

---

## 5. Surroundings layer (generative ambience)
```sql
create table ambience_profiles (                   -- a palette, e.g. "Great Salt Lake marsh", "Urban street"
  id uuid pk, region_id uuid references regions(id),   -- null = global
  slug text unique not null, name text not null, description text,
  density numeric(3,2) not null default 1.0 check (density between 0.1 and 3.0),
  …ts
);

create table ambience_layers (                     -- one sound family within a profile
  id uuid pk, profile_id uuid not null references ambience_profiles(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('bed','oneshot')),
  time_window time_window not null,                -- Day or Night (required)
  gain_db_min numeric(4,1) not null default -18, gain_db_max numeric(4,1) not null default -10,
  pan_min numeric(3,2) not null default -0.8, pan_max numeric(3,2) not null default 0.8,
  pitch_cents_min int not null default -100, pitch_cents_max int not null default 100,
  mean_interval_s int, min_interval_s int,
  max_concurrent smallint not null default 2,
  no_repeat_last smallint not null default 2,
  crossfade_ms int not null default 4000,
  months smallint[] not null default '{1,2,3,4,5,6,7,8,9,10,11,12}',
  speaker_safe boolean not null default true,
  wildlife_call boolean not null default false,    -- never on speaker; muted in nesting months
  nesting_mute_months smallint[] not null default '{}',
  …ts,
  check ((kind='oneshot') = (mean_interval_s is not null))
);

create table ambience_layer_assets (
  layer_id uuid references ambience_layers(id) on delete cascade,
  asset_id uuid references audio_assets(id) on delete restrict,
  weight numeric(4,2) not null default 1.0,
  primary key (layer_id, asset_id)
);

create table ambience_zones (
  id uuid pk, region_id uuid not null references regions(id),
  name text not null, boundary geography(Polygon,4326) not null,
  profile_id uuid not null references ambience_profiles(id),
  priority int not null default 100, edge_fade_m int not null default 40,
  status publish_status not null default 'draft',
  …ts
);
create index on ambience_zones using gist (boundary);

create table landcover_classes (code smallint primary key, name text not null,
  profile_id uuid references ambience_profiles(id));
create table landcover_grids (
  region_id uuid primary key references regions(id),
  h3_resolution smallint not null default 9, source text not null,
  file_path text not null, version int not null, generated_at timestamptz not null
);

create table ui_cues (
  id uuid pk, region_id uuid references regions(id),
  key text not null check (key in ('hush_listen')),
  language lang not null default 'en',
  asset_id uuid not null references audio_assets(id),
  status publish_status not null default 'draft',
  …ts, unique nulls not distinct (region_id, key, language)
);
```
Change from v2: `ambience_layers.time_windows time_window[]` → `time_window time_window not null`. A layer that should play day and night is two layers (they can share assets).

---

## 6. Soundtrack layer (adaptive music)
```sql
create table music_zones (
  id uuid pk, region_id uuid not null references regions(id),
  name text not null, boundary geography(Polygon,4326) not null,
  priority int not null default 100, edge_fade_m int not null default 60,
  status publish_status not null default 'draft',
  …ts
);
create index on music_zones using gist (boundary);

create table music_cues (
  id uuid pk, name text not null,
  music_zone_id uuid references music_zones(id) on delete cascade,
  grove_id uuid references groves(id) on delete cascade,   -- grove boundary acts as the zone
  time_window time_window not null,                -- Day or Night (required)
  priority int not null default 100,
  conditions jsonb not null default '{}',          -- zod MusicCondition (AUDIO_SPEC §4.2)
  min_dwell_s int not null default 45, crossfade_ms int not null default 6000,
  status publish_status not null default 'draft',
  …ts,
  check (num_nonnulls(music_zone_id, grove_id) = 1)
);

create table music_cue_stems (
  id uuid pk, cue_id uuid not null references music_cues(id) on delete cascade,
  asset_id uuid not null references audio_assets(id),
  role text not null default 'base', gain_db numeric(4,1) not null default 0,
  state_gains jsonb not null default '[]',         -- zod StemRule[]
  …ts
);
```
All stems in a cue must have equal `duration_ms` and loop points (enforced at publish). Music conditions no longer reference rings, crossroads or time windows (AUDIO_SPEC §4.2).

---

## 7. Journal layer (provisional; finalized in the M9 brief, see PARTICIPATION_SPEC banner)
```sql
create table journal_terms (version int primary key, body jsonb not null, effective_at timestamptz not null);

create table questions (                           -- prompts the story is asking listeners
  id uuid pk, text jsonb not null,
  anchor_fragment_id uuid references fragments(id), anchor_character_id uuid references characters(id),
  requires_completed boolean not null default true,   -- visible only after the anchor fragment is completed
  opens_at timestamptz not null, closes_at timestamptz,
  status publish_status not null default 'draft',
  …ts
);

create table devices (
  id uuid primary key,                             -- random UUID generated on the phone; a bearer secret
  first_seen_at timestamptz not null default now(),
  platform text, app_version text, ui_language lang,
  age_gate text check (age_gate in ('under_13','13_17','18_plus','adult_for_family'))
);

create table journal_entries (
  id uuid pk,
  device_id uuid not null references devices(id) on delete cascade,
  client_entry_id uuid not null,
  grove_id uuid references groves(id),
  anchor_fragment_id uuid references fragments(id),   -- snapped on device; raw coordinates never sent
  written_on_site boolean not null,
  kind entry_kind not null,
  question_id uuid references questions(id), character_id uuid references characters(id),
  body text check (char_length(body) <= 1500),
  voice_path text,                                 -- private bucket journal-voice/{id}.m4a (≤ 90 s)
  voice_duration_ms int,
  staff_transcript text,
  terms_version int not null references journal_terms(version),
  status entry_status not null default 'submitted',
  flags text[] not null default '{}',              -- pii_stripped, sensitive_culture, real_person, safety
  themes text[] not null default '{}',
  submitted_at timestamptz not null, status_changed_at timestamptz,
  …ts,
  unique (device_id, client_entry_id),
  check (body is not null or voice_path is not null)
);

create table entry_links (                         -- lineage: what an entry informed
  id uuid pk, entry_id uuid not null references journal_entries(id) on delete cascade,
  revision_id uuid references fragment_revisions(id) on delete cascade,
  question_id uuid references questions(id),
  note text,                                       -- internal: how it was used
  stage entry_status not null default 'sprouting', -- sprouting until the target publishes, then grown
  …ts,
  check (num_nonnulls(revision_id, question_id) = 1)
);

create table gatherings (                          -- in-person story circles (display only; registration on the website)
  id uuid pk, grove_id uuid references groves(id),
  title jsonb not null, starts_at timestamptz not null, url text, …ts
);

create table checkins (
  id uuid pk, device_id uuid not null references devices(id) on delete cascade,
  client_checkin_id uuid not null, session_id uuid not null, grove_id uuid not null references groves(id),
  place_before smallint check (place_before between 1 and 5), place_now smallint check (place_now between 1 and 5),
  people_before smallint check (people_before between 1 and 5), people_now smallint check (people_now between 1 and 5),
  first_visit boolean, submitted_at timestamptz not null,
  unique (device_id, client_checkin_id)
);
```
**Removed in v3:** `seeds` (→ `journal_entries`, without credit names, quote/voice-use permissions, sound grants or memory contact), `seed_links` (→ `entry_links`, without asset or crossroads targets), `seed_terms` (→ `journal_terms`), `crossroads`, `crossroads_options`, `crossroads_votes`, `devices.attested_at` / `attestation`, every `ring_id`. The `journal_entries` table is created in M3a so the schema is coherent, but nothing writes to it until M9.

---

## 8. Releases and operations
```sql
create table releases (                            -- a batch of content published together
  id uuid pk, name text not null, notes text,
  status release_status not null default 'draft',
  publish_at timestamptz,                          -- null = publish now; set ⇒ status 'scheduled'
  published_at timestamptz, published_by uuid references auth.users(id),
  last_check jsonb,                                -- the most recent fn_publish_check result
  created_by uuid references auth.users(id),
  …ts
);

create table release_items (                       -- what the release publishes or updates
  release_id uuid not null references releases(id) on delete cascade,
  entity text not null check (entity in ('grove','fragment','revision','character','image',
                                         'ambience_profile','ambience_zone','music_zone','music_cue','ui_cue')),
  entity_id uuid not null,
  primary key (release_id, entity, entity_id)
);

create table published_snapshots (                 -- the live state of each publishable entity; packs read these
  entity text not null, entity_id uuid not null,
  release_id uuid not null references releases(id),
  data jsonb not null,                             -- the entity's publishable fields + its links at publish time
  published_at timestamptz not null default now(),
  primary key (entity, entity_id)
);

create table staff (user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null, role staff_role not null default 'viewer',
  active boolean not null default true, invited_by uuid references auth.users(id), …ts);

create table audit_log (id bigint generated always as identity primary key,
  actor uuid references auth.users(id), action text not null, entity text not null, entity_id uuid,
  detail jsonb not null default '{}', created_at timestamptz not null default now());

create table events (id bigint generated always as identity primary key,
  device_id uuid not null references devices(id) on delete cascade, client_event_id uuid not null,
  name text not null, occurred_at timestamptz not null,
  grove_id uuid, fragment_id uuid, revision_id uuid, session_id uuid,
  props jsonb not null default '{}',               -- zod-validated per event; never coordinates or free text
  received_at timestamptz not null default now(),
  unique (device_id, client_event_id));
create index on events (grove_id, occurred_at);

create table pack_builds (id bigint generated always as identity primary key,
  scope text not null check (scope in ('grove','region')), scope_id uuid not null,
  version int not null, manifest_path text not null, manifest_sha256 text not null,
  content_sha256 text,                             -- canonical JSON sans packVersion/builtAt; equal ⇒ no-op
  asset_hashes text[] not null, bytes_total bigint not null,
  release_id uuid references releases(id),         -- builds triggered by a release go live together
  live boolean not null default false,             -- true once every build of its release succeeded
  built_at timestamptz not null default now(), reason text);

create table jobs (                                -- outbox; triggers/functions only insert rows
  id uuid primary key default gen_random_uuid(),   -- as shipped in M2
  kind text not null check (kind in ('publish_release','rebuild_pack','purge_asset')),
  payload jsonb not null,                          -- ids only; never coordinates or codes
  status text not null default 'queued',
  attempts int not null default 0, last_error text,
  run_after timestamptz not null default now(),
  …ts
);
-- pg_cron every minute → pg_net → `run-jobs` (idempotent, retries/backoff, max 5 attempts).
```
Existing tables keep the id types they shipped with in M2; the sketches above don't ask for id-type changes.

**Release status flow:** `draft` → (`scheduled`) → `publishing` (go-live in progress: check, copy, commit and pack builds — including the moment `fn_enqueue_due_releases` moves a due release here before the check runs) → `published` (every pack for the release is live; `published_at` set) or `failed` (the check failed at go-live, or a pack build exhausted its retries; `last_check` says why). A failed release can be retried. `cancelled` is for a scheduled release withdrawn before go-live. The admin badge for `publishing` reads "Publishing…".
**Snapshot projection.** One SQL function, `fn_snapshot_projection(entity, entity_id) returns jsonb`, produces an entity's publishable projection from its working rows. Commit stores its output in `published_snapshots.data`; the admin's "Unreleased changes" marker is `projection(working) is distinct from snapshot.data`. A zod schema per entity in `packages/shared/src/schemas/snapshots.ts` validates the payloads, and `build-pack` parses them with it.

**What a snapshot holds.** `grove`: name, premise, access notes, links, wildlife-speaker setting, boundary, growth cue. `fragment`: tier, is_ending, title, teaser, location, visibility, radius, marker hash (never the code), story order, status, prerequisite groups and members, thread ids, character links (prominence, introduces, card line). `character`: public name, intro, portrait. `image`: sha, ext, alt text. Sound entities (`ambience_profile` with its layers and assets, `ambience_zone`, `music_zone`, `music_cue` with its stems, `ui_cue`): their publishable fields, so M4's sound tools publish through releases too. Revisions don't need snapshots: a published revision is immutable. Story Notes fields (`notes`, Indigeny notes, thread titles) are never snapshotted.

---

## 9. Playability rules (SQL functions)
All are `stable` and `security definer`, owned by `postgres`, with `search_path = ''` and fully qualified names. `revoke execute … from public`, then grant only what each function needs (the `110_definer_grants` allowlist test keeps this honest). Only `get_pack_index()` is granted to `anon`.

- **`fn_revision_is_playable(revision_id)`**: the revision is `published`; its fragment's snapshot exists with status `published` **or `retired`** (retired fragments stay in packs, hidden from the map, so the Chronicle keeps working); its grove's snapshot exists with status `published`; it has at least one version.
- **`fn_current_revision(fragment_id)`**: the playable revision with the highest `revision_no`.
- **`fn_contingency_revision_no(fragment_id)`**: per §4.
- **`fn_cue_is_playable(cue_id)`**: the cue's snapshot is published and its zone or grove is published.
- **`fn_layer_is_playable(layer_id)`**: the layer's profile snapshot is published (replaces v2 `fn_layer_assets_playable`; there are no asset-level rights checks).

Removed in v3: `fn_asset_is_playable` (rights), `fn_site_ok`, `fn_date_unexpired` and every consent, approval and outcome check.

---

## 10. Write paths and triggers

**Editing.** Staff edit working rows (`groves`, `fragments`, `characters`, prerequisites, links) at any time under RLS. Editing never changes what phones see. Only publishing a release does.

**Publishing a release** (two-phase, through the `publish` edge function, now or by schedule):
1. **`fn_publish_check(release_id)`**, read-only: runs the checklist (§11) over everything in the release *plus* the live snapshots it depends on (for example a prerequisite in another grove). Returns `{ok, failures[], asset_shas_to_publish[], image_shas_to_publish[]}` and writes it to `releases.last_check`.
2. The edge function copies each staged asset to `public-media/a/{sha}.{ext}` (audio) or `public-media/i/{sha}.{ext}` (images), with `Cache-Control: public, max-age=3600`. If any copy fails, it stops and nothing is committed.
3. **`fn_publish_commit(release_id)`**, in one transaction: re-runs the checks; sets revision statuses and `release_id`; writes a `published_snapshots` row (via `fn_snapshot_projection`) for **every release item except revisions** (groves, fragments, characters, images and sound entities); sets the release `publishing`; marks entry links `grown` for published targets; writes the audit log; **enqueues** `rebuild_pack` jobs, tagged with the release id, for every affected scope **plus every grove containing a fragment that requires a fragment whose revision or snapshot changed in this release** (so cross-grove `externalPrerequisites` stay current).

**What a release must contain.** Items are explicit; commit never adds dependencies on its own. The checklist reports a missing dependency as `DEPENDENCY_UNPUBLISHED`: a revision whose fragment isn't published or in the release; a fragment whose grove isn't; a fragment linked to a character that isn't; a character whose portrait image isn't; a cue or layer whose zone or profile isn't. (The admin in M3d offers "add the missing items" as a convenience.) Audio files need no release item: the copy step publishes every staged audio sha the release's content references. **All status changes reach phones only through a release or an unpublish**; retiring a fragment means setting it to `retired` and publishing it in a release. There is no status-change trigger that rebuilds packs.

**Scheduled releases.** A release with `publish_at` is `scheduled`. A separate pg_cron SQL function, `fn_enqueue_due_releases()` (every minute), moves due releases to `publishing` and inserts one `publish_release` job each, payload `{"release_id": …}`. `run-jobs` calls `publish` as the service role. If the check fails at go-live, the release becomes `failed` with `last_check` explaining why, and nothing goes live.

**Going live together.** Builds tagged with a release are written with `live = false`. After each successful tagged build (including a no-op, which counts as success), `run-jobs` calls `fn_release_go_live(release_id)`: if no `rebuild_pack` job for that release is still queued, running or failed, it sets every build of the release `live = true` in one transaction and marks the release `published`. If a build job exhausts its retries, the release becomes `failed` (snapshots stay committed; phones keep the previous live packs) until a retry re-enqueues the rebuilds. `get_pack_index` exposes only the latest **live** build per scope, so a newer non-live build never hides an older live one. Builds without a release (unpublish rebuilds) are written `live = true` immediately. The M3a migration sets existing M2 builds `live = true`. Phones therefore never see half of a cross-grove release.

**Unpublish.** `fn_unpublish_commit(entity, ids[])` (editor or admin, through the `unpublish` edge function) sets the entity's status and its snapshot status to `unpublished`, writes the audit log and enqueues rebuilds. Unpublishing a revision makes the previous playable revision current. A **warning** lists fragments in any grove whose prerequisites would be stranded. The reconciler removes files after rebuilds.

| Event | Effect |
|---|---|
| Release published (check → copy → commit) | Snapshots, statuses, audit; enqueue `rebuild_pack` per affected scope; go live together |
| Scheduled release time reached (pg_cron, every minute) | Enqueue `publish_release`; failure ⇒ `failed` + reason |
| Unpublish | Status `unpublished`, audit, rebuild; reconciler removes storage |
| Daily 02:00 regional time | Delete `voice_path` files for Journal entries `resting` or `hidden` more than 30 days, or `grown` more than 180 days |

**Pack rebuild / outbox:** triggers and functions only **insert jobs**; they never call HTTP. `run-jobs` processes `publish_release` jobs first, then all `rebuild_pack` jobs, then any `purge_asset` job. Each successful rebuild enqueues one deduplicated `purge_asset` reconcile. `build-pack` computes canonical JSON without `packVersion`/`builtAt`, hashes it as `content_sha256`, and no-ops when it equals the latest build's `content_sha256` for the scope.

**Public media reconciler (`purge-assets`):** `public-media/a/` and `public-media/i/` must contain **exactly** the union of asset shas across the **latest live** manifest of every scope listed by `get_pack_index`. Delete everything else and set `is_public = false`; set `is_public = true` only for the keep-set. Idempotent. Superseded manifests are deleted after a new version is live.

---

## 11. Publish checklist (`fn_publish_check` returns `{ok, failures:[{code, severity:'error'|'warning', message, entity, entity_id}], …}`)
`ok` is true when there are no `error` entries. Warnings never block.

| Code | Severity | Rule |
|---|---|---|
| `NO_VERSION` | error | Every revision has at least one version (Day and/or Night) |
| `NO_TRANSCRIPT` | error | Every version has a non-empty transcript |
| `NO_TEASER` | error | Every fragment has a teaser |
| `OUTSIDE_GROVE` | error | The fragment is inside its grove polygon |
| `PREREQ_UNPUBLISHED` | error | Every prerequisite group has ≥1 member that is published or retired (in any grove) or in the same release |
| `DEPENDENCY_UNPUBLISHED` | error | Something the release's content depends on is neither published nor in the release (see §10, "What a release must contain") |
| `EMPTY_PREREQ_GROUP` | error | Every prerequisite group has at least one member |
| `PHYSICAL_NO_CODE` | error | Physical fragments have a `marker_code` |
| `NO_ALT_TEXT` | error | Every image in the release has alt text |
| `STEM_MISMATCH` | error | Cue stems differ in duration or loop points |
| `WILDLIFE_SPEAKER` | error | A layer with `wildlife_call=true` and `speaker_safe=true` is not allowed |
| `CONDITION_SCHEMA` | error | Cue `conditions` and `state_gains` validate against zod |
| `NO_START` | warning | No fragment in the grove is open from the start (every one has at least one prerequisite group, including groves whose only starts depend on other groves) |
| `PREREQ_ONE_WINDOW` | warning | A prerequisite exists only by day or only by night, so it blocks listeners at the other time |
| `RADIUS_OVERLAP` | warning | Two standard fragments' circles overlap, unless one must precede the other (ADR 0003 §4) |
| `LOUDNESS` | warning | An asset is more than ±2 LU from its target (AUDIO_SPEC §6), or its loudness wasn't measured |
| `AUDIO_FORMAT` | warning | An asset's format, channels or bitrate differs from AUDIO_SPEC §6 |
| `PACK_BUILD_FAILED` | error | A `rebuild_pack` job for this release exhausted its retries; set on `releases.last_check` by `run-jobs` (release-level, not a row checklist item) |

Removed in v3: `NARRATION_RIGHTS`, `CONSENT_APP`, `SITE_APPROVAL`, `PROTECTED_NO_CODE` (→ `PHYSICAL_NO_CODE`), `OUTCOME_REF`.

---

## 12. Content packs (the delivery format)

### 12.1 Grove pack
`public-media/packs/grove/{grove_id}/{pack_version}.json`, built by `build-pack` from **published snapshots** and current revisions. Fragments with snapshot status `published` or `retired` are included; `unpublished` ones are omitted. Canonical JSON rules are unchanged from v2: deep-sorted keys, no insignificant whitespace, UTF-8; arrays in defined order (fragments by `storyOrder` then `id`; revisions by `fragmentId`; versions by `lang` then `timeWindow`; `requires` groups and members by `sort_order` then id; assets by `sha`; other lists by `id`); coordinates rounded to 6 decimals. `builtAt` is the latest `published_at` among the snapshots and revisions that fed the pack. zod `GrovePack` (schema 2):
```ts
{
  schema: 2, groveId, regionId, packVersion, builtAt,
  grove: { id, name, premise, accessNotes, websiteUrl?, gatheringsUrl?, boundary: GeoJSON.Polygon,
           allowsSpeakerWildlifeSounds: boolean, growthCueAssetSha?: string },
  characters: [{ id, publicName, publicIntro, portraitSha?, portraitAlt? }],   // characters linked to this grove's fragments
  fragments: [{ id, tier, isEnding, requires: string[][],   // AND of OR groups; ids may be in other groves
                title, teaser, visibility: 'standard'|'physical', storyOrder,
                retired,                                     // snapshot status 'retired': hidden from the map, kept for the Chronicle
                lat, lng, radiusM?,                          // radiusM omitted for physical
                markerHash?,                                 // sha256(marker_code) for physical; never the code
                threadIds,                                   // ids only (for music conditions)
                characters: [{ characterId, prominence, introduces, cardLine }] }],
  externalPrerequisites: [{ fragmentId, groveId, contingencyRevisionNo }],   // prerequisite members in OTHER groves,
                                                    // so devices can evaluate unlocks without that grove's pack installed
  revisions: [{ id, fragmentId, revisionNo, changeKind, contingencyRevisionNo,   // current revision only (ADR 0004 §16)
                versions: [{ lang, timeWindow: 'day'|'night', assetSha, durationMs, bytes, transcript, vtt? }] }],
  questions: [{ id, text, anchorFragmentId?, anchorCharacterId?, requiresCompleted, opensAt, closesAt }],
  music: { cues: [{ id, zone?: GeoJSON.Polygon, useGroveBoundary: boolean, timeWindow, priority, conditions,
                    minDwellS, crossfadeMs, stems: [{ assetSha, role, gainDb, stateGains, loopStartMs, loopEndMs }] }] },
  ambienceZones: [{ id, boundary, profileSlug, priority, edgeFadeM }],   // zones intersecting grove bbox + 1 km
  gatherings: [{ title /* L10n */, startsAt, url }],
  assets: [{ sha, ext, bytes, kind }]   // kind: asset_kind | 'image'
}
```

### 12.2 Region pack
`public-media/packs/region/{region_id}/{version}.json`, zod `RegionPack` (`schema: 2`): `timezone`, `sunReference: {lat, lng}`, `ambienceProfiles` with their layers (each with `timeWindow`) and asset shas, `landcover: {gridSha, h3Resolution, classes} | null`, region-wide `ambienceZones` and `musicZones`/cues not tied to a grove, `uiCues`, `assets`. Profile and layer names are plain strings (staff-facing), as in SQL.

### 12.3 Index
`get_pack_index()` (granted to `anon`) returns `[{scope, id, version, manifestPath, manifestSha256, bytesTotal, name, bbox}]` from the latest **live** `pack_builds` row per scope. Groves appear only when their snapshot status is `published` (including groves with zero playable revisions, so devices can drop removed content). Regions appear when a live build exists.

### 12.4 Rules
- Packs **never** include: marker codes (only their hashes), Story Notes (thread titles and notes, character notes, Indigeny notes), Journal entries, internal change notes, or anything from an unpublished release.
- The device must delete any local asset whose sha isn't in the union of the current manifests (mandatory on sync).
- Manifest paths are versioned and never overwritten; superseded manifests are deleted once a newer version is live.
- Cache headers: assets `public, max-age=3600`; manifests `public, max-age=60`.

### 12.5 Staff preview
The `preview` edge function returns a **preview manifest** for one release in status `draft`, `scheduled` or `failed` (refuse `publishing` / `published` / `cancelled` with 409). Callers must be active staff who can read the staging buckets (**writer, sound, editor, admin**); viewers and moderators get 403. Auth uses a staff JWT (401 without one).

One pack assembler builds both published and preview packs (D3). The **published** source is `published_snapshots` plus current published revisions. The **preview** source is that, with the release's items overlaid: entities in the release use `fn_snapshot_projection` of working rows, and revisions in the release become the current revision for their fragments. Preview runs for **every grove the release touches** (groves in the items, groves of fragments or revisions in the items, and groves whose `externalPrerequisites` change). No region pack is included. Marker codes never appear (hash only); Story Notes never appear.

Signed URL TTL is **1 hour**. Staged asset shas get signed URLs; already-public shas use their normal public URLs. The phone downloads at fetch time and re-fetches the manifest to refresh. Preview content is never written to `public-media` and never listed in the index. The phone keeps it separate from installed packs and discards it on staff sign-out (M5).

```ts
PreviewManifest {
  schema: "preview/1",
  releaseId, generatedAt, expiresAt,
  groves: GrovePack[],   // schema 2
  assets: [{ sha, ext, url, expiresAt }]
}
```

---

## 13. Row-level security and storage
- RLS is on for **every** table. `anon` has no table grants. It may execute `get_pack_index`, read `public-media`, and call the device edge functions.
- Staff policy helper `has_role(roles staff_role[])` (active staff only). No two-factor requirement (ADR 0004).

| Role | Can |
|---|---|
| `viewer` | Read content |
| `moderator` | Viewer + Journal entry status, flags and themes |
| `writer` | Viewer + draft revisions and versions, Story Notes (threads, character notes, Indigeny notes), characters (draft), questions, upload audio and images |
| `sound` | Viewer + audio assets, ambience profiles, layers, zones, music zones, cues, stems |
| `editor` | Everything above + groves, fragments, prerequisites, releases, publish and unpublish, audit log (read) |
| `admin` | Everything, including staff invites and deactivation |

- Buckets:

| Bucket | Read | Write |
|---|---|---|
| `public-media` (`a/{sha}.{ext}`, `i/{sha}.{ext}`, `packs/…`, `landcover/…`) | public | service role only (publish and build functions) |
| `staging-audio` | writer, sound, editor, admin (+ signed URLs for preview) | writer, sound, editor, admin |
| `staging-images` | writer, sound, editor, admin (+ signed URLs for preview) | writer, sound, editor, admin |
| `journal-voice` | moderator, writer, editor, admin | service role (upload via a signed URL issued by the Journal endpoint, M9) |

Removed in v3: `private-docs` (no approval or consent documents) and the PII column policies (no contributor PII). `seeds-voice` → `journal-voice`.

---

## 14. Device-local database (SQLite, never synced)
| Table | Purpose |
|---|---|
| `packs (scope, id, version, manifest_json, installed_at)` | Installed manifests |
| `assets (sha, ext, bytes, local_uri, last_used_at)` | Content-addressed audio and image cache |
| `completions (fragment_id, revision_no, time_window, completed_at, on_site, trigger, session_id)` | Unlock state and Chronicle replay. A row exists only when playback reached the end on site. |
| `unlocks (fragment_id, unlocked_at)` | Fragments this device has unlocked. Written the first time a fragment's prerequisites are satisfied, and never removed, so an unlocked fragment stays unlocked after a later Story Contingency on one of its prerequisites (ADR 0004 §13). |
| `progress (fragment_id, revision_no, time_window, max_progress_ms, updated_at)` | Partly played ("started") fragments, display only |
| `visits (session_id, grove_id, started_at, ended_at, fragments_completed, time_window)` | Visit history |
| `met_characters (character_id, met_at, fragment_id)` | Chronicle character cards |
| `my_entries (client_entry_id, grove_id, anchor_fragment_id, kind, body, voice_uri, status, links_json, submitted_at, synced)` | Your Journal entries and their lineage |
| `preview (release_id, manifest_json, fetched_at)` | Staff preview content, cleared on sign-out |
| `event_queue`, `checkin_queue`, `kv` | |

**Rules computed on the device** (pure functions in `packages/shared`): a fragment's prerequisite member is satisfied if `completions` has a row for it with `revision_no ≥ contingencyRevisionNo` (taken from the member's own pack, or from `externalPrerequisites` when it lives in another grove). A fragment is **unlocked** if it has a row in `unlocks`, or if every prerequisite group is satisfied now (then write the `unlocks` row). A fragment is replayable in the Chronicle for time window *w* if `completions` has an on-site row for its **current** revision's contingency epoch with `time_window = w`. Whether listener progress can be backed up is an open question (ADR 0004).

---

## 15. Seed data (`supabase/seed.sql`)
- Region `wasatch-front` (America/Denver, sun reference near Farmington Bay).
- **Test grove at the Farmington Bird Refuge (test content only):** geometry, fragments and prerequisites from `supabase/fixtures/farmington-bird-refuge.json` (JoJo's test chain, Frags 1–7, plus Frags 8–10). Frag 9 is **physical** (`DEMO-001`). Frag 10 has a revision 2 that is a **Story Contingency**, and Frag 4 has a revision 2 that is a **Story Correction**. At least one fragment is **Day-only** and one has both **Day and Night** versions.
- **A second small test grove** nearby with two fragments, one requiring a Farmington fragment (a cross-grove prerequisite), so cross-grove unlock and release atomicity are testable.
- Ogden Nature Center and the Nature Center at Pia Okwai as **draft** groves with clearly marked placeholder geometry.
- 2 story-wide characters with generated placeholder portraits (with alt text) and card lines; 1 thread; 1 open question.
- 2 ambience profiles (Marsh, Urban), each with Day and Night layers using generated test tones; a marsh ambience zone over the grove.
- A music zone with Day and Night cues, each with a base and a layer stem.
- One published release containing everything above that's published; one draft release for preview tests.
- `journal_terms` v1. A landcover fixture grid for the test grove.
- `apps/mobile/e2e/demo-route.gpx`, generated from the same fixture: it visits the fragments in an order that satisfies every prerequisite, dwells at each for its narration length + 5 s, and crosses the zone edges.
- **Never seed real stories or real wildlife recordings.**
