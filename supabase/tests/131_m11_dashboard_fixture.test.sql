-- M11 fixture: hand-written expected aggregates (not derived from the views).
-- Loaded inside this transaction only — no db reset.
--
-- Devices (Jan 2025 Denver cohort; today ≥ Jul 2025 so M+6 ≤ today):
--   A  first session 2025-01-15 12:00 MST; return 2025-03-01; journal day 2 → contributor+returned
--   B  first session 2025-01-20; no return; no journal → non-contributor
--   C  first session 2025-01-10; return 2025-02-01; no journal → non-contributor+returned
--   D  first session 2025-01-18; second session 4h later the same day → not a return
--      (return = another session ≥1 day and ≤183 days after the first)
--
-- Expected Jan 2025 return_6mo:        cohort=4, returned=2, rate=0.5000
-- Expected Jan 2025 contribution_return:
--   contributor_n=1, contributor_returned=1, contributor_return_rate=1.0000
--   non_contributor_n=3, non_contributor_returned=1, non_contributor_return_rate=0.3333
--
-- Visits (grove_entered): A,B,C each once on farmington → visit_count=3 for grove 010 in 2025-01
-- Fragments completed: A completes root+branch; C completes leaf
--   → depth: 3 sessions; sessions_with_branch≥1; sessions_with_leaf≥1
-- Check-ins events Jan: 2 submitted, 1 skipped → response_rate=0.6667

begin;
select plan(11);

-- Staff viewer so security_invoker views return rows
insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'bbbbbbbb-bbbb-4ccc-8ddd-310000000001',
  'authenticated', 'authenticated', 'dash-viewer@test.local',
  crypt('x', gen_salt('bf')), now(), '{}'::jsonb, '{}'::jsonb, now(), now()
);
insert into public.staff (user_id, display_name, role, active)
values ('bbbbbbbb-bbbb-4ccc-8ddd-310000000001', 'Dash Viewer', 'viewer', true);

insert into public.devices (id, platform, app_version, ui_language) values
  ('11111111-1111-4111-8111-31000000000a', 'ios', '1.0.0', 'en'),
  ('11111111-1111-4111-8111-31000000000b', 'ios', '1.0.0', 'en'),
  ('11111111-1111-4111-8111-31000000000c', 'android', '1.0.0', 'en'),
  ('11111111-1111-4111-8111-31000000000d', 'ios', '1.0.0', 'en');

-- Sessions / grove enters / completions (timestamptz in UTC ≈ Denver winter)
insert into public.events (
  device_id, client_event_id, name, occurred_at, grove_id, fragment_id, session_id, props
) values
  -- Device A
  ('11111111-1111-4111-8111-31000000000a', 'aaaaaaaa-bbbb-4ccc-8ddd-3100000000a1',
   'session_started', '2025-01-15T19:00:00+00', null, null,
   'aaaaaaaa-bbbb-4ccc-8ddd-3100000000d1', '{}'::jsonb),
  ('11111111-1111-4111-8111-31000000000a', 'aaaaaaaa-bbbb-4ccc-8ddd-3100000000a2',
   'grove_entered', '2025-01-15T19:05:00+00', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000010', null,
   'aaaaaaaa-bbbb-4ccc-8ddd-3100000000d1', '{}'::jsonb),
  ('11111111-1111-4111-8111-31000000000a', 'aaaaaaaa-bbbb-4ccc-8ddd-3100000000a3',
   'fragment_completed', '2025-01-15T19:20:00+00', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000010',
   'aaaaaaaa-bbbb-4ccc-8ddd-000000000030',
   'aaaaaaaa-bbbb-4ccc-8ddd-3100000000d1',
   '{"time_window":"day","change_kind":"contingency"}'::jsonb),
  ('11111111-1111-4111-8111-31000000000a', 'aaaaaaaa-bbbb-4ccc-8ddd-3100000000a4',
   'fragment_completed', '2025-01-15T19:40:00+00', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000010',
   'aaaaaaaa-bbbb-4ccc-8ddd-000000000031',
   'aaaaaaaa-bbbb-4ccc-8ddd-3100000000d1',
   '{"time_window":"day","change_kind":"contingency"}'::jsonb),
  ('11111111-1111-4111-8111-31000000000a', 'aaaaaaaa-bbbb-4ccc-8ddd-3100000000a5',
   'session_started', '2025-03-01T19:00:00+00', null, null,
   'aaaaaaaa-bbbb-4ccc-8ddd-3100000000d2', '{}'::jsonb),
  -- Device B
  ('11111111-1111-4111-8111-31000000000b', 'aaaaaaaa-bbbb-4ccc-8ddd-3100000000b1',
   'session_started', '2025-01-20T19:00:00+00', null, null,
   'aaaaaaaa-bbbb-4ccc-8ddd-3100000000d3', '{}'::jsonb),
  ('11111111-1111-4111-8111-31000000000b', 'aaaaaaaa-bbbb-4ccc-8ddd-3100000000b2',
   'grove_entered', '2025-01-20T19:05:00+00', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000010', null,
   'aaaaaaaa-bbbb-4ccc-8ddd-3100000000d3', '{}'::jsonb),
  -- Device C
  ('11111111-1111-4111-8111-31000000000c', 'aaaaaaaa-bbbb-4ccc-8ddd-3100000000c1',
   'session_started', '2025-01-10T19:00:00+00', null, null,
   'aaaaaaaa-bbbb-4ccc-8ddd-3100000000d4', '{}'::jsonb),
  ('11111111-1111-4111-8111-31000000000c', 'aaaaaaaa-bbbb-4ccc-8ddd-3100000000c2',
   'grove_entered', '2025-01-10T19:05:00+00', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000010', null,
   'aaaaaaaa-bbbb-4ccc-8ddd-3100000000d4', '{}'::jsonb),
  ('11111111-1111-4111-8111-31000000000c', 'aaaaaaaa-bbbb-4ccc-8ddd-3100000000c3',
   'fragment_completed', '2025-01-10T19:30:00+00', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000010',
   'aaaaaaaa-bbbb-4ccc-8ddd-000000000033',
   'aaaaaaaa-bbbb-4ccc-8ddd-3100000000d4',
   '{"time_window":"day","change_kind":"contingency"}'::jsonb),
  ('11111111-1111-4111-8111-31000000000c', 'aaaaaaaa-bbbb-4ccc-8ddd-3100000000c4',
   'session_started', '2025-02-01T19:00:00+00', null, null,
   'aaaaaaaa-bbbb-4ccc-8ddd-3100000000d5', '{}'::jsonb),
  -- Check-in events
  ('11111111-1111-4111-8111-31000000000a', 'aaaaaaaa-bbbb-4ccc-8ddd-3100000000a6',
   'checkin_submitted', '2025-01-15T20:00:00+00', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000010', null,
   'aaaaaaaa-bbbb-4ccc-8ddd-3100000000d1', '{}'::jsonb),
  ('11111111-1111-4111-8111-31000000000c', 'aaaaaaaa-bbbb-4ccc-8ddd-3100000000c5',
   'checkin_submitted', '2025-01-10T20:00:00+00', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000010', null,
   'aaaaaaaa-bbbb-4ccc-8ddd-3100000000d4', '{}'::jsonb),
  ('11111111-1111-4111-8111-31000000000b', 'aaaaaaaa-bbbb-4ccc-8ddd-3100000000b3',
   'checkin_skipped', '2025-01-20T20:00:00+00', null, null,
   'aaaaaaaa-bbbb-4ccc-8ddd-3100000000d3', '{}'::jsonb),
  -- Device D: same-day restart only (must not count as returned)
  ('11111111-1111-4111-8111-31000000000d', 'aaaaaaaa-bbbb-4ccc-8ddd-3100000000d1',
   'session_started', '2025-01-18T19:00:00+00', null, null,
   'aaaaaaaa-bbbb-4ccc-8ddd-3100000000d6', '{}'::jsonb),
  ('11111111-1111-4111-8111-31000000000d', 'aaaaaaaa-bbbb-4ccc-8ddd-3100000000d2',
   'session_started', '2025-01-18T23:00:00+00', null, null,
   'aaaaaaaa-bbbb-4ccc-8ddd-3100000000d7', '{}'::jsonb);

insert into public.journal_entries (
  id, device_id, client_entry_id, grove_id, written_on_site, kind,
  body, terms_version, status, submitted_at
) values (
  'aaaaaaaa-bbbb-4ccc-8ddd-3100000000e1',
  '11111111-1111-4111-8111-31000000000a',
  'aaaaaaaa-bbbb-4ccc-8ddd-3100000000e1',
  'aaaaaaaa-bbbb-4ccc-8ddd-000000000010',
  true,
  'noticed',
  'fixture note',
  1,
  'submitted',
  '2025-01-16T19:00:00+00'
);

insert into public.checkins (
  id, device_id, client_checkin_id, session_id, grove_id,
  place_before, place_now, people_before, people_now, first_visit, submitted_at
) values (
  'aaaaaaaa-bbbb-4ccc-8ddd-3100000000f1',
  '11111111-1111-4111-8111-31000000000a',
  'aaaaaaaa-bbbb-4ccc-8ddd-3100000000f1',
  'aaaaaaaa-bbbb-4ccc-8ddd-3100000000d1',
  'aaaaaaaa-bbbb-4ccc-8ddd-000000000010',
  2, 4, 3, 4, true,
  '2025-01-15T20:00:00+00'
);

-- anon cannot select views
select ok(
  not has_table_privilege('anon', 'public.v_dash_return_6mo', 'SELECT'),
  'anon cannot SELECT v_dash_return_6mo'
);

select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4ccc-8ddd-310000000099', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
-- non-staff user (no staff row)
insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'bbbbbbbb-bbbb-4ccc-8ddd-310000000099',
  'authenticated', 'authenticated', 'nostaff-dash@test.local',
  crypt('x', gen_salt('bf')), now(), '{}'::jsonb, '{}'::jsonb, now(), now()
);
set local role authenticated;

select is(
  (select count(*)::int from public.v_dash_visits),
  0,
  'non-staff authenticated sees zero dashboard visits'
);

reset role;

select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4ccc-8ddd-310000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  (
    select visit_count::int
    from public.v_dash_visits
    where month = '2025-01-01'
      and grove_id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000010'
  ),
  3,
  'Jan 2025 farmington visits = 3'
);

select is(
  (
    select format(
      '%s/%s/%s',
      cohort::int,
      returned::int,
      to_char(return_rate, 'FM0.0000')
    )
    from public.v_dash_return_6mo
    where month = '2025-01-01'
  ),
  '4/2/0.5000',
  'Jan 2025 return_6mo cohort=4 returned=2 rate=0.5000'
);

select is(
  (
    select format(
      '%s/%s/%s/%s/%s/%s',
      contributor_n::int,
      contributor_returned::int,
      to_char(contributor_return_rate, 'FM0.0000'),
      non_contributor_n::int,
      non_contributor_returned::int,
      to_char(non_contributor_return_rate, 'FM0.0000')
    )
    from public.v_dash_contribution_return
    where month = '2025-01-01'
  ),
  '1/1/1.0000/3/1/0.3333',
  'Jan 2025 contribution-return hand numbers'
);

select ok(
  (select sessions_with_branch from public.v_dash_depth) >= 1
  and (select sessions_with_leaf from public.v_dash_depth) >= 1
  and (select session_n from public.v_dash_depth) >= 3,
  'depth shows branch and leaf sessions among ≥3 sessions'
);

select is(
  (
    select format(
      '%s/%s/%s',
      submitted::int,
      skipped::int,
      to_char(response_rate, 'FM0.0000')
    )
    from public.v_dash_checkins
    where month = '2025-01-01'
  ),
  '2/1/0.6667',
  'Jan 2025 check-in response_rate = 2/(2+1)'
);

select is(
  (
    select completed_count::int
    from public.v_dash_fragments_completed
    where month = '2025-01-01'
      and tier = 'root'
      and time_window = 'day'
  ),
  1,
  'one root day completion in Jan 2025'
);

select is(
  (
    select entry_count::int
    from public.v_dash_participation
    where month = '2025-01-01' and kind = 'noticed'
  ),
  1,
  'one noticed journal entry in Jan 2025'
);

select ok(
  (select pct_on_site from public.v_dash_participation
   where month = '2025-01-01' and kind = 'noticed') = 1.0000,
  'noticed entry was on site'
);

reset role;

select ok(
  has_table_privilege('authenticated', 'public.v_dash_visits', 'SELECT'),
  'authenticated has SELECT on v_dash_visits'
);

select * from finish();
rollback;
