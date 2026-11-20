-- M2b R4: content hash for no-op rebuilds (canonical pack body without packVersion/builtAt)
alter table public.pack_builds
  add column if not exists content_sha256 text;

comment on column public.pack_builds.content_sha256 is
  'sha256 of canonical JSON excluding packVersion and builtAt; equal ⇒ rebuild no-op';
