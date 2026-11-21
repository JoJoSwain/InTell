-- M3e: character home grove, change teaser, other-time hint; drop access_notes

alter table public.characters
  add column home_grove_id uuid references public.groves(id);

comment on column public.characters.home_grove_id is
  'Grove writers associate with this character (ADR 0005); required to release.';

alter table public.fragment_revisions
  add column change_teaser jsonb not null default '{}'::jsonb;

comment on column public.fragment_revisions.change_teaser is
  'L10n public change teaser; required for contingency revisions after revision 1.';

alter table public.revision_versions
  add column other_time_hint jsonb not null default '{}'::jsonb;

comment on column public.revision_versions.other_time_hint is
  'L10n Chronicle hint advertising this version to listeners who heard only the other window.';

alter table public.groves drop column access_notes;
