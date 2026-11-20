-- M3a: audio_assets columns; image_assets; storage bucket changes

-- ---------------------------------------------------------------------------
-- audio_assets: add measured fields; drop source
-- ---------------------------------------------------------------------------
alter table public.audio_assets
  add column if not exists bitrate_kbps int,
  add column if not exists true_peak_dbtp numeric(5, 2);

alter table public.audio_assets
  drop column if exists source;

drop type if exists public.asset_source;

-- ---------------------------------------------------------------------------
-- image_assets (character portraits and later artwork)
-- ---------------------------------------------------------------------------
create table public.image_assets (
  id uuid primary key default gen_random_uuid(),
  sha256 text unique not null,
  ext text not null check (ext in ('webp', 'png', 'jpg')),
  bytes int not null,
  width int not null,
  height int not null,
  title text not null,
  alt_text jsonb not null default '{}',
  staging_path text not null,
  is_public boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger image_assets_set_updated_at
  before update on public.image_assets
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Storage: staging-images; rename seeds-voice → journal-voice; drop private-docs
-- ---------------------------------------------------------------------------

-- staging-images bucket
insert into storage.buckets (id, name, public, file_size_limit)
values ('staging-images', 'staging-images', false, 52428800)
on conflict (id) do nothing;

create policy staging_images_select on storage.objects for select to authenticated
  using (
    bucket_id = 'staging-images'
    and public.has_role(array['writer','sound','editor','admin']::public.staff_role[])
  );
create policy staging_images_write on storage.objects for insert to authenticated
  with check (
    bucket_id = 'staging-images'
    and public.has_role(array['writer','sound','editor','admin']::public.staff_role[])
  );
create policy staging_images_update on storage.objects for update to authenticated
  using (
    bucket_id = 'staging-images'
    and public.has_role(array['writer','sound','editor','admin']::public.staff_role[])
  )
  with check (
    bucket_id = 'staging-images'
    and public.has_role(array['writer','sound','editor','admin']::public.staff_role[])
  );
create policy staging_images_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'staging-images'
    and public.has_role(array['writer','sound','editor','admin']::public.staff_role[])
  );

-- journal-voice replaces seeds-voice (Storage API forbids direct object deletes)
insert into storage.buckets (id, name, public, file_size_limit)
values ('journal-voice', 'journal-voice', false, 10485760)
on conflict (id) do nothing;

drop policy if exists seeds_voice_select on storage.objects;
drop policy if exists seeds_voice_service_write on storage.objects;

create policy journal_voice_select on storage.objects for select to authenticated
  using (
    bucket_id = 'journal-voice'
    and public.has_role(array['moderator','writer','editor','admin']::public.staff_role[])
  );
create policy journal_voice_service_write on storage.objects for all to service_role
  using (bucket_id = 'journal-voice')
  with check (bucket_id = 'journal-voice');

-- Keep seeds-voice bucket id if present (empty in local/CI); new code uses journal-voice.
-- private-docs: drop policies only (bucket may remain empty; no direct object deletes)
drop policy if exists private_docs_select on storage.objects;
drop policy if exists private_docs_write on storage.objects;
