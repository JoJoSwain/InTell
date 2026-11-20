# InTell — Data Model & Content Backend (v2)

This is the single source of truth for the database, storage and content packaging. Other docs refer to tables by the names used here.

**Stack:** Supabase Postgres + PostGIS + pg_cron + pg_net, Supabase Storage, and Edge Functions (Deno). Schema changes go only through `supabase/migrations/*.sql`.

> **Shorthand:** `id uuid pk` means `id uuid primary key default gen_random_uuid()`. `…ts` means `created_at timestamptz not null default now(), updated_at timestamptz not null default now()` plus an `updated_at` trigger. `L10n` means a `jsonb` object keyed by language, e.g. `{"en":"…","es":"…"}`, validated by the zod `L10n` schema. Write full, valid SQL in the migrations.

---

## 0. Design decisions

1. **Three content layers, one asset system.** Narration, sound effects and music are all rows in `audio_assets`, stored content-addressed (by SHA-256), each with its own rights records. A file is publicly reachable only while it is **playable**.
2. **Places are geometry.** Groves (story areas), ambience zones and music zones are PostGIS polygons that may overlap. Fragments are points. Coordinates live only in Postgres. Devices receive what packs expose, and protected coordinates never leave Postgres.
3. **The server publishes static packs; devices never query live while exploring.** Publishing builds versioned JSON **packs** (grove, region) into Storage. Devices download packs plus the assets they reference and run everything offline. The database stays the authoring system; packs are the delivery system.
4. **Rights gate everything.** Contributor consents (people) and asset licenses (files) decide playability. Revoking either triggers a pack rebuild and removes the public file.
5. **Participation data is owned by an anonymous device.** Seeds, votes and check-ins are keyed by a random `device_id`. Journal and unlock state stay on the phone only.
6. **Story time is versioned.** Fragments have revisions. Revisions belong to **Rings** (story seasons). Crossroads outcomes become canon that other content (music, revisions) can depend on.

---

## 1. Extensions and enums
```sql
create extension if not exists postgis;
create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists pgcrypto;

create type staff_role        as enum ('admin','editor','writer','sound','moderator','viewer');
create type publish_status    as enum ('draft','in_review','approved','published','retired','unpublished');
create type tier              as enum ('root','branch','leaf');
create type fragment_visibility as enum ('marked','unmarked','protected');
create type lang              as enum ('en','es');
create type rights_status     as enum ('active','revoked','expired');
create type approval_status   as enum ('pending','active','revoked','expired');
create type asset_kind        as enum ('narration','sfx_oneshot','sfx_bed','music_stem','voice_cue','writer_note');
create type asset_source      as enum ('original','commissioned','licensed','public_domain','community_sound');
create type license_kind      as enum ('owned','work_for_hire','consent_form','cc0','cc_by','commercial','community_sound_grant');
create type time_window       as enum ('dawn','day','dusk','night');
create type ring_status       as enum ('planned','planting','writing','released','archived');
create type seed_kind         as enum ('next','character','noticed','answer','memory','sound');
create type seed_status       as enum ('planted','read','sprouting','grown','resting','hidden');
create type crossroads_status as enum ('draft','open','closed','decided','cancelled');
```

---

## 2. Places and permissions
```sql
create table regions (
  id uuid pk, slug text unique not null, name text not null,
  timezone text not null default 'America/Denver',
  bounds geography(Polygon,4326),                 -- for region pack & landcover export
  pack_version int not null default 0,             -- bumped on every region pack rebuild
  …ts
);

create table sites (                               -- a host location, e.g. Ogden Nature Center
  id uuid pk, region_id uuid not null references regions(id),
  slug text unique not null, name text not null,
  access_info jsonb not null default '{}',         -- L10n per key: parking, transit, restrooms, terrain, hours, accessibility
  website_url text, gatherings_url text,
  …ts
);

create table site_approvals (
  id uuid pk, site_id uuid not null references sites(id) on delete cascade,
  status approval_status not null default 'pending',
  approved_by text, scope text,                    -- e.g. "audio experience on public trails; markers at 4 posts"
  allows_speaker_wildlife_sounds boolean not null default false,
  starts_on date, expires_on date, document_path text,  -- private-docs
  …ts
);
```

---

## 3. Audio assets and rights (shared by all three layers)
```sql
create table contributors (
  id uuid pk,
  display_credit text not null,                    -- exactly how they wish to be credited
  legal_name text, contact_email text, contact_phone text,   -- PII: editor/admin only
  community_affiliation text, notes text,
  …ts
);

create table consents (                            -- a person's permission (storytellers, narrators, writers, musicians)
  id uuid pk, contributor_id uuid not null references contributors(id) on delete cascade,
  status rights_status not null default 'active',
  channels text[] not null,                        -- subset of {app,web,print,promo,archive,research}
  license_line text, signed_on date not null, expires_on date,
  document_path text, community_permission_notes text,
  revoked_on date, revoked_reason text,
  …ts
);

create table audio_assets (
  id uuid pk,
  kind asset_kind not null,
  sha256 text unique not null,                     -- content address
  ext text not null check (ext in ('m4a','mp3','wav','caf','ogg')),
  bytes int not null, duration_ms int not null,
  channels smallint not null check (channels in (1,2)),
  sample_rate int not null,
  loudness_lufs numeric(5,2),                      -- measured at upload (client-side meter or edge fn)
  loop_start_ms int, loop_end_ms int,              -- beds and music stems
  title text not null, tags text[] not null default '{}',   -- e.g. {'bird','marsh','red-winged blackbird'}
  source asset_source not null,
  staging_path text not null,                      -- staging-audio/{sha256}.{ext}
  is_public boolean not null default false,        -- true only while playable; mirrors public-media/a/{sha256}.{ext}
  created_by uuid references auth.users(id),
  …ts
);

create table asset_rights (                        -- every asset needs ≥1 active right to be playable
  id uuid pk, asset_id uuid not null references audio_assets(id) on delete cascade,
  license license_kind not null,
  contributor_id uuid references contributors(id),
  consent_id uuid references consents(id),         -- required when license = 'consent_form'
  seed_id uuid,                                    -- FK added in §7: community_sound_grant from a sound seed
  attribution text,                                -- shown in credits when required (cc_by etc.)
  license_doc_path text, expires_on date,
  status rights_status not null default 'active',
  …ts
);
```

---

## 4. Story layer
```sql
create table groves (
  id uuid pk, site_id uuid not null references sites(id),
  slug text not null, name jsonb not null, premise jsonb not null default '{}',   -- L10n
  access_notes jsonb not null default '{}',
  boundary geography(Polygon,4326) not null,
  narrator_growth_cue_id uuid references audio_assets(id),  -- "This part grew from seeds… including you."
  status publish_status not null default 'draft',
  pack_version int not null default 0,             -- bumped on every pack rebuild
  published_at timestamptz,
  …ts, unique (site_id, slug)
);
create index on groves using gist (boundary);

create table rings (                               -- a story season for a grove
  id uuid pk, grove_id uuid not null references groves(id) on delete cascade,
  ring_no int not null, name jsonb not null,       -- e.g. {"en":"Ring 2 · The Long Thaw"}
  theme_note jsonb not null default '{}',          -- public note from the story team
  writer_note_asset_id uuid references audio_assets(id),  -- optional spoken note (kind writer_note)
  status ring_status not null default 'planned',
  planting_opens_at timestamptz, planting_closes_at timestamptz, released_at timestamptz,
  …ts, unique (grove_id, ring_no)
);

create table threads (                             -- internal plot threads (story bible)
  id uuid pk, grove_id uuid not null references groves(id) on delete cascade,
  title text not null, bible text, …ts
);

create table characters (
  id uuid pk, grove_id uuid not null references groves(id) on delete cascade,
  name text not null, bible text,                  -- internal
  public_name jsonb not null default '{}',         -- shown in app only once met
  public_bio jsonb not null default '{}',
  …ts
);

create table fragments (
  id uuid pk, grove_id uuid not null references groves(id) on delete cascade,
  tier tier not null,                               -- weight and priority only (ADR 0003)
  is_ending boolean not null default false,         -- Root End
  title jsonb not null,
  location geography(Point,4326) not null,          -- staff only
  visibility fragment_visibility not null default 'marked',
  trigger_radius_m int not null check (trigger_radius_m between 10 and 100),
  marker_code text unique,                          -- required when protected
  story_order numeric not null,                     -- canonical narrative order for the Journal Story view
  gap_hint jsonb not null default '{}',             -- L10n: "A part of the story waits near the old pump house"
  introduced_in_ring_id uuid references rings(id),
  status publish_status not null default 'draft',   -- 'retired' hides from map, keeps Journal
  …ts,
  check (not is_ending or tier = 'root')
);
create index on fragments using gist (location);
-- trigger fn_fragment_guard: ST_Covers(grove.boundary, location); protected ⇒ marker_code not null

-- Prerequisites (ADR 0003): revealed ⇔ EVERY group has ≥1 member the device has completed.
-- No groups ⇒ revealed from the start. Layout parent (Journal) = lowest-sort member of lowest-sort group.
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
-- trigger fn_prereq_guard: required fragment in the same grove; not itself; no cycles

create table fragment_threads    (fragment_id uuid references fragments(id) on delete cascade,
                                  thread_id uuid references threads(id) on delete cascade,
                                  primary key (fragment_id, thread_id));
create table fragment_characters (fragment_id uuid references fragments(id) on delete cascade,
                                  character_id uuid references characters(id) on delete cascade,
                                  introduces boolean not null default false,  -- first meeting unlocks the character card
                                  primary key (fragment_id, character_id));

create table fragment_revisions (
  id uuid pk, fragment_id uuid not null references fragments(id) on delete cascade,
  revision_no int not null, ring_id uuid references rings(id),
  status publish_status not null default 'draft',
  publish_at timestamptz,                           -- scheduled release (e.g. Listening Day)
  requires_outcome_option_id uuid,                  -- FK in §7: only playable if this crossroads option won
  content_note jsonb not null default '{}', change_note jsonb not null default '{}',
  writer_notes text,
  created_by uuid references auth.users(id),
  …ts, unique (fragment_id, revision_no)
);

create table revision_versions (
  id uuid pk, revision_id uuid not null references fragment_revisions(id) on delete cascade,
  language lang not null,
  narration_asset_id uuid not null references audio_assets(id),
  transcript text not null, vtt text,
  …ts, unique (revision_id, language)
);

create table revision_contributors (
  revision_id uuid references fragment_revisions(id) on delete cascade,
  contributor_id uuid references contributors(id) on delete restrict,
  role text not null check (role in ('writer','narrator','storyteller','musician','translator','sound')),
  consent_id uuid not null references consents(id),
  primary key (revision_id, contributor_id, role)
);
```

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
  name text not null,                              -- "Red-winged blackbirds", "Reed wind bed"
  kind text not null check (kind in ('bed','oneshot')),
  gain_db_min numeric(4,1) not null default -18, gain_db_max numeric(4,1) not null default -10,
  pan_min numeric(3,2) not null default -0.8, pan_max numeric(3,2) not null default 0.8,
  pitch_cents_min int not null default -100, pitch_cents_max int not null default 100,
  mean_interval_s int,                             -- oneshot: mean seconds between events (exponential)
  min_interval_s int,                              -- oneshot: floor
  max_concurrent smallint not null default 2,
  no_repeat_last smallint not null default 2,      -- avoid repeating the last N assets
  crossfade_ms int not null default 4000,          -- bed
  time_windows time_window[] not null default '{dawn,day,dusk,night}',
  months smallint[] not null default '{1,2,3,4,5,6,7,8,9,10,11,12}',
  speaker_safe boolean not null default true,      -- false ⇒ only plays on headphones
  wildlife_call boolean not null default false,    -- true ⇒ never on speaker; muted in nesting months
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

create table ambience_zones (                      -- drawn polygons → profile
  id uuid pk, region_id uuid not null references regions(id),
  name text not null, boundary geography(Polygon,4326) not null,
  profile_id uuid not null references ambience_profiles(id),
  priority int not null default 100,               -- higher wins when overlapping
  edge_fade_m int not null default 40,
  status publish_status not null default 'draft',
  …ts
);
create index on ambience_zones using gist (boundary);

-- Fallback when no zone applies: land cover → profile
create table landcover_classes (
  code smallint primary key,                       -- NLCD codes (11 water, 21–24 developed, 41–43 forest, 52 shrub, 71 grass, 81–82 ag, 90/95 wetland …)
  name text not null,
  profile_id uuid references ambience_profiles(id)
);
create table landcover_grids (                     -- generated offline by tools/landcover; one file per region
  region_id uuid primary key references regions(id),
  h3_resolution smallint not null default 9,
  source text not null,                            -- e.g. 'NLCD 2021'
  file_path text not null,                         -- public-media/landcover/{region}/{version}.bin (h3 → class)
  version int not null, generated_at timestamptz not null
);

create table ui_cues (                             -- short UI voice cues (e.g. Hush "Listen.")
  id uuid pk,
  region_id uuid references regions(id),           -- null = global
  key text not null check (key in ('hush_listen')), -- new keys need a migration that extends the check
  language lang not null,
  asset_id uuid not null references audio_assets(id),
  status publish_status not null default 'draft',
  …ts,
  unique nulls not distinct (region_id, key, language)
);
-- Included in packs only when published and its asset is playable.
```

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

create table music_cues (                          -- a piece of music + when it applies
  id uuid pk, name text not null,
  music_zone_id uuid references music_zones(id) on delete cascade,
  grove_id uuid references groves(id) on delete cascade,   -- grove boundary acts as the zone
  priority int not null default 100,
  conditions jsonb not null default '{}',          -- zod MusicCondition (AUDIO_SPEC §4.2)
  min_dwell_s int not null default 45,
  crossfade_ms int not null default 6000,
  status publish_status not null default 'draft',
  …ts,
  check (num_nonnulls(music_zone_id, grove_id) = 1)  -- exactly one; pack has zone or useGroveBoundary, never both
);

create table music_cue_stems (                     -- 1..n synchronized stems per cue
  id uuid pk, cue_id uuid not null references music_cues(id) on delete cascade,
  asset_id uuid not null references audio_assets(id),
  role text not null default 'base',               -- 'base' | 'layer'
  gain_db numeric(4,1) not null default 0,
  state_gains jsonb not null default '[]',         -- zod StemRule[]: [{when: MusicCondition, gain_db}]
  …ts
);
```
All stems in a cue must have equal `duration_ms` and loop points (enforced at publish).

---

## 7. Participation layer (see PARTICIPATION_SPEC)
```sql
create table seed_terms (version int primary key, body jsonb not null, effective_at timestamptz not null);

create table questions (                           -- "Questions the Grove is asking"
  id uuid pk, grove_id uuid not null references groves(id) on delete cascade,
  ring_id uuid references rings(id),
  text jsonb not null,
  anchor_fragment_id uuid references fragments(id), anchor_character_id uuid references characters(id),
  requires_heard boolean not null default true,     -- visible only after the anchor fragment is heard
  opens_at timestamptz not null, closes_at timestamptz,
  status publish_status not null default 'draft',
  …ts
);

create table devices (
  id uuid primary key,                              -- random UUID generated on the phone; a bearer secret
  first_seen_at timestamptz not null default now(),
  platform text, app_version text, ui_language lang,
  attested_at timestamptz, attestation text check (attestation in ('app_attest','play_integrity')),
  age_gate text check (age_gate in ('under_13','13_17','18_plus','adult_for_family'))
);

create table seeds (
  id uuid pk,
  device_id uuid not null references devices(id) on delete cascade,
  client_seed_id uuid not null,
  grove_id uuid not null references groves(id),
  ring_id uuid references rings(id),                -- ring open at planting time
  anchor_fragment_id uuid references fragments(id), -- snapped on device; raw coordinates never sent
  planted_on_site boolean not null,                 -- true if planted inside the grove
  kind seed_kind not null,
  question_id uuid references questions(id), character_id uuid references characters(id),
  body text check (char_length(body) <= 1500),
  voice_path text,                                  -- private bucket seeds-voice/{id}.m4a (≤ 90 s)
  voice_duration_ms int,
  staff_transcript text,
  credit_name text check (char_length(credit_name) <= 60),
  credit_status text not null default 'pending' check (credit_status in ('pending','approved','rejected')),
  may_quote boolean not null default false,         -- words may be quoted (read by a narrator) in an Echo leaf
  may_use_voice boolean not null default false,     -- 18+ only: the recorded voice itself may be used in the story
  sound_grant boolean not null default false,       -- kind=sound: license to use the recording in ambience
  memory_contact text,                              -- kind=memory, optional, encrypted (pgsodium/Vault), purged after 90 d
  terms_version int not null references seed_terms(version),
  status seed_status not null default 'planted',
  flags text[] not null default '{}',               -- pii_stripped, sensitive_culture, real_person, private_story, safety
  themes text[] not null default '{}',
  planted_at timestamptz not null, body_added_at timestamptz, status_changed_at timestamptz,
  …ts,
  unique (device_id, client_seed_id),
  check (body is not null or voice_path is not null)
);
alter table asset_rights add constraint asset_rights_seed_fk foreign key (seed_id) references seeds(id);

create table seed_links (                          -- lineage: what a seed grew into
  id uuid pk, seed_id uuid not null references seeds(id) on delete cascade,
  revision_id uuid references fragment_revisions(id) on delete cascade,
  asset_id uuid references audio_assets(id) on delete cascade,       -- sound seed promoted into ambience
  crossroads_option_id uuid,                                          -- FK below
  question_id uuid references questions(id),
  note text,                                        -- internal: how it was used
  stage seed_status not null default 'sprouting',   -- sprouting until the target publishes, then grown
  …ts,
  check (num_nonnulls(revision_id, asset_id, crossroads_option_id, question_id) = 1)
);

create table crossroads (
  id uuid pk, grove_id uuid not null references groves(id) on delete cascade,
  ring_id uuid not null references rings(id),
  anchor_fragment_id uuid not null references fragments(id),   -- vote only after hearing it, on site
  prompt jsonb not null,                            -- "Should Mara cross the dike tonight?"
  teaser_asset_id uuid references audio_assets(id), -- optional narrated framing
  vote_radius_m int not null default 75,
  opens_at timestamptz not null, closes_at timestamptz not null,
  status crossroads_status not null default 'draft',
  outcome_option_id uuid,
  outcome_note jsonb not null default '{}',         -- public canon line, e.g. "Listeners chose: Mara stays."
  …ts
);
create table crossroads_options (
  id uuid pk, crossroads_id uuid not null references crossroads(id) on delete cascade,
  label jsonb not null, description jsonb not null default '{}',
  sort_order int not null default 0, …ts
);
alter table crossroads add constraint crossroads_outcome_fk foreign key (outcome_option_id) references crossroads_options(id);
alter table seed_links add constraint seed_links_option_fk foreign key (crossroads_option_id) references crossroads_options(id);
alter table fragment_revisions add constraint rev_outcome_fk foreign key (requires_outcome_option_id) references crossroads_options(id);

create table crossroads_votes (
  crossroads_id uuid references crossroads(id) on delete cascade,
  device_id uuid references devices(id) on delete cascade,
  option_id uuid not null references crossroads_options(id),
  voted_at timestamptz not null default now(),
  primary key (crossroads_id, device_id)            -- one vote per device
);

create table gatherings (                          -- in-person story circles (display only; registration on website)
  id uuid pk, grove_id uuid references groves(id), ring_id uuid references rings(id),
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

---

## 8. Operations tables
```sql
create table staff (user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null, role staff_role not null default 'viewer', active boolean not null default true, …ts);

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
  asset_hashes text[] not null, bytes_total bigint not null,
  built_at timestamptz not null default now(), reason text);

create table jobs (                                -- outbox; triggers/functions only insert rows
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('rebuild_pack','purge_asset')),
  payload jsonb not null,                          -- ids only, e.g. {grove_id} or {asset_sha}; never coordinates or codes
  status text not null default 'queued',
  attempts int not null default 0,
  last_error text,
  run_after timestamptz not null default now(),
  …ts
);
-- pg_cron every minute → pg_net → `run-jobs` edge function (idempotent, retries/backoff, max 5 attempts).
```
Region pack rebuilds bump `regions.pack_version` (same role as `groves.pack_version`).

---

## 9. Playability rules (SQL functions)
All are `stable` and `security definer`, owned by `postgres` (the migration owner, which owns the tables), with `search_path = ''` (or an explicit schema list) and fully qualified names. `revoke execute … from public`, then grant only what each function needs. Only `get_pack_index()` is granted to `anon`. No dedicated owner role: a separate role would need `BYPASSRLS`, which we can't reliably grant on Supabase.

**Expiry:** `expires_on is null` means the row never expires. An item expires when `expires_on < current_date` in the **region's** time zone (so the expiry job and playability agree).

- **`fn_asset_is_playable(asset_id)`**: at least one `asset_rights` row with `status='active'` and an unexpired `expires_on` (null = never expires). When the right is `consent_form`, its consent must also be active, unexpired and include `'app'`.
- **`fn_site_ok(site_id)`**: an active, unexpired `site_approvals` row exists.
- **`fn_revision_is_playable(revision_id)`** requires all of:
  - the revision is `published` with `publish_at ≤ now()`, and its fragment is neither `unpublished` nor `draft`
  - the grove is `published` and `fn_site_ok`
  - every `revision_contributors.consent_id` is active, unexpired and includes `'app'`
  - every version's `narration_asset_id` is playable
  - if `requires_outcome_option_id` is set, the crossroads is `decided` with that option as the outcome
- **`fn_current_revision(fragment_id)`**: the playable revision with the highest `revision_no`.
- **`fn_cue_is_playable(cue_id)`**: the cue is published, every stem asset is playable, and its zone or grove is published.
- **`fn_layer_assets_playable(layer_id)`**: the playable subset of a layer's assets.

---

## 10. Write paths and triggers
Publishing is two-phase so storage and the database can't disagree (via the `publish` edge function):

1. **`fn_publish_check(entity, ids[])`** — read-only; returns the checklist result (§11) plus `asset_shas_to_publish[]`.
2. The edge function copies each staged asset `staging-audio/{sha}` → `public-media/a/{sha}.{ext}`. If any copy fails, it stops and nothing is committed.
3. **`fn_publish_commit(entity, ids[])`** — in one transaction: re-runs the checks; sets statuses and `is_public`; sets `seed_links.stage='grown'` and `seeds.status='grown'` for linked targets; writes the audit log; **enqueues** `rebuild_pack` jobs.

| Event | Effect |
|---|---|
| Publish (check → copy → commit, above) | On commit success: statuses, public flags, grown links, audit; enqueue `rebuild_pack` |
| `consents` / `asset_rights` / `site_approvals` status leaves `active` (trigger) | Find affected assets, revisions and cues; recompute; for assets no longer playable set `is_public=false` and enqueue `purge_asset`; enqueue `rebuild_pack` for affected packs; audit. (`run-jobs` performs the Storage delete.) |
| Crossroads `closes_at` passes (pg_cron every 5 min) | Set `status='closed'` and enqueue `rebuild_pack` (pack carries status so devices stop offering the vote); the moderator confirms the tally → `decided` + `outcome_option_id` → enqueue another `rebuild_pack` (unlocks dependent revisions and cues) |
| Scheduled `publish_at` passes (pg_cron every 5 min) | Enqueue `rebuild_pack` for groves with newly playable revisions |
| Daily 02:00 regional time | Expire consents, rights and approvals (fires the trigger); purge `memory_contact` older than 90 days; delete `voice_path` files for seeds `resting` or `hidden` more than 30 days, or `grown` more than 180 days without `may_quote` |

Every pack rebuild bumps `groves.pack_version` or `regions.pack_version` and inserts a `pack_builds` row. Triggers and functions only **insert jobs**; they never call HTTP. `run-jobs` processes the outbox.

A grove may remain `published` with zero playable revisions after a later revocation. The checklist gates publish only; the pack builder must still emit a valid pack with whatever is playable (possibly none) and must not auto-unpublish.

---

## 11. Publish checklist (`fn_publish_check` returns `{ok, failures:[{code, severity:'error'|'warning', message, entity_id}], asset_shas_to_publish[]}`)
`ok` is true when there are no `error` entries. Warnings do not fail the check. `RADIUS_OVERLAP` and `LOUDNESS` are warnings; every other code is an error.

| Code | Rule |
|---|---|
| `NO_TRANSCRIPT` | Every revision version has a non-empty transcript |
| `NARRATION_RIGHTS` | Narration assets are playable |
| `CONSENT_APP` | Every revision contributor has consent covering `app` |
| `SITE_APPROVAL` | The grove's site is approved |
| `OUTSIDE_GROVE` | The fragment is inside the grove polygon |
| `PREREQ_UNPUBLISHED` | Every prerequisite group has ≥1 member that is `published` or `retired`, or in the same batch |
| `EMPTY_PREREQ_GROUP` | Every prerequisite group has at least one member |
| `NO_START` | The grove has at least one published fragment with no prerequisite groups |
| `PROTECTED_NO_CODE` | Protected fragments have a `marker_code` |
| `RADIUS_OVERLAP` (warning) | Two marked or unmarked fragments' radii overlap, unless one must precede the other (ADR 0003 §4) |
| `STEM_MISMATCH` | Cue stems differ in duration or loop points |
| `LOUDNESS` (warning) | An asset deviates from its target LUFS by more than ±2 LU (AUDIO_SPEC §6) |
| `WILDLIFE_SPEAKER` | A layer with `wildlife_call=true` and `speaker_safe=true` is not allowed |
| `CONDITION_SCHEMA` | Cue `conditions` and `state_gains` validate against zod |
| `OUTCOME_REF` | `requires_outcome_option_id` belongs to a crossroads in the same grove |

---

## 12. Content packs (the delivery format)

### 12.1 Grove pack
`public-media/packs/grove/{grove_id}/{pack_version}.json`, built by the `build-pack` edge function. zod `GrovePack`:
```ts
{
  schema: 1, groveId, packVersion, builtAt,
  grove: { id, name, premise, accessNotes, boundary: GeoJSON.Polygon, site: {name, accessInfo, websiteUrl, gatheringsUrl},
           growthCueAssetSha?: string },
  rings: [{ id, ringNo, name, themeNote, status, plantingOpensAt, plantingClosesAt, releasedAt, writerNoteSha? }],
  characters: [{ id, publicName, publicBio, introducedByFragmentIds: string[] }],   // public fields only
  fragments: [{ id, tier, isEnding, requires: string[][],   // AND of OR groups (ADR 0003); unknown ids = never completed
                title, visibility, storyOrder, gapHint, retired,
                lat?, lng?, radiusM?,          // omitted when protected
                markerHash?,                    // sha256(marker_code) when protected
                threadIds, characterIds }],
  revisions: [{ id, fragmentId, revisionNo, ringId, publishAt, contentNote, changeNote,
                versions: [{ lang, assetSha, durationMs, bytes, transcript, vtt? }],
                credits: [{ display, role, license? }],
                grownFromSeedCount: number }],  // all playable revisions (older ones for the Journal)
  currentRevisionByFragment: Record<fragmentId, revisionId>,
  questions: [{ id, ringId, text, anchorFragmentId?, anchorCharacterId?, requiresHeard, opensAt, closesAt }],
  crossroads: [{ id, ringId, anchorFragmentId, prompt, teaserSha?, voteRadiusM, opensAt, closesAt, status,
                 options: [{id, label, description}], outcome?: {optionId, note} }],
  music: { cues: [{ id, zone?: GeoJSON.Polygon, useGroveBoundary: boolean, priority, conditions, minDwellS, crossfadeMs,
                    stems: [{ assetSha, role, gainDb, stateGains, loopStartMs, loopEndMs }] }] },
  ambienceZones: [{ id, boundary, profileSlug, priority, edgeFadeM }],   // zones intersecting grove bbox + 1 km
  ledger: [{ ringId, growers: string[], anonymousCount: number, seedsPlanted: number, seedsGrown: number }],
  gatherings: [{ title, startsAt, url }],
  assets: [{ sha, ext, bytes, kind }]   // everything this pack references
}
```

### 12.2 Region pack
`public-media/packs/region/{region_id}/{version}.json`, zod `RegionPack`:
- `ambienceProfiles` with their layers and asset shas (filtered to playable)
- `landcover: {gridSha, h3Resolution, classes:[{code, profileSlug}]}`
- region-wide `ambienceZones` and `musicZones`/cues not tied to a grove
- `uiCues` (e.g. the "Listen." hush voice cue)
- `assets`

### 12.3 Index
`get_pack_index()` RPC (granted to `anon`) returns `[{scope, id, version, manifestPath, manifestSha256, bytesTotal, name, bbox}]`. It's the only live query devices need besides writes.

### 12.4 Rules
- Packs **never** include: protected coordinates, marker codes (only their hashes), contributor PII, seed text or voice, vote counts before a crossroads is decided, or seed credit names not yet `approved`.
- The ledger's `approved` credit rule applies to **seed** credit names (`seeds.credit_name` with `credit_status = 'approved'`). Revision credits use `contributors.display_credit`, which the contributor chose in their consent; an active consent is the approval for those credits.
- The device must delete any local asset whose sha isn't in the union of the current manifests (mandatory on sync; this is how revocation reaches phones).
- Assets are immutable by sha, so CDN caching is safe. Manifests are versioned paths and are never overwritten.

---

## 13. Row-level security and storage
- RLS is on for **every** table. `anon` has no table grants. It may execute `get_pack_index`, read `public-media`, and call the device edge functions.
- Staff policy helper `has_role(roles staff_role[])`:

| Role | Can |
|---|---|
| `viewer` | Read content, dashboards, seeds (not `memory_contact`) |
| `moderator` | Viewer + seed status, flags, `credit_status`, crossroads tally confirmation |
| `writer` | Viewer + draft or in-review revisions, versions, threads, characters, questions, seed themes and links |
| `sound` | Viewer + audio assets, ambience profiles, layers, zones, music zones, cues, stems |
| `editor` | Everything above + groves, fragments, rings, crossroads, contributors, consents, rights, approvals, publish |
| `admin` | Everything, including `staff` and audit export |

- Column privacy: `contributors.legal_name/contact_*`, `consents.document_path`, `seeds.memory_contact` are readable by editor and admin only (use a security-definer view for others).
- Buckets:

| Bucket | Read | Write |
|---|---|---|
| `public-media` (`a/{sha}.{ext}`, `packs/…`, `landcover/…`, `map-style/…`) | public | service role only (through publish and build functions) |
| `staging-audio` | writer, sound, editor, admin | writer, sound, editor, admin |
| `seeds-voice` | moderator, writer, editor, admin | service role (seed upload uses a signed upload URL issued by `plant-seed`) |
| `private-docs` | editor, admin | editor, admin |

---

## 14. Device-local database (SQLite, never synced)
| Table | Purpose |
|---|---|
| `packs (scope, id, version, manifest_json, installed_at)` | Installed manifests |
| `assets (sha, ext, bytes, local_uri, last_used_at)` | Content-addressed audio cache |
| `heard (fragment_id, revision_id, first_heard_at, last_heard_at, max_progress, completed_at, heard_on_site, time_window, session_id)` | Unlock state and Journal. Only `completed_at is not null` counts as heard (ADR 0003 §3) |
| `visits (session_id, grove_id, started_at, ended_at, fragments_heard, seeds_planted, time_window)` | Journal Visits view |
| `field_notes (id, fragment_id, text, voice_uri, created_at)` | Private notes (JOURNAL_SPEC §5) |
| `my_seeds (client_seed_id, grove_id, anchor_fragment_id, kind, body, voice_uri, credit_name, status, links_json, planted_at, synced)` | Your seeds and their lineage |
| `my_votes (crossroads_id, option_id, voted_at, synced)` | |
| `met_characters (character_id, met_at, fragment_id)` | |
| `event_queue`, `checkin_queue`, `kv` | |

Journal export and import: an encrypted JSON file (AES-GCM with a user passphrase) containing `heard`, `visits`, `field_notes`, `my_seeds`, `my_votes`, `met_characters` and `device_id`, for moving to a new phone.

---

## 15. Seed data (`supabase/seed.sql`)
- Region `wasatch-front`; three real sites in `draft` with **TODO placeholder** coordinates.
- **Test grove at the Farmington Bird Refuge (test content only):** geometry, fragments and prerequisites come from `supabase/fixtures/farmington-bird-refuge.json` (JoJo's test chain, Frags 1–7, plus Frags 8–10 covering unmarked, protected `DEMO-001`, an OR group and an outcome-gated revision)
  - one published grove; Ring 1 `planting`
  - 2 characters, 1 open question, 1 open crossroads anchored on a branch
  - 2 ambience profiles (Marsh, Urban), each with a bed and 2 oneshot layers using CC0 test sounds; a marsh ambience zone over the grove
  - a music zone with 2 cues (default; `tiers:['branch']`), each with a base and a layer stem
  - test-tone narration, a demo contributor and consent, an active site approval, `seed_terms` v1
- A landcover fixture grid for the test grove.
- `apps/mobile/e2e/demo-route.gpx`, generated from the same fixture: it visits the fragments in an order that satisfies every prerequisite, **dwells at each one for its narration length + 5 s** (completion needs the whole fragment), never enters the protected fragment's radius, and crosses the zone edges.
- **Never seed real stories or real wildlife recordings without a license.**
