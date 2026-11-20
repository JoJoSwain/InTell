-- Crafted bad cases for major fn_publish_check codes (ADR 0003).
begin;
select plan(12);

-- WILDLIFE_SPEAKER
update public.ambience_layers
   set wildlife_call = true, speaker_safe = true
 where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000083';

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.fn_publish_check(
        'ambience_layer',
        array['aaaaaaaa-bbbb-4ccc-8ddd-000000000083'::uuid]
      )->'failures'
    ) f
    where f->>'code' = 'WILDLIFE_SPEAKER'
      and f->>'severity' = 'error'
  ),
  'WILDLIFE_SPEAKER fires'
);

update public.ambience_layers
   set wildlife_call = false, speaker_safe = true
 where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000083';

-- STEM_MISMATCH: alter one stem asset duration
update public.audio_assets
   set duration_ms = 9000
 where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000121';

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.fn_publish_check(
        'music_cue',
        array['aaaaaaaa-bbbb-4ccc-8ddd-000000000091'::uuid]
      )->'failures'
    ) f
    where f->>'code' = 'STEM_MISMATCH'
      and f->>'severity' = 'error'
  ),
  'STEM_MISMATCH fires'
);

update public.audio_assets
   set duration_ms = 8000
 where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000121';

-- CONDITION_SCHEMA: conditions must be object
update public.music_cues
   set conditions = '[]'::jsonb
 where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000091';

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.fn_publish_check(
        'music_cue',
        array['aaaaaaaa-bbbb-4ccc-8ddd-000000000091'::uuid]
      )->'failures'
    ) f
    where f->>'code' = 'CONDITION_SCHEMA'
      and f->>'severity' = 'error'
  ),
  'CONDITION_SCHEMA fires'
);

update public.music_cues
   set conditions = '{}'::jsonb
 where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000091';

-- NO_TRANSCRIPT
update public.revision_versions
   set transcript = '   '
 where revision_id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000040';

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.fn_publish_check(
        'revision',
        array['aaaaaaaa-bbbb-4ccc-8ddd-000000000040'::uuid]
      )->'failures'
    ) f
    where f->>'code' = 'NO_TRANSCRIPT'
      and f->>'severity' = 'error'
  ),
  'NO_TRANSCRIPT fires'
);

update public.revision_versions
   set transcript = 'TEST transcript — frag1 Beginning narration tone.'
 where revision_id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000040';

-- LOUDNESS warning on narration (target -16 ±2)
update public.audio_assets
   set loudness_lufs = -30
 where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000100';

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.fn_publish_check(
        'revision',
        array['aaaaaaaa-bbbb-4ccc-8ddd-000000000040'::uuid]
      )->'failures'
    ) f
    where f->>'code' = 'LOUDNESS'
      and f->>'severity' = 'warning'
  ),
  'LOUDNESS is severity warning'
);

update public.audio_assets
   set loudness_lufs = -16
 where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000100';

-- SITE_APPROVAL
update public.site_approvals
   set status = 'expired'
 where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000006';

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.fn_publish_check(
        'revision',
        array['aaaaaaaa-bbbb-4ccc-8ddd-000000000040'::uuid]
      )->'failures'
    ) f
    where f->>'code' = 'SITE_APPROVAL'
      and f->>'severity' = 'error'
  ),
  'SITE_APPROVAL fires'
);

update public.site_approvals
   set status = 'active'
 where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000006';

-- PREREQ_UNPUBLISHED: unpublish both OR members of frag10 → fails
update public.fragments
   set status = 'draft'
 where id in (
   'aaaaaaaa-bbbb-4ccc-8ddd-000000000037',
   'aaaaaaaa-bbbb-4ccc-8ddd-000000000038'
 );

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.fn_publish_check(
        'revision',
        array['aaaaaaaa-bbbb-4ccc-8ddd-000000000049'::uuid]
      )->'failures'
    ) f
    where f->>'code' = 'PREREQ_UNPUBLISHED'
      and f->>'severity' = 'error'
  ),
  'PREREQ_UNPUBLISHED fires when OR group has no published member'
);

-- OR group: one member published ⇒ passes PREREQ_UNPUBLISHED
update public.fragments
   set status = 'published'
 where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000038';

select ok(
  not exists (
    select 1
    from jsonb_array_elements(
      public.fn_publish_check(
        'revision',
        array['aaaaaaaa-bbbb-4ccc-8ddd-000000000049'::uuid]
      )->'failures'
    ) f
    where f->>'code' = 'PREREQ_UNPUBLISHED'
  ),
  'PREREQ_UNPUBLISHED passes when one OR member is published'
);

update public.fragments
   set status = 'published'
 where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000037';

-- EMPTY_PREREQ_GROUP
insert into public.fragment_prereq_groups (id, fragment_id, sort_order)
values ('aaaaaaaa-bbbb-4ccc-8ddd-ffff00000050', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000030', 50);

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.fn_publish_check(
        'revision',
        array['aaaaaaaa-bbbb-4ccc-8ddd-000000000040'::uuid]
      )->'failures'
    ) f
    where f->>'code' = 'EMPTY_PREREQ_GROUP'
      and f->>'severity' = 'error'
  ),
  'EMPTY_PREREQ_GROUP fires'
);

delete from public.fragment_prereq_groups
 where id = 'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000050';

-- NO_START: draft the only start fragment (frag1 has no prereq groups)
update public.fragments
   set status = 'draft'
 where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000030';

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.fn_publish_check(
        'revision',
        array['aaaaaaaa-bbbb-4ccc-8ddd-000000000041'::uuid]
      )->'failures'
    ) f
    where f->>'code' = 'NO_START'
      and f->>'severity' = 'error'
  ),
  'NO_START fires'
);

update public.fragments
   set status = 'published'
 where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000030';

-- RADIUS_OVERLAP exempt for must-precede pair (Beginning / Buildings 1 overlap)
select ok(
  not exists (
    select 1
    from jsonb_array_elements(
      public.fn_publish_check(
        'revision',
        array['aaaaaaaa-bbbb-4ccc-8ddd-000000000040'::uuid]
      )->'failures'
    ) f
    where f->>'code' = 'RADIUS_OVERLAP'
      and (
        (f->>'entity_id' = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000030'
         and f->>'other_id' = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000031')
        or
        (f->>'entity_id' = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000031'
         and f->>'other_id' = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000030')
      )
  )
  and exists (
    select 1
    from public.fragments f1
    join public.fragments f2 on f2.id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000031'
    where f1.id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000030'
      and extensions.ST_DWithin(
            f1.location, f2.location,
            f1.trigger_radius_m + f2.trigger_radius_m
          )
      and public.fn_must_precede(f1.id, f2.id)
  ),
  'RADIUS_OVERLAP exempt for must-precede overlapping pair'
);

-- RADIUS_OVERLAP still fires for independent overlapping pair (frag3 / frag4)
select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.fn_publish_check(
        'revision',
        array['aaaaaaaa-bbbb-4ccc-8ddd-000000000042'::uuid]
      )->'failures'
    ) f
    where f->>'code' = 'RADIUS_OVERLAP'
      and f->>'severity' = 'warning'
      and f->>'entity_id' = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000032'
      and f->>'other_id' = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000033'
  ),
  'RADIUS_OVERLAP fires for independent overlapping pair'
);

select * from finish();
rollback;
