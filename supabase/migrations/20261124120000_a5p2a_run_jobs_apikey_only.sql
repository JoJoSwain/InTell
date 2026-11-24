-- K1: fn_call_run_jobs sends the Vault secret only as `apikey` (no Bearer).

create or replace function public.fn_call_run_jobs()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  url text;
  key text;
begin
  select decrypted_secret into url
  from vault.decrypted_secrets
  where name = 'run_jobs_url'
  limit 1;

  select decrypted_secret into key
  from vault.decrypted_secrets
  where name = 'run_jobs_service_key'
  limit 1;

  if url is null or key is null then
    raise exception 'run_jobs Vault secrets missing (run pnpm db:setup-local)';
  end if;

  perform net.http_post(
    url := url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', key
    ),
    body := '{}'::jsonb
  );
end;
$$;

revoke all on function public.fn_call_run_jobs() from public, anon, authenticated;
grant execute on function public.fn_call_run_jobs() to service_role;