-- C19 / M2b: anon may execute exactly get_pack_index (and no other public fn)
begin;
select plan(3);

select is(
  (
    select count(*)::int
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and has_function_privilege('anon', p.oid, 'EXECUTE')
  ),
  1,
  'anon has execute on exactly one public function'
);

select ok(
  has_function_privilege('anon', 'public.get_pack_index()', 'EXECUTE'),
  'anon can execute get_pack_index'
);

-- Empty index before any builds
select is(
  public.get_pack_index(),
  '[]'::jsonb,
  'get_pack_index returns [] with no pack_builds'
);

select * from finish();
rollback;
