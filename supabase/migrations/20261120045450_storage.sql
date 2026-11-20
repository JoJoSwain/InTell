-- M2a: storage buckets + policies (DATA_MODEL §13)

insert into storage.buckets (id, name, public, file_size_limit)
values
  ('public-media', 'public-media', true, 52428800),
  ('staging-audio', 'staging-audio', false, 52428800),
  ('seeds-voice', 'seeds-voice', false, 10485760),
  ('private-docs', 'private-docs', false, 52428800)
on conflict (id) do nothing;

-- public-media: public read; service role writes (via edge functions)
create policy public_media_read on storage.objects for select
  to public
  using (bucket_id = 'public-media');

create policy public_media_service_write on storage.objects for all
  to service_role
  using (bucket_id = 'public-media')
  with check (bucket_id = 'public-media');

-- staging-audio: writer, sound, editor, admin
create policy staging_audio_select on storage.objects for select to authenticated
  using (
    bucket_id = 'staging-audio'
    and public.has_role(array['writer','sound','editor','admin']::public.staff_role[])
  );
create policy staging_audio_write on storage.objects for insert to authenticated
  with check (
    bucket_id = 'staging-audio'
    and public.has_role(array['writer','sound','editor','admin']::public.staff_role[])
  );
create policy staging_audio_update on storage.objects for update to authenticated
  using (
    bucket_id = 'staging-audio'
    and public.has_role(array['writer','sound','editor','admin']::public.staff_role[])
  )
  with check (
    bucket_id = 'staging-audio'
    and public.has_role(array['writer','sound','editor','admin']::public.staff_role[])
  );
create policy staging_audio_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'staging-audio'
    and public.has_role(array['writer','sound','editor','admin']::public.staff_role[])
  );

-- seeds-voice: moderator, writer, editor, admin read; service_role write
create policy seeds_voice_select on storage.objects for select to authenticated
  using (
    bucket_id = 'seeds-voice'
    and public.has_role(array['moderator','writer','editor','admin']::public.staff_role[])
  );
create policy seeds_voice_service_write on storage.objects for all to service_role
  using (bucket_id = 'seeds-voice')
  with check (bucket_id = 'seeds-voice');

-- private-docs: editor, admin only (C20)
create policy private_docs_select on storage.objects for select to authenticated
  using (
    bucket_id = 'private-docs'
    and public.has_role(array['editor','admin']::public.staff_role[])
  );
create policy private_docs_write on storage.objects for all to authenticated
  using (
    bucket_id = 'private-docs'
    and public.has_role(array['editor','admin']::public.staff_role[])
  )
  with check (
    bucket_id = 'private-docs'
    and public.has_role(array['editor','admin']::public.staff_role[])
  );
