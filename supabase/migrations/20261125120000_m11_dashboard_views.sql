-- M11 / A7: dashboard aggregate views (TECH_SPEC §9, A7-plan-review).
-- security_invoker so RLS on underlying tables applies to the caller.

-- ---------------------------------------------------------------------------
-- Helpers (stable month key in America/Denver)
-- ---------------------------------------------------------------------------
create or replace function public.fn_denver_month(ts timestamptz)
returns date
language sql
immutable
parallel safe
as $$
  select date_trunc('month', timezone('America/Denver', ts))::date;
$$;

revoke all on function public.fn_denver_month(timestamptz) from public, anon;
grant execute on function public.fn_denver_month(timestamptz) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Visits: grove_entered counts per Denver month and grove
-- ---------------------------------------------------------------------------
create or replace view public.v_dash_visits
  with (security_invoker = true)
as
select
  public.fn_denver_month(e.occurred_at) as month,
  e.grove_id,
  count(*)::bigint as visit_count
from public.events e
where e.name = 'grove_entered'
group by 1, 2;

-- Session starts (for return cohorts / overall traffic)
create or replace view public.v_dash_session_starts
  with (security_invoker = true)
as
select
  public.fn_denver_month(e.occurred_at) as month,
  count(*)::bigint as session_count,
  count(distinct e.device_id)::bigint as device_count
from public.events e
where e.name = 'session_started'
group by 1;

-- Fragments completed per grove, tier, time window
create or replace view public.v_dash_fragments_completed
  with (security_invoker = true)
as
select
  public.fn_denver_month(e.occurred_at) as month,
  e.grove_id,
  coalesce(f.tier::text, 'unknown') as tier,
  coalesce(e.props->>'time_window', 'unknown') as time_window,
  count(*)::bigint as completed_count
from public.events e
left join public.fragments f on f.id = e.fragment_id
where e.name = 'fragment_completed'
group by 1, 2, 3, 4;

-- Depth: share of sessions with ≥1 branch / ≥1 leaf completed
create or replace view public.v_dash_depth
  with (security_invoker = true)
as
with sessions as (
  select distinct e.session_id
  from public.events e
  where e.name = 'session_started'
    and e.session_id is not null
),
completed as (
  select
    e.session_id,
    bool_or(coalesce(f.tier::text, 'unknown') = 'branch') as has_branch,
    bool_or(coalesce(f.tier::text, 'unknown') = 'leaf') as has_leaf
  from public.events e
  left join public.fragments f on f.id = e.fragment_id
  where e.name = 'fragment_completed'
    and e.session_id is not null
  group by e.session_id
)
select
  (select count(*)::bigint from sessions) as session_n,
  (select count(*)::bigint from completed where has_branch)::bigint as sessions_with_branch,
  (select count(*)::bigint from completed where has_leaf)::bigint as sessions_with_leaf;

-- Return (6 months): cohort month M with M+6 ≤ today (Denver)
-- (first-session CTE is inlined so device ids are not a selectable view)
create or replace view public.v_dash_return_6mo
  with (security_invoker = true)
as
with firsts as (
  select
    e.device_id,
    min(e.occurred_at) as first_session_at,
    public.fn_denver_month(min(e.occurred_at)) as cohort_month
  from public.events e
  where e.name = 'session_started'
  group by e.device_id
),
eligible as (
  select *
  from firsts
  where (cohort_month + interval '6 months')::date
        <= timezone('America/Denver', now())::date
),
returned as (
  select distinct f.device_id, f.cohort_month
  from eligible f
  join public.events e
    on e.device_id = f.device_id
   and e.name = 'session_started'
   and e.occurred_at > f.first_session_at
   and e.occurred_at <= f.first_session_at + interval '183 days'
)
select
  e.cohort_month as month,
  count(*)::bigint as cohort,
  count(r.device_id)::bigint as returned,
  case
    when count(*) = 0 then null
    else round(count(r.device_id)::numeric / count(*)::numeric, 4)
  end as return_rate
from eligible e
left join returned r
  on r.device_id = e.device_id and r.cohort_month = e.cohort_month
group by e.cohort_month;

-- Participation (G19: omit % read within 14 days and median days to grown)
create or replace view public.v_dash_participation
  with (security_invoker = true)
as
select
  public.fn_denver_month(j.submitted_at) as month,
  j.kind::text as kind,
  count(*)::bigint as entry_count,
  count(distinct j.device_id)::bigint as unique_contributors,
  round(
    avg(case when j.written_on_site then 1.0 else 0.0 end)::numeric,
    4
  ) as pct_on_site,
  round(
    avg(case when j.status = 'grown' then 1.0 else 0.0 end)::numeric,
    4
  ) as pct_grown
from public.journal_entries j
group by 1, 2;

-- Contribution-return (G7): contributor = ≥1 journal within 14d of first session
create or replace view public.v_dash_contribution_return
  with (security_invoker = true)
as
with firsts as (
  select
    e.device_id,
    min(e.occurred_at) as first_session_at,
    public.fn_denver_month(min(e.occurred_at)) as cohort_month
  from public.events e
  where e.name = 'session_started'
  group by e.device_id
),
eligible as (
  select *
  from firsts
  where (cohort_month + interval '6 months')::date
        <= timezone('America/Denver', now())::date
),
contributors as (
  select distinct f.device_id, f.cohort_month
  from eligible f
  join public.journal_entries j on j.device_id = f.device_id
  where j.submitted_at >= f.first_session_at
    and j.submitted_at < f.first_session_at + interval '14 days'
),
returned as (
  select distinct f.device_id, f.cohort_month
  from eligible f
  join public.events e
    on e.device_id = f.device_id
   and e.name = 'session_started'
   and e.occurred_at > f.first_session_at
   and e.occurred_at <= f.first_session_at + interval '183 days'
),
labeled as (
  select
    e.device_id,
    e.cohort_month,
    (c.device_id is not null) as is_contributor,
    (r.device_id is not null) as did_return
  from eligible e
  left join contributors c
    on c.device_id = e.device_id and c.cohort_month = e.cohort_month
  left join returned r
    on r.device_id = e.device_id and r.cohort_month = e.cohort_month
)
select
  cohort_month as month,
  count(*) filter (where is_contributor)::bigint as contributor_n,
  count(*) filter (where is_contributor and did_return)::bigint as contributor_returned,
  case
    when count(*) filter (where is_contributor) = 0 then null
    else round(
      count(*) filter (where is_contributor and did_return)::numeric
      / count(*) filter (where is_contributor)::numeric,
      4
    )
  end as contributor_return_rate,
  count(*) filter (where not is_contributor)::bigint as non_contributor_n,
  count(*) filter (where not is_contributor and did_return)::bigint as non_contributor_returned,
  case
    when count(*) filter (where not is_contributor) = 0 then null
    else round(
      count(*) filter (where not is_contributor and did_return)::numeric
      / count(*) filter (where not is_contributor)::numeric,
      4
    )
  end as non_contributor_return_rate
from labeled
group by cohort_month;

-- Check-ins (G20): response rate from checkin_submitted / (submitted + skipped)
create or replace view public.v_dash_checkins
  with (security_invoker = true)
as
with ev as (
  select
    public.fn_denver_month(e.occurred_at) as month,
    e.name,
    count(*)::bigint as n
  from public.events e
  where e.name in ('checkin_submitted', 'checkin_skipped')
  group by 1, 2
),
pivot as (
  select
    month,
    coalesce(sum(n) filter (where name = 'checkin_submitted'), 0)::bigint as submitted,
    coalesce(sum(n) filter (where name = 'checkin_skipped'), 0)::bigint as skipped
  from ev
  group by month
),
means as (
  select
    public.fn_denver_month(c.submitted_at) as month,
    count(*)::bigint as checkin_rows,
    round(avg(c.place_now - c.place_before)::numeric, 4) as mean_place_change,
    round(avg(c.people_now - c.people_before)::numeric, 4) as mean_people_change
  from public.checkins c
  group by 1
)
select
  coalesce(p.month, m.month) as month,
  coalesce(p.submitted, 0)::bigint as submitted,
  coalesce(p.skipped, 0)::bigint as skipped,
  case
    when coalesce(p.submitted, 0) + coalesce(p.skipped, 0) = 0 then null
    else round(
      coalesce(p.submitted, 0)::numeric
      / (coalesce(p.submitted, 0) + coalesce(p.skipped, 0))::numeric,
      4
    )
  end as response_rate,
  coalesce(m.checkin_rows, 0)::bigint as checkin_rows,
  m.mean_place_change,
  m.mean_people_change
from pivot p
full outer join means m on m.month = p.month;

-- Grants: authenticated only; revoke anon/public
do $$
declare
  v text;
begin
  foreach v in array array[
    'v_dash_visits',
    'v_dash_session_starts',
    'v_dash_fragments_completed',
    'v_dash_depth',
    'v_dash_return_6mo',
    'v_dash_participation',
    'v_dash_contribution_return',
    'v_dash_checkins'
  ]
  loop
    execute format('revoke all on table public.%I from anon, public', v);
    execute format('grant select on table public.%I to authenticated', v);
  end loop;
end $$;
