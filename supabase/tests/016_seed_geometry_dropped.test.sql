-- After seed.sql, the temp geometry staging table must be gone.
begin;
select plan(1);

select ok(
  not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = '_seed_geometry'
  ),
  'public._seed_geometry does not exist after seed'
);

select * from finish();
rollback;
