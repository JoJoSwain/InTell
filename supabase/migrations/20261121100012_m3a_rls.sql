-- M3a: RLS for new tables; rewrite fragments_staff; drop contributor PII views/policies

-- Enable RLS on new tables
alter table public.image_assets enable row level security;
alter table public.releases enable row level security;
alter table public.release_items enable row level security;
alter table public.published_snapshots enable row level security;
alter table public.journal_entries enable row level security;
alter table public.entry_links enable row level security;
alter table public.journal_terms enable row level security;

-- ---------------------------------------------------------------------------
-- image_assets: writer/sound/editor/admin write; all staff read
-- ---------------------------------------------------------------------------
drop policy if exists image_assets_staff_select on public.image_assets;
drop policy if exists image_assets_write on public.image_assets;

create policy image_assets_staff_select on public.image_assets for select to authenticated
  using (public.has_role(array['viewer','moderator','writer','sound','editor','admin']::public.staff_role[]));
create policy image_assets_write on public.image_assets for all to authenticated
  using (public.has_role(array['writer','sound','editor','admin']::public.staff_role[]))
  with check (public.has_role(array['writer','sound','editor','admin']::public.staff_role[]));

-- ---------------------------------------------------------------------------
-- releases / release_items / published_snapshots: editor+ write; staff read
-- ---------------------------------------------------------------------------
drop policy if exists releases_staff_select on public.releases;
drop policy if exists releases_editor_write on public.releases;
create policy releases_staff_select on public.releases for select to authenticated
  using (public.has_role(array['viewer','moderator','writer','sound','editor','admin']::public.staff_role[]));
create policy releases_editor_write on public.releases for all to authenticated
  using (public.has_role(array['editor','admin']::public.staff_role[]))
  with check (public.has_role(array['editor','admin']::public.staff_role[]));

drop policy if exists release_items_staff_select on public.release_items;
drop policy if exists release_items_editor_write on public.release_items;
create policy release_items_staff_select on public.release_items for select to authenticated
  using (public.has_role(array['viewer','moderator','writer','sound','editor','admin']::public.staff_role[]));
create policy release_items_editor_write on public.release_items for all to authenticated
  using (public.has_role(array['editor','admin']::public.staff_role[]))
  with check (public.has_role(array['editor','admin']::public.staff_role[]));

drop policy if exists published_snapshots_staff_select on public.published_snapshots;
drop policy if exists published_snapshots_editor_write on public.published_snapshots;
create policy published_snapshots_staff_select on public.published_snapshots for select to authenticated
  using (public.has_role(array['viewer','moderator','writer','sound','editor','admin']::public.staff_role[]));
-- Snapshots are written by security-definer publish commit; allow editor+ for admin tooling
create policy published_snapshots_editor_write on public.published_snapshots for all to authenticated
  using (public.has_role(array['editor','admin']::public.staff_role[]))
  with check (public.has_role(array['editor','admin']::public.staff_role[]));

-- ---------------------------------------------------------------------------
-- journal_terms / journal_entries / entry_links
-- ---------------------------------------------------------------------------
drop policy if exists seed_terms_staff on public.journal_terms;
drop policy if exists journal_terms_staff on public.journal_terms;
create policy journal_terms_staff on public.journal_terms for all to authenticated
  using (public.has_role(array['viewer','moderator','writer','sound','editor','admin']::public.staff_role[]))
  with check (public.has_role(array['editor','admin']::public.staff_role[]));

drop policy if exists journal_entries_staff_select on public.journal_entries;
drop policy if exists journal_entries_mod_write on public.journal_entries;
create policy journal_entries_staff_select on public.journal_entries for select to authenticated
  using (public.has_role(array['viewer','moderator','writer','sound','editor','admin']::public.staff_role[]));
create policy journal_entries_mod_write on public.journal_entries for update to authenticated
  using (public.has_role(array['moderator','writer','editor','admin']::public.staff_role[]))
  with check (public.has_role(array['moderator','writer','editor','admin']::public.staff_role[]));
create policy journal_entries_editor_insert on public.journal_entries for insert to authenticated
  with check (public.has_role(array['editor','admin']::public.staff_role[]));
create policy journal_entries_editor_delete on public.journal_entries for delete to authenticated
  using (public.has_role(array['editor','admin']::public.staff_role[]));

drop policy if exists entry_links_staff_select on public.entry_links;
drop policy if exists entry_links_writer_write on public.entry_links;
create policy entry_links_staff_select on public.entry_links for select to authenticated
  using (public.has_role(array['viewer','moderator','writer','sound','editor','admin']::public.staff_role[]));
create policy entry_links_writer_write on public.entry_links for all to authenticated
  using (public.has_role(array['writer','editor','admin']::public.staff_role[]))
  with check (public.has_role(array['writer','editor','admin']::public.staff_role[]));

-- ---------------------------------------------------------------------------
-- fragments: all staff can select (coords no longer secret for physical);
-- editor+ write. Story Notes (Indigeny) writable by writer+.
-- ---------------------------------------------------------------------------
drop policy if exists fragments_editor_select on public.fragments;
drop policy if exists fragments_editor_write on public.fragments;

create policy fragments_staff_select on public.fragments for select to authenticated
  using (public.has_role(array['viewer','moderator','writer','sound','editor','admin']::public.staff_role[]));
create policy fragments_editor_write on public.fragments for all to authenticated
  using (public.has_role(array['editor','admin']::public.staff_role[]))
  with check (public.has_role(array['editor','admin']::public.staff_role[]));
-- Writers may update Story Notes columns on existing rows
create policy fragments_writer_story_notes on public.fragments for update to authenticated
  using (public.has_role(array['writer','editor','admin']::public.staff_role[]))
  with check (public.has_role(array['writer','editor','admin']::public.staff_role[]));

-- Rewrite fragments_staff view (no protected coord hiding; teaser not gap_hint)
drop view if exists public.fragments_staff;
create or replace view public.fragments_staff
with (security_barrier = true) as
select
  id, grove_id, tier, is_ending, title, teaser,
  location, visibility, trigger_radius_m, marker_code, story_order,
  indigeny_earth, indigeny_world, indigeny_body,
  status, created_at, updated_at
from public.fragments
where public.has_role(array['viewer','moderator','writer','sound','editor','admin']::public.staff_role[]);

grant select on public.fragments_staff to authenticated;

-- Drop leftover seed_terms policy name if journal rename left it
drop policy if exists seed_terms_staff on public.journal_terms;

-- Ensure grants cover new tables
grant select, insert, update, delete on public.image_assets to authenticated;
grant select, insert, update, delete on public.releases to authenticated;
grant select, insert, update, delete on public.release_items to authenticated;
grant select, insert, update, delete on public.published_snapshots to authenticated;
grant select, insert, update, delete on public.journal_entries to authenticated;
grant select, insert, update, delete on public.entry_links to authenticated;
grant select, insert, update, delete on public.journal_terms to authenticated;

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
