-- M3e: NO_PORTRAIT, NO_HOME_GROVE, NO_CHANGE_TEASER, NO_TIME_HINT, NO_ROOT
-- with publish/draft parity; A15 second-window transition; G3 context keys.
begin;
select plan(15);

select set_config('request.jwt.claim.role', 'service_role', true);

-- Seed release that includes Farmington story graph
-- (aaaaaaaa-bbbb-4ccc-8ddd-0000000000e0 from seed)

-- NO_PORTRAIT fires and clears
update public.characters
   set portrait_image_id = null
 where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000020';

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.fn_publish_check('aaaaaaaa-bbbb-4ccc-8ddd-0000000000e0')->'failures'
    ) f
    where f->>'code' = 'NO_PORTRAIT' and f->>'entity_id' = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000020'
  ),
  'NO_PORTRAIT fires on publish_check'
);

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.fn_draft_check('aaaaaaaa-bbbb-4ccc-8ddd-000000000010')->'failures'
    ) f
    where f->>'code' = 'NO_PORTRAIT'
  ),
  'NO_PORTRAIT fires on draft_check (parity)'
);

update public.characters
   set portrait_image_id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000140'
 where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000020';

-- NO_HOME_GROVE
update public.characters
   set home_grove_id = null
 where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000020';

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.fn_publish_check('aaaaaaaa-bbbb-4ccc-8ddd-0000000000e0')->'failures'
    ) f
    where f->>'code' = 'NO_HOME_GROVE'
      and f->>'character_id' = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000020'
  ),
  'NO_HOME_GROVE fires with character_id context'
);

update public.characters
   set home_grove_id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000010'
 where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000020';

-- NO_CHANGE_TEASER on contingency after rev 1 (frag10 r2)
update public.fragment_revisions
   set change_teaser = '{}'::jsonb
 where id = 'aaaaaaaa-bbbb-4ccc-8ddd-00000000004a';

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.fn_publish_check('aaaaaaaa-bbbb-4ccc-8ddd-0000000000e0')->'failures'
    ) f
    where f->>'code' = 'NO_CHANGE_TEASER'
      and f ? 'grove_id'
      and f ? 'fragment_id'
  ),
  'NO_CHANGE_TEASER fires with grove/fragment context'
);

update public.fragment_revisions
   set change_teaser = '{"en":"TEST change teaser restored"}'::jsonb
 where fragment_id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000039'
   and revision_no = 2;

-- A15: on a draft revision, adding the second window requires both hints
insert into public.fragment_revisions (
  id, fragment_id, revision_no, status, change_kind, change_note, change_teaser
) values (
  'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000a15',
  'aaaaaaaa-bbbb-4ccc-8ddd-000000000037',
  2,
  'draft',
  'correction',
  'A15 draft',
  '{}'::jsonb
);

insert into public.revision_versions (
  revision_id, language, time_window, narration_asset_id, transcript, other_time_hint
)
select
  'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000a15',
  'en', 'day', v.narration_asset_id, 'TEST A15 day', '{}'::jsonb
from public.revision_versions v
where v.revision_id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000047'
  and v.time_window = 'day'
limit 1;

-- Day-only draft: no NO_TIME_HINT yet
select ok(
  not exists (
    select 1
    from jsonb_array_elements(
      public.fn_draft_check('aaaaaaaa-bbbb-4ccc-8ddd-000000000010')->'failures'
    ) f
    where f->>'code' = 'NO_TIME_HINT'
      and f->>'entity_id' = 'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000a15'
  ),
  'A15: day-only draft has no NO_TIME_HINT'
);

insert into public.revision_versions (
  revision_id, language, time_window, narration_asset_id, transcript, other_time_hint
)
select
  'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000a15',
  'en', 'night', v.narration_asset_id, 'TEST A15 night', '{}'::jsonb
from public.revision_versions v
where v.revision_id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000047'
  and v.time_window = 'day'
limit 1;

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.fn_draft_check('aaaaaaaa-bbbb-4ccc-8ddd-000000000010')->'failures'
    ) f
    where f->>'code' = 'NO_TIME_HINT'
      and f->>'entity_id' = 'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000a15'
      and f ? 'grove_id'
  ),
  'A15: NO_TIME_HINT after adding second window on draft revision'
);

-- Put the draft revision in a throwaway release and confirm publish_check parity
insert into public.releases (id, name, status)
values ('aaaaaaaa-bbbb-4ccc-8ddd-ffff00000a16', 'a15-parity', 'draft');
insert into public.release_items (release_id, entity, entity_id) values
  ('aaaaaaaa-bbbb-4ccc-8ddd-ffff00000a16', 'revision', 'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000a15'),
  ('aaaaaaaa-bbbb-4ccc-8ddd-ffff00000a16', 'fragment', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000037'),
  ('aaaaaaaa-bbbb-4ccc-8ddd-ffff00000a16', 'grove', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000010');

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.fn_publish_check('aaaaaaaa-bbbb-4ccc-8ddd-ffff00000a16')->'failures'
    ) f
    where f->>'code' = 'NO_TIME_HINT'
      and f->>'entity_id' = 'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000a15'
  ),
  'A15: NO_TIME_HINT also on publish_check (parity)'
);

update public.revision_versions
   set other_time_hint = case
     when time_window = 'day' then '{"en":"At night, another telling."}'::jsonb
     else '{"en":"By day, another telling."}'::jsonb
   end
 where revision_id = 'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000a15';

select ok(
  not exists (
    select 1
    from jsonb_array_elements(
      public.fn_draft_check('aaaaaaaa-bbbb-4ccc-8ddd-000000000010')->'failures'
    ) f
    where f->>'code' = 'NO_TIME_HINT'
      and f->>'entity_id' = 'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000a15'
  ),
  'NO_TIME_HINT clears when both hints filled'
);

-- NO_ROOT: retire all roots in working table for draft_check
update public.fragments
   set status = 'retired'
 where grove_id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000010'
   and tier = 'root';

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.fn_draft_check('aaaaaaaa-bbbb-4ccc-8ddd-000000000010')->'failures'
    ) f
    where f->>'code' = 'NO_ROOT' and f->>'grove_id' = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000010'
  ),
  'NO_ROOT fires on draft_check when no active root'
);

update public.fragments
   set status = 'published'
 where grove_id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000010'
   and tier = 'root';

-- Restore draft statuses for roots that were draft in seed before publish commit
-- (seed publish already set published on demo; keep published)

select ok(
  not exists (
    select 1
    from jsonb_array_elements(
      public.fn_draft_check('aaaaaaaa-bbbb-4ccc-8ddd-000000000010')->'failures'
    ) f
    where f->>'code' = 'NO_ROOT'
  ),
  'NO_ROOT clears when published roots exist'
);

-- G2: blank en teaser still NO_TEASER
update public.fragments
   set teaser = '{"en":"   "}'::jsonb
 where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000030';

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.fn_publish_check('aaaaaaaa-bbbb-4ccc-8ddd-0000000000e0')->'failures'
    ) f
    where f->>'code' = 'NO_TEASER'
  ),
  'G2: blank-trimmed en teaser is NO_TEASER'
);

update public.fragments
   set teaser = '{"en":"Begin near the refuge entrance."}'::jsonb
 where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000030';

-- fn_l10n_blank contract
select ok(public.fn_l10n_blank('{}'::jsonb), 'fn_l10n_blank true for {}');
select ok(public.fn_l10n_blank('{"en":"  "}'::jsonb), 'fn_l10n_blank true for blank en');
select ok(not public.fn_l10n_blank('{"en":"hi"}'::jsonb), 'fn_l10n_blank false for text');

-- Corrections never require change teaser (A14)
select ok(
  not exists (
    select 1
    from jsonb_array_elements(
      public.fn_publish_check('aaaaaaaa-bbbb-4ccc-8ddd-0000000000e0')->'failures'
    ) f
    where f->>'code' = 'NO_CHANGE_TEASER'
      and f->>'entity_id' in (
        select id::text from public.fragment_revisions
        where change_kind = 'correction'
      )
  ),
  'A14: correction revisions do not emit NO_CHANGE_TEASER'
);

select * from finish();
rollback;
