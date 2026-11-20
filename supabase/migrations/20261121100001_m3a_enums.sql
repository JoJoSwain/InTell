-- M3a: enum migrations (DATA_MODEL v3 §1; review A24)
-- Pattern per enum: create new type → alter columns USING CASE → drop old → rename new.
-- time_window dawn/dusk drop is deferred to m3a_ambience_music (array → scalar split).

-- ---------------------------------------------------------------------------
-- New enums (no prior dependents)
-- ---------------------------------------------------------------------------
create type public.change_kind as enum ('contingency', 'correction');
create type public.character_prominence as enum ('major', 'minor');
create type public.release_status as enum (
  'draft', 'scheduled', 'publishing', 'published', 'failed', 'cancelled'
);
create type public.entry_kind as enum ('next', 'character', 'noticed', 'answer', 'memory');
create type public.entry_status as enum (
  'submitted', 'read', 'sprouting', 'grown', 'resting', 'hidden'
);

-- ---------------------------------------------------------------------------
-- fragment_visibility: marked/unmarked → standard, protected → physical
-- Drop CHECK that references 'protected' before remapping.
-- ---------------------------------------------------------------------------
alter table public.fragments
  drop constraint if exists protected_requires_marker_code;

-- Staff views that embed the old visibility labels (rewritten in m3a_rls)
drop view if exists public.fragments_staff;

create type public.fragment_visibility_new as enum ('standard', 'physical');

alter table public.fragments
  alter column visibility drop default;

alter table public.fragments
  alter column visibility type public.fragment_visibility_new
  using (
    case visibility::text
      when 'protected' then 'physical'::public.fragment_visibility_new
      else 'standard'::public.fragment_visibility_new  -- marked, unmarked
    end
  );

alter table public.fragments
  alter column visibility set default 'standard'::public.fragment_visibility_new;

drop type public.fragment_visibility;
alter type public.fragment_visibility_new rename to fragment_visibility;

-- physical ⇒ marker_code (replaces protected_requires_marker_code)
alter table public.fragments
  add constraint physical_requires_marker_code
  check (visibility <> 'physical' or marker_code is not null);

-- ---------------------------------------------------------------------------
-- asset_kind: writer_note → growth_cue
-- ---------------------------------------------------------------------------
create type public.asset_kind_new as enum (
  'narration', 'sfx_oneshot', 'sfx_bed', 'music_stem', 'voice_cue', 'growth_cue'
);

alter table public.audio_assets
  alter column kind type public.asset_kind_new
  using (
    case kind::text
      when 'writer_note' then 'growth_cue'::public.asset_kind_new
      else kind::text::public.asset_kind_new
    end
  );

drop type public.asset_kind;
alter type public.asset_kind_new rename to asset_kind;

-- Unused enums (rights_status, approval_status, asset_source, license_kind,
-- ring_status, seed_kind, seed_status, crossroads_status) drop after dependents
-- are removed in later migrations.
