-- fn_call_run_jobs raises when Vault secrets are missing.
begin;
select plan(1);

-- Ensure secrets are absent for this transaction if any were seeded
delete from vault.secrets where name in ('run_jobs_url', 'run_jobs_service_key');

select throws_ok(
  $$select public.fn_call_run_jobs()$$,
  'P0001',
  'run_jobs Vault secrets missing (run pnpm db:setup-local)',
  'fn_call_run_jobs raises when secrets missing'
);

select * from finish();
rollback;
