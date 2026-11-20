-- M3a: regions.sun_reference; groves absorb sites; drop sites / site_approvals

-- ---------------------------------------------------------------------------
-- regions.sun_reference (Farmington Bay ~40.96, -111.92)
-- ---------------------------------------------------------------------------
alter table public.regions
  add column if not exists sun_reference extensions.geography(Point, 4326);

update public.regions
   set sun_reference = extensions.ST_SetSRID(
     extensions.ST_MakePoint(-111.92, 40.96),
     4326
   )::extensions.geography
 where sun_reference is null;

alter table public.regions
  alter column sun_reference set not null;

-- ---------------------------------------------------------------------------
-- Groves absorb site fields
-- ---------------------------------------------------------------------------
alter table public.groves
  add column if not exists region_id uuid,
  add column if not exists website_url text,
  add column if not exists gatherings_url text,
  add column if not exists allows_speaker_wildlife_sounds boolean not null default false;

-- Backfill from sites (+ active approval wildlife flag when present)
update public.groves g
   set region_id = s.region_id,
       website_url = coalesce(g.website_url, s.website_url),
       gatherings_url = coalesce(g.gatherings_url, s.gatherings_url),
       allows_speaker_wildlife_sounds = coalesce(
         (
           select sa.allows_speaker_wildlife_sounds
           from public.site_approvals sa
           where sa.site_id = s.id
             and sa.status = 'active'
           order by sa.updated_at desc
           limit 1
         ),
         false
       )
  from public.sites s
 where g.site_id = s.id;

-- Any grove somehow without a site: attach to first region (seed-only safety)
update public.groves
   set region_id = (select id from public.regions order by created_at limit 1)
 where region_id is null;

alter table public.groves
  alter column region_id set not null;

alter table public.groves
  add constraint groves_region_id_fkey
  foreign key (region_id) references public.regions(id);

-- Rename narrator_growth_cue_id → growth_cue_id
alter table public.groves
  rename column narrator_growth_cue_id to growth_cue_id;

-- Drop site uniqueness / FK, then site_id
alter table public.groves
  drop constraint if exists groves_site_id_slug_key;
alter table public.groves
  drop constraint if exists groves_site_id_fkey;

alter table public.groves
  drop column if exists site_id;

alter table public.groves
  add constraint groves_region_id_slug_key unique (region_id, slug);

-- Drop rights-leave trigger on site_approvals before dropping the table
drop trigger if exists site_approvals_leave_active on public.site_approvals;

drop table if exists public.site_approvals cascade;
drop table if exists public.sites cascade;

-- approval_status enum is now unused
drop type if exists public.approval_status;
