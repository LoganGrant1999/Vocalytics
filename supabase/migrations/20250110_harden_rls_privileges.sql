-- ============================================================
-- Harden RLS & Privileges Migration
-- Date: 2025-10-11
-- Purpose: Lock down client access to stripe_events, usage_events, users
-- ============================================================

-- ============================================================
-- 1. STRIPE_EVENTS — Server-only (no client access)
-- ============================================================

-- Drop any existing policies (idempotent)
drop policy if exists "stripe_events_select" on public.stripe_events;
drop policy if exists "stripe_events_insert" on public.stripe_events;
drop policy if exists "stripe_events_update" on public.stripe_events;
drop policy if exists "stripe_events_delete" on public.stripe_events;

-- Revoke all privileges from anon and authenticated roles
revoke all on public.stripe_events from anon;
revoke all on public.stripe_events from authenticated;

-- Ensure RLS is enabled (already should be, but enforce)
alter table public.stripe_events enable row level security;

-- No policies = no client access; service_role bypasses RLS

comment on table public.stripe_events is
  'Server-only table. No client read/write. Service role only.';

-- ============================================================
-- 2. USAGE_EVENTS — Clients SELECT own rows; server writes
-- ============================================================

-- Drop any existing policies (idempotent)
drop policy if exists "usage_events_select_own" on public.usage_events;
drop policy if exists "usage_events_select" on public.usage_events;
drop policy if exists "usage_events_insert" on public.usage_events;
drop policy if exists "usage_events_update" on public.usage_events;
drop policy if exists "usage_events_delete" on public.usage_events;

-- Revoke all from anon (no anonymous access)
revoke all on public.usage_events from anon;

-- Grant SELECT only to authenticated
grant select on public.usage_events to authenticated;
revoke insert, update, delete on public.usage_events from authenticated;

-- Ensure RLS is enabled
alter table public.usage_events enable row level security;

-- Policy: authenticated users can SELECT only their own rows
create policy "usage_events_select_own"
  on public.usage_events
  for select
  to authenticated
  using (user_id = auth.uid());

comment on table public.usage_events is
  'Clients can SELECT own rows (user_id = auth.uid()). Server writes only.';

-- ============================================================
-- 3. USERS — Clients SELECT and UPDATE own row; optional INSERT
-- ============================================================

-- Drop any existing policies (idempotent)
drop policy if exists "users_select_own" on public.users;
drop policy if exists "users_update_own" on public.users;
drop policy if exists "users_insert_own" on public.users;
drop policy if exists "users_select" on public.users;
drop policy if exists "users_update" on public.users;
drop policy if exists "users_insert" on public.users;
drop policy if exists "users_delete" on public.users;

-- Revoke all from anon (no anonymous access)
revoke all on public.users from anon;

-- Grant SELECT and UPDATE to authenticated
grant select on public.users to authenticated;
grant update on public.users to authenticated;
grant insert on public.users to authenticated;  -- For optional self-registration
revoke delete on public.users from authenticated;  -- No client deletes

-- Ensure RLS is enabled
alter table public.users enable row level security;

-- Policy: authenticated users can SELECT only their own row
create policy "users_select_own"
  on public.users
  for select
  to authenticated
  using (id = auth.uid());

-- Policy: authenticated users can UPDATE only their own row
-- (Note: restricts which columns can be updated via CHECK if needed)
create policy "users_update_own"
  on public.users
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Policy: authenticated users can INSERT only their own row
-- (Client must provide id = auth.uid() when inserting)
create policy "users_insert_own"
  on public.users
  for insert
  to authenticated
  with check (id = auth.uid());

comment on table public.users is
  'Clients can SELECT/UPDATE/INSERT own row (id = auth.uid()). No deletes.';

-- ============================================================
-- 4. OPTIONAL: Create view for per-user usage aggregates
-- ============================================================

-- Drop if exists (idempotent)
drop view if exists public.me_usage;

-- Create view that returns aggregated usage for current user
create or replace view public.me_usage as
  select
    user_id,
    action,
    count(*) as event_count,
    sum(count) as total_count,
    max(timestamp) as last_event_at
  from public.usage_events
  where user_id = auth.uid()
  group by user_id, action;

-- Grant SELECT to authenticated
grant select on public.me_usage to authenticated;
revoke all on public.me_usage from anon;

comment on view public.me_usage is
  'Aggregate usage view. Returns only current user data (auth.uid()).';

-- ============================================================
-- 5. SANITY CHECKS — Query RLS state, policies, and grants
-- ============================================================

-- Query 1: Check RLS is enabled for all three tables
select
  schemaname,
  tablename,
  rowsecurity as rls_enabled
from pg_tables
where schemaname = 'public'
  and tablename in ('stripe_events', 'usage_events', 'users')
order by tablename;

-- Query 2: List all policies on these tables
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual as using_clause,
  with_check as with_check_clause
from pg_policies
where schemaname = 'public'
  and tablename in ('stripe_events', 'usage_events', 'users')
order by tablename, policyname;

-- Query 3: Check privilege grants for anon and authenticated
select
  table_schema,
  table_name,
  grantee,
  privilege_type
from information_schema.table_privileges
where table_schema = 'public'
  and table_name in ('stripe_events', 'usage_events', 'users')
  and grantee in ('anon', 'authenticated')
order by table_name, grantee, privilege_type;

-- ============================================================
-- 6. EXPECTED RESULTS SUMMARY
-- ============================================================

-- stripe_events:
--   RLS: enabled
--   Policies: NONE (server-only)
--   Grants: anon=NONE, authenticated=NONE

-- usage_events:
--   RLS: enabled
--   Policies: SELECT (user_id = auth.uid())
--   Grants: anon=NONE, authenticated=SELECT

-- users:
--   RLS: enabled
--   Policies: SELECT/UPDATE/INSERT (id = auth.uid())
--   Grants: anon=NONE, authenticated=SELECT,UPDATE,INSERT

-- me_usage view:
--   Grants: anon=NONE, authenticated=SELECT

-- ============================================================
-- END OF MIGRATION
-- ============================================================
