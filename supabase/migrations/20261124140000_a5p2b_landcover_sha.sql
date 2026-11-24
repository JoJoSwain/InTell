-- A5 P2b review: content-addressed landcover grid sha (additive).
alter table public.landcover_grids
  add column if not exists sha text;

comment on column public.landcover_grids.sha is
  'sha256 of the grid file bytes; null until staff upload. Packs use this as gridSha.';
