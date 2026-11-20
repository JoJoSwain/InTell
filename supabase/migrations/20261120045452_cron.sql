-- M2a: pg_cron schedules. Secrets live in Vault (pnpm db:setup-local), never in migrations.

create extension if not exists supabase_vault with schema vault;

-- every minute: call run-jobs (fails cleanly if Vault secrets missing — tested in pgTAP)
select cron.schedule(
  'run-jobs-every-minute',
  '* * * * *',
  $$ select public.fn_call_run_jobs(); $$
);

-- every 5 minutes: scheduled publish_at rebuilds + close due crossroads
select cron.schedule(
  'publish-at-and-crossroads-every-5m',
  '*/5 * * * *',
  $$
    select public.fn_enqueue_due_publish_at();
    select public.fn_close_due_crossroads();
  $$
);

-- hourly: daily expiry/retention when a region's local hour is 02:00 (C8)
select cron.schedule(
  'daily-expiry-hourly-check',
  '5 * * * *',
  $$ select public.fn_daily_expiry_and_retention(); $$
);
