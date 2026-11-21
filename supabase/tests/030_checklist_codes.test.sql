-- Crafted cases for fn_publish_check(p_release_id) codes (DATA_MODEL §11, M3a R2).
begin;
select plan(16);

select set_config('request.jwt.claim.role', 'service_role', true);

-- Helper release for dependency-only cases
insert into public.releases (id, name, status)
values ('aaaaaaaa-bbbb-4ccc-8ddd-ffff00000090', 'pgtap-deps', 'draft');

-- WILDLIFE_SPEAKER
update public.ambience_layers
   set wildlife_call = true, speaker_safe = true
 where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000083';

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.fn_publish_check('aaaaaaaa-bbbb-4ccc-8ddd-0000000000e0')->'failures'
    ) f
    where f->>'code' = 'WILDLIFE_SPEAKER' and f->>'severity' = 'error'
  ),
  'WILDLIFE_SPEAKER fires'
);

update public.ambience_layers
   set wildlife_call = false, speaker_safe = true
 where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000083';

-- STEM_MISMATCH
update public.audio_assets
   set duration_ms = 9000
 where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000121';

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.fn_publish_check('aaaaaaaa-bbbb-4ccc-8ddd-0000000000e0')->'failures'
    ) f
    where f->>'code' = 'STEM_MISMATCH' and f->>'severity' = 'error'
  ),
  'STEM_MISMATCH fires'
);

update public.audio_assets
   set duration_ms = 8000
 where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000121';

-- NO_TRANSCRIPT
update public.revision_versions
   set transcript = '   '
 where revision_id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000040';

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.fn_publish_check('aaaaaaaa-bbbb-4ccc-8ddd-0000000000e0')->'failures'
    ) f
    where f->>'code' = 'NO_TRANSCRIPT' and f->>'severity' = 'error'
  ),
  'NO_TRANSCRIPT fires'
);

update public.revision_versions
   set transcript = 'TEST transcript — frag1 Beginning day narration tone.'
 where revision_id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000040';

-- LOUDNESS warning
update public.audio_assets set loudness_lufs = null
 where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000100';

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.fn_publish_check('aaaaaaaa-bbbb-4ccc-8ddd-0000000000e0')->'failures'
    ) f
    where f->>'code' = 'LOUDNESS' and f->>'severity' = 'warning'
  ),
  'LOUDNESS warns when unmeasured'
);

update public.audio_assets set loudness_lufs = -16
 where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000100';

-- NO_TEASER
update public.fragments set teaser = '{}'::jsonb
 where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000030';

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.fn_publish_check('aaaaaaaa-bbbb-4ccc-8ddd-0000000000e0')->'failures'
    ) f
    where f->>'code' = 'NO_TEASER' and f->>'severity' = 'error'
  ),
  'NO_TEASER fires'
);

update public.fragments
   set teaser = '{"en":"Beginning teaser."}'::jsonb
 where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000030';

-- PHYSICAL_NO_CODE: guards + check block null marker; disable briefly to simulate bad row (rollback restores)
alter table public.fragments drop constraint physical_requires_marker_code;
alter table public.fragments disable trigger user;
update public.fragments set marker_code = null
 where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000038';
alter table public.fragments enable trigger user;

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.fn_publish_check('aaaaaaaa-bbbb-4ccc-8ddd-0000000000e0')->'failures'
    ) f
    where f->>'code' = 'PHYSICAL_NO_CODE' and f->>'severity' = 'error'
  ),
  'PHYSICAL_NO_CODE fires'
);

alter table public.fragments disable trigger user;
update public.fragments set marker_code = 'DEM00001'
 where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000038';
alter table public.fragments enable trigger user;
alter table public.fragments
  add constraint physical_requires_marker_code
  check (visibility <> 'physical' or marker_code is not null);

-- NO_ALT_TEXT
update public.image_assets set alt_text = '{}'::jsonb
 where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000140';

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.fn_publish_check('aaaaaaaa-bbbb-4ccc-8ddd-0000000000e0')->'failures'
    ) f
    where f->>'code' = 'NO_ALT_TEXT' and f->>'severity' = 'error'
  ),
  'NO_ALT_TEXT fires'
);

update public.image_assets
   set alt_text = '{"en":"Portrait A alt"}'::jsonb
 where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000140';

-- PREREQ_UNPUBLISHED: OR members must be published or in release (not just listed in release_items)
delete from public.release_items
 where release_id = 'aaaaaaaa-bbbb-4ccc-8ddd-0000000000e0'
   and entity = 'fragment'
   and entity_id in (
     'aaaaaaaa-bbbb-4ccc-8ddd-000000000037',
     'aaaaaaaa-bbbb-4ccc-8ddd-000000000038'
   );

update public.published_snapshots
   set data = jsonb_set(data, '{status}', '"unpublished"')
 where entity = 'fragment'
   and entity_id in (
     'aaaaaaaa-bbbb-4ccc-8ddd-000000000037',
     'aaaaaaaa-bbbb-4ccc-8ddd-000000000038'
   );

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.fn_publish_check('aaaaaaaa-bbbb-4ccc-8ddd-0000000000e0')->'failures'
    ) f
    where f->>'code' = 'PREREQ_UNPUBLISHED' and f->>'severity' = 'error'
      and f->>'entity_id' = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000039'
  ),
  'PREREQ_UNPUBLISHED fires when OR group has no published member'
);

update public.published_snapshots
   set data = jsonb_set(data, '{status}', '"published"')
 where entity = 'fragment' and entity_id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000038';

select ok(
  not exists (
    select 1
    from jsonb_array_elements(
      public.fn_publish_check('aaaaaaaa-bbbb-4ccc-8ddd-0000000000e0')->'failures'
    ) f
    where f->>'code' = 'PREREQ_UNPUBLISHED'
      and f->>'entity_id' = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000039'
  ),
  'PREREQ_UNPUBLISHED passes when one OR member is published'
);

update public.published_snapshots
   set data = jsonb_set(data, '{status}', '"published"')
 where entity = 'fragment' and entity_id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000037';

-- EMPTY_PREREQ_GROUP
insert into public.fragment_prereq_groups (id, fragment_id, sort_order)
values ('aaaaaaaa-bbbb-4ccc-8ddd-ffff00000050', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000030', 50);

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.fn_publish_check('aaaaaaaa-bbbb-4ccc-8ddd-0000000000e0')->'failures'
    ) f
    where f->>'code' = 'EMPTY_PREREQ_GROUP' and f->>'severity' = 'error'
  ),
  'EMPTY_PREREQ_GROUP fires'
);

delete from public.fragment_prereq_groups
 where id = 'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000050';

-- DEPENDENCY_UNPUBLISHED: revision without fragment in release or published
delete from public.release_items where release_id = 'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000090';
update public.published_snapshots
   set data = jsonb_set(data, '{status}', '"unpublished"')
 where entity = 'fragment' and entity_id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000030';
insert into public.release_items (release_id, entity, entity_id) values
  ('aaaaaaaa-bbbb-4ccc-8ddd-ffff00000090', 'revision', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000040');

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.fn_publish_check('aaaaaaaa-bbbb-4ccc-8ddd-ffff00000090')->'failures'
    ) f
    where f->>'code' = 'DEPENDENCY_UNPUBLISHED'
      and f->>'entity' = 'fragment'
      and f->>'entity_id' = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000030'
  ),
  'DEPENDENCY_UNPUBLISHED: revision needs fragment in release or published'
);

update public.published_snapshots
   set data = jsonb_set(data, '{status}', '"published"')
 where entity = 'fragment' and entity_id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000030';

-- DEPENDENCY_UNPUBLISHED: fragment without grove
delete from public.release_items where release_id = 'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000090';
update public.published_snapshots
   set data = jsonb_set(data, '{status}', '"unpublished"')
 where entity = 'grove' and entity_id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000010';
insert into public.release_items (release_id, entity, entity_id) values
  ('aaaaaaaa-bbbb-4ccc-8ddd-ffff00000090', 'fragment', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000030');

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.fn_publish_check('aaaaaaaa-bbbb-4ccc-8ddd-ffff00000090')->'failures'
    ) f
    where f->>'code' = 'DEPENDENCY_UNPUBLISHED'
      and f->>'entity' = 'grove'
  ),
  'DEPENDENCY_UNPUBLISHED: fragment needs grove in release or published'
);

update public.published_snapshots
   set data = jsonb_set(data, '{status}', '"published"')
 where entity = 'grove' and entity_id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000010';

-- DEPENDENCY_UNPUBLISHED: fragment missing linked character
delete from public.release_items where release_id = 'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000090';
insert into public.release_items (release_id, entity, entity_id) values
  ('aaaaaaaa-bbbb-4ccc-8ddd-ffff00000090', 'grove', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000010'),
  ('aaaaaaaa-bbbb-4ccc-8ddd-ffff00000090', 'fragment', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000031');

update public.published_snapshots
   set data = jsonb_set(data, '{status}', '"unpublished"')
 where entity = 'character' and entity_id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000021';

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.fn_publish_check('aaaaaaaa-bbbb-4ccc-8ddd-ffff00000090')->'failures'
    ) f
    where f->>'code' = 'DEPENDENCY_UNPUBLISHED'
      and f->>'entity' = 'fragment'
  ),
  'DEPENDENCY_UNPUBLISHED: fragment linked character must be published or in release'
);

update public.published_snapshots
   set data = jsonb_set(data, '{status}', '"published"')
 where entity = 'character' and entity_id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000021';

-- DEPENDENCY_UNPUBLISHED: character portrait image
delete from public.release_items where release_id = 'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000090';
insert into public.release_items (release_id, entity, entity_id) values
  ('aaaaaaaa-bbbb-4ccc-8ddd-ffff00000090', 'character', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000020');

delete from public.release_items
 where release_id = 'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000090'
   and entity = 'image';

delete from public.published_snapshots
 where entity = 'image' and entity_id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000140';

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.fn_publish_check('aaaaaaaa-bbbb-4ccc-8ddd-ffff00000090')->'failures'
    ) f
    where f->>'code' = 'DEPENDENCY_UNPUBLISHED'
      and f->>'entity' = 'character'
  ),
  'DEPENDENCY_UNPUBLISHED: character portrait image must be published or in release'
);

-- DEPENDENCY_UNPUBLISHED: music cue needs music_zone
delete from public.release_items where release_id = 'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000090';
insert into public.release_items (release_id, entity, entity_id) values
  ('aaaaaaaa-bbbb-4ccc-8ddd-ffff00000090', 'music_cue', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000091');

delete from public.published_snapshots
 where entity = 'music_zone' and entity_id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000090';

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.fn_publish_check('aaaaaaaa-bbbb-4ccc-8ddd-ffff00000090')->'failures'
    ) f
    where f->>'code' = 'DEPENDENCY_UNPUBLISHED'
      and f->>'entity' = 'music_cue'
  ),
  'DEPENDENCY_UNPUBLISHED: music_cue needs music_zone published or in release'
);

-- DEPENDENCY_UNPUBLISHED: ambience_zone needs profile
delete from public.release_items where release_id = 'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000090';
insert into public.release_items (release_id, entity, entity_id) values
  ('aaaaaaaa-bbbb-4ccc-8ddd-ffff00000090', 'ambience_zone', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000082');

delete from public.release_items ri
 using public.ambience_zones z
 where ri.release_id = 'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000090'
   and ri.entity = 'ambience_profile'
   and ri.entity_id = z.profile_id
   and z.id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000082';

delete from public.published_snapshots
 where entity = 'ambience_profile' and entity_id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000080';

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.fn_publish_check('aaaaaaaa-bbbb-4ccc-8ddd-ffff00000090')->'failures'
    ) f
    where f->>'code' = 'DEPENDENCY_UNPUBLISHED'
      and f->>'entity' = 'ambience_zone'
  ),
  'DEPENDENCY_UNPUBLISHED: ambience_zone needs profile published or in release'
);

select * from finish();
rollback;