-- A5: asset_kind values must commit before functions that reference them
-- (PostgreSQL cannot use a newly added enum value in the same transaction).
alter type public.asset_kind add value if not exists 'music_moment';
alter type public.asset_kind add value if not exists 'beacon';
