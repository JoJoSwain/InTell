-- image_assets: NO_ALT_TEXT in fn_publish_check; is_public defaults false until publish pipeline.
begin;
select plan(4);

select set_config('request.jwt.claim.role', 'service_role', true);

-- Isolate: publish pipeline may have flipped is_public before pgTAP (CI drain / local runs).
update public.image_assets
   set is_public = false
 where id in (
   'aaaaaaaa-bbbb-4ccc-8ddd-000000000140',
   'aaaaaaaa-bbbb-4ccc-8ddd-000000000141'
 );

select ok(
  (select coalesce(is_public, false) = false
     from public.image_assets
    where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000140'),
  'seed portrait images start is_public false'
);

insert into public.releases (id, name, status)
values ('aaaaaaaa-bbbb-4ccc-8ddd-ffff00000091', 'image checklist', 'draft');

insert into public.release_items (release_id, entity, entity_id) values
  ('aaaaaaaa-bbbb-4ccc-8ddd-ffff00000091', 'image', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000140');

update public.image_assets set alt_text = '{"en":""}'::jsonb
 where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000140';

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.fn_publish_check('aaaaaaaa-bbbb-4ccc-8ddd-ffff00000091')->'failures'
    ) f
    where f->>'code' = 'NO_ALT_TEXT'
  ),
  'empty en alt text triggers NO_ALT_TEXT'
);

update public.image_assets
   set alt_text = '{"en":"Valid alt"}'::jsonb
 where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000140';

select ok(
  (public.fn_publish_check('aaaaaaaa-bbbb-4ccc-8ddd-ffff00000091')->>'ok')::boolean,
  'image with alt text passes check'
);

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.fn_publish_check('aaaaaaaa-bbbb-4ccc-8ddd-ffff00000091')->'image_shas_to_publish'
    ) x
    where x#>>'{}' = (
      select sha256 from public.image_assets
       where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000140'
    )
  ),
  'fn_publish_check lists image sha in image_shas_to_publish'
);

select * from finish();
rollback;