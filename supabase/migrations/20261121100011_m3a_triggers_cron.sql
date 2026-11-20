-- M3a: drop obsolete triggers/cron; schedule due releases; keep guards + retention

-- ---------------------------------------------------------------------------
-- Drop rights / status-enqueue / crossroads triggers
-- ---------------------------------------------------------------------------
drop trigger if exists fragment_revisions_publish_enqueue on public.fragment_revisions;
drop trigger if exists music_cues_publish_enqueue on public.music_cues;

drop function if exists public.fn_publish_status_enqueue() cascade;
drop function if exists public.fn_rights_leave_active() cascade;
drop function if exists public.fn_enqueue_due_publish_at() cascade;
drop function if exists public.fn_close_due_crossroads() cascade;

-- Fragment / prereq guards kept (rewritten in story mig); fragments_audit kept

-- ---------------------------------------------------------------------------
-- Cron: unschedule publish-at-and-crossroads; schedule due releases every minute
-- ---------------------------------------------------------------------------
do $$
declare
  jid bigint;
begin
  select jobid into jid from cron.job where jobname = 'publish-at-and-crossroads-every-5m';
  if jid is not null then
    perform cron.unschedule(jid);
  end if;
end $$;

-- Re-schedule idempotently: unscheduling same name if re-run
do $$
declare
  jid bigint;
begin
  select jobid into jid from cron.job where jobname = 'enqueue-due-releases-every-minute';
  if jid is not null then
    perform cron.unschedule(jid);
  end if;
end $$;

select cron.schedule(
  'enqueue-due-releases-every-minute',
  '* * * * *',
  $$ select public.fn_enqueue_due_releases(); $$
);

-- Keep run-jobs-every-minute and daily-expiry-hourly-check (already scheduled in M2a)

revoke all on function public.fn_enqueue_due_releases() from public, anon, authenticated;
grant execute on function public.fn_enqueue_due_releases() to service_role;

revoke all on function public.fn_daily_expiry_and_retention() from public, anon, authenticated;
grant execute on function public.fn_daily_expiry_and_retention() to service_role;

revoke all on function public.fn_call_run_jobs() from public, anon, authenticated;
grant execute on function public.fn_call_run_jobs() to service_role;
