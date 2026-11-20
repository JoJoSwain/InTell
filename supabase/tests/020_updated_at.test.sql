-- Shared set_updated_at trigger bumps on update.
begin;
select plan(1);

do $$
declare
  before_ts timestamptz;
  after_ts timestamptz;
begin
  select updated_at into before_ts
  from public.regions
  where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000001';

  perform pg_sleep(0.05);

  update public.regions
     set name = name || jsonb_build_object('test', 'bump')
   where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000001';

  select updated_at into after_ts
  from public.regions
  where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000001';

  if after_ts <= before_ts then
    raise exception 'updated_at did not advance: % -> %', before_ts, after_ts;
  end if;
end $$;

select pass('regions.updated_at changes on update');

select * from finish();
rollback;
