-- PostGIS resolvable for postgres and anon (extensions schema).
begin;
select plan(3);

select ok(
  extensions.ST_AsText(extensions.ST_GeomFromText('POINT(0 0)', 4326)) = 'POINT(0 0)',
  'postgres can call extensions.ST_AsText'
);

set local role anon;
select ok(
  extensions.ST_AsText(extensions.ST_GeomFromText('POINT(1 1)', 4326)) = 'POINT(1 1)',
  'anon can call extensions.ST_AsText'
);
reset role;

set local role authenticated;
select ok(
  extensions.ST_AsText(extensions.ST_GeomFromText('POINT(2 2)', 4326)) = 'POINT(2 2)',
  'authenticated can call extensions.ST_AsText'
);
reset role;

select * from finish();
rollback;
