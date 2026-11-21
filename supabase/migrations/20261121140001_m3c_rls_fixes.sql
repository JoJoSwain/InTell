-- M3c: B1 RLS delete-hole fix; answer 1 writer audio upload (mirror image_assets).

-- ---------------------------------------------------------------------------
-- audio_assets: writer + sound + editor + admin write (DATA_MODEL §13)
-- ---------------------------------------------------------------------------
drop policy if exists audio_assets_sound_write on public.audio_assets;
drop policy if exists audio_assets_write on public.audio_assets;

create policy audio_assets_write on public.audio_assets for all to authenticated
  using (public.has_role(array['writer','sound','editor','admin']::public.staff_role[]))
  with check (public.has_role(array['writer','sound','editor','admin']::public.staff_role[]));

-- ---------------------------------------------------------------------------
-- B1: split for-all policies whose USING is wider than WITH CHECK
-- fragment_threads / fragment_characters: writer+ mutate; all staff select
-- ---------------------------------------------------------------------------
drop policy if exists fragment_threads_staff on public.fragment_threads;
create policy fragment_threads_staff_select on public.fragment_threads for select to authenticated
  using (public.has_role(array['viewer','moderator','writer','sound','editor','admin']::public.staff_role[]));
create policy fragment_threads_writer_insert on public.fragment_threads for insert to authenticated
  with check (public.has_role(array['writer','editor','admin']::public.staff_role[]));
create policy fragment_threads_writer_update on public.fragment_threads for update to authenticated
  using (public.has_role(array['writer','editor','admin']::public.staff_role[]))
  with check (public.has_role(array['writer','editor','admin']::public.staff_role[]));
create policy fragment_threads_writer_delete on public.fragment_threads for delete to authenticated
  using (public.has_role(array['writer','editor','admin']::public.staff_role[]));

drop policy if exists fragment_characters_staff on public.fragment_characters;
create policy fragment_characters_staff_select on public.fragment_characters for select to authenticated
  using (public.has_role(array['viewer','moderator','writer','sound','editor','admin']::public.staff_role[]));
create policy fragment_characters_writer_insert on public.fragment_characters for insert to authenticated
  with check (public.has_role(array['writer','editor','admin']::public.staff_role[]));
create policy fragment_characters_writer_update on public.fragment_characters for update to authenticated
  using (public.has_role(array['writer','editor','admin']::public.staff_role[]))
  with check (public.has_role(array['writer','editor','admin']::public.staff_role[]));
create policy fragment_characters_writer_delete on public.fragment_characters for delete to authenticated
  using (public.has_role(array['writer','editor','admin']::public.staff_role[]));

-- journal_terms: editor+ mutate; all staff select
drop policy if exists journal_terms_staff on public.journal_terms;
create policy journal_terms_staff_select on public.journal_terms for select to authenticated
  using (public.has_role(array['viewer','moderator','writer','sound','editor','admin']::public.staff_role[]));
create policy journal_terms_editor_insert on public.journal_terms for insert to authenticated
  with check (public.has_role(array['editor','admin']::public.staff_role[]));
create policy journal_terms_editor_update on public.journal_terms for update to authenticated
  using (public.has_role(array['editor','admin']::public.staff_role[]))
  with check (public.has_role(array['editor','admin']::public.staff_role[]));
create policy journal_terms_editor_delete on public.journal_terms for delete to authenticated
  using (public.has_role(array['editor','admin']::public.staff_role[]));

-- landcover_*: sound+ mutate; all staff select
drop policy if exists landcover_classes_staff on public.landcover_classes;
create policy landcover_classes_staff_select on public.landcover_classes for select to authenticated
  using (public.has_role(array['viewer','moderator','writer','sound','editor','admin']::public.staff_role[]));
create policy landcover_classes_sound_insert on public.landcover_classes for insert to authenticated
  with check (public.has_role(array['sound','editor','admin']::public.staff_role[]));
create policy landcover_classes_sound_update on public.landcover_classes for update to authenticated
  using (public.has_role(array['sound','editor','admin']::public.staff_role[]))
  with check (public.has_role(array['sound','editor','admin']::public.staff_role[]));
create policy landcover_classes_sound_delete on public.landcover_classes for delete to authenticated
  using (public.has_role(array['sound','editor','admin']::public.staff_role[]));

drop policy if exists landcover_grids_staff on public.landcover_grids;
create policy landcover_grids_staff_select on public.landcover_grids for select to authenticated
  using (public.has_role(array['viewer','moderator','writer','sound','editor','admin']::public.staff_role[]));
create policy landcover_grids_sound_insert on public.landcover_grids for insert to authenticated
  with check (public.has_role(array['sound','editor','admin']::public.staff_role[]));
create policy landcover_grids_sound_update on public.landcover_grids for update to authenticated
  using (public.has_role(array['sound','editor','admin']::public.staff_role[]))
  with check (public.has_role(array['sound','editor','admin']::public.staff_role[]));
create policy landcover_grids_sound_delete on public.landcover_grids for delete to authenticated
  using (public.has_role(array['sound','editor','admin']::public.staff_role[]));
