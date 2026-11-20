-- fn_contingency_revision_no SQL parity with packages/shared/story/contingency.ts.
begin;
select plan(4);

select is(
  public.fn_contingency_revision_no('aaaaaaaa-bbbb-4ccc-8ddd-000000000033'),
  1,
  'frag4: correction r2 does not advance contingency epoch'
);

select is(
  public.fn_contingency_revision_no('aaaaaaaa-bbbb-4ccc-8ddd-000000000039'),
  2,
  'frag10: r2 contingency advances epoch to 2'
);

insert into public.fragments (
  id, grove_id, tier, title, location, visibility, trigger_radius_m, story_order, status
) values (
  'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000100',
  'aaaaaaaa-bbbb-4ccc-8ddd-000000000010',
  'leaf',
  '{"en":"contingency lab"}'::jsonb,
  (select extensions.ST_Centroid(boundary)::extensions.geography
     from public.groves where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000010'),
  'standard', 10.67, 940, 'published'
);

insert into public.fragment_revisions (
  id, fragment_id, revision_no, status, change_kind, change_note
) values
  ('aaaaaaaa-bbbb-4ccc-8ddd-ffff00000101', 'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000100', 1, 'published', 'contingency', 'c1'),
  ('aaaaaaaa-bbbb-4ccc-8ddd-ffff00000102', 'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000100', 2, 'published', 'correction', 'fix'),
  ('aaaaaaaa-bbbb-4ccc-8ddd-ffff00000103', 'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000100', 3, 'draft', 'contingency', 'c3');

insert into public.published_snapshots (entity, entity_id, release_id, data, published_at)
values (
  'fragment',
  'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000100',
  'aaaaaaaa-bbbb-4ccc-8ddd-0000000000e0',
  jsonb_build_object('id', 'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000100', 'status', 'published'),
  now()
);

insert into public.revision_versions (
  revision_id, language, time_window, narration_asset_id, transcript
) values
  ('aaaaaaaa-bbbb-4ccc-8ddd-ffff00000101', 'en', 'day', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000100', 't1'),
  ('aaaaaaaa-bbbb-4ccc-8ddd-ffff00000102', 'en', 'day', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000100', 't2');

select is(
  public.fn_contingency_revision_no('aaaaaaaa-bbbb-4ccc-8ddd-ffff00000100'),
  1,
  'highest published contingency at or before current max is 1 when r2 is correction'
);

update public.fragment_revisions
   set status = 'published'
 where id = 'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000103';

insert into public.revision_versions (
  revision_id, language, time_window, narration_asset_id, transcript
) values (
  'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000103', 'en', 'day', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000100', 't3'
);

select is(
  public.fn_contingency_revision_no('aaaaaaaa-bbbb-4ccc-8ddd-ffff00000100'),
  3,
  'after r3 contingency publishes, epoch advances to 3'
);

select * from finish();
rollback;