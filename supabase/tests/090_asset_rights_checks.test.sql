-- C11 asset_rights constraints.
begin;
select plan(3);

select throws_ok(
  $$insert into public.asset_rights (asset_id, license, status)
    values (
      'aaaaaaaa-bbbb-4ccc-8ddd-000000000110',
      'consent_form',
      'active'
    )$$,
  '23514',
  'new row for relation "asset_rights" violates check constraint "asset_rights_consent_form_requires_consent"',
  'consent_form without consent_id fails'
);

select throws_ok(
  $$insert into public.asset_rights (asset_id, license, status)
    values (
      'aaaaaaaa-bbbb-4ccc-8ddd-000000000110',
      'cc_by',
      'active'
    )$$,
  '23514',
  'new row for relation "asset_rights" violates check constraint "asset_rights_cc_by_requires_attribution"',
  'cc_by without attribution fails'
);

select throws_ok(
  $$insert into public.asset_rights (asset_id, license, status)
    values (
      'aaaaaaaa-bbbb-4ccc-8ddd-000000000110',
      'community_sound_grant',
      'active'
    )$$,
  '23514',
  'new row for relation "asset_rights" violates check constraint "asset_rights_community_sound_requires_seed"',
  'community_sound_grant without seed_id fails'
);

select * from finish();
rollback;
