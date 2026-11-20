-- fn_revision_is_playable false for each rights failure mode.
begin;
select plan(7);

-- baseline: root playable; leaf_c outcome-gated while crossroads open
select ok(
  public.fn_revision_is_playable('aaaaaaaa-bbbb-4ccc-8ddd-000000000040'),
  'seed root revision is playable'
);

select ok(
  not public.fn_revision_is_playable('aaaaaaaa-bbbb-4ccc-8ddd-000000000045'),
  'leaf_c revision false while crossroads open (outcome not decided)'
);

-- consent revoked
update public.consents
   set status = 'revoked', revoked_on = current_date, revoked_reason = 'test'
 where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000051';

select ok(
  not public.fn_revision_is_playable('aaaaaaaa-bbbb-4ccc-8ddd-000000000040'),
  'false when consent revoked'
);

update public.consents
   set status = 'active', revoked_on = null, revoked_reason = null
 where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000051';

-- consent expired (C9: expires_on < region today)
update public.consents
   set expires_on = (current_date - 2)
 where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000051';

select ok(
  not public.fn_revision_is_playable('aaaaaaaa-bbbb-4ccc-8ddd-000000000040'),
  'false when consent expired'
);

update public.consents
   set expires_on = null
 where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000051';

-- missing app channel
update public.consents
   set channels = array['archive']
 where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000051';

select ok(
  not public.fn_revision_is_playable('aaaaaaaa-bbbb-4ccc-8ddd-000000000040'),
  'false when consent missing app channel'
);

update public.consents
   set channels = array['app','archive']
 where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000051';

-- asset right revoked (narration for root)
update public.asset_rights
   set status = 'revoked'
 where asset_id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000100'
   and status = 'active';

select ok(
  not public.fn_revision_is_playable('aaaaaaaa-bbbb-4ccc-8ddd-000000000040'),
  'false when asset right revoked'
);

update public.asset_rights
   set status = 'active'
 where asset_id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000100';

-- site approval expired
update public.site_approvals
   set status = 'expired'
 where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000006';

select ok(
  not public.fn_revision_is_playable('aaaaaaaa-bbbb-4ccc-8ddd-000000000040'),
  'false when site approval expired'
);

select * from finish();
rollback;
