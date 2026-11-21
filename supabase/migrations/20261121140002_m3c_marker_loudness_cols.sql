-- M3c: B4 Crockford marker_code check; answer 3 max_short_term_lufs.

alter table public.audio_assets
  add column if not exists max_short_term_lufs numeric(5, 2);

-- Align seed / fixture code before adding the constraint
update public.fragments
   set marker_code = 'DEM00001'
 where marker_code = 'DEMO-001';

alter table public.fragments
  drop constraint if exists fragments_marker_code_crockford;

alter table public.fragments
  add constraint fragments_marker_code_crockford
  check (marker_code is null or marker_code ~ '^[0-9A-HJKMNP-TV-Z]{8}$');
