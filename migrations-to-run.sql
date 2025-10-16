================================================================================
MANUAL MIGRATION REQUIRED
================================================================================

Your Supabase database is missing tables. Please run these migrations:

1. Go to: https://supabase.com/dashboard/project/aveujrwionxljrutvsze/sql/new
2. Copy and paste each SQL file below into the SQL editor
3. Click "Run" for each migration

================================================================================

--- MIGRATION 1: 20250101_init_profiles.sql ---

-- ============================================================
-- Initial Profiles Table Migration
-- Date: 2025-01-01
-- Purpose: Create profiles table for user data
-- ============================================================

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_id TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  name TEXT,
  avatar_url TEXT,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro')),
  subscription_status TEXT,
  subscribed_until TIMESTAMPTZ,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  comments_analyzed_count INTEGER DEFAULT 0,
  replies_generated_count INTEGER DEFAULT 0,
  reset_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS profiles_google_id_idx ON public.profiles(google_id);
CREATE INDEX IF NOT EXISTS profiles_email_idx ON public.profiles(email);
CREATE INDEX IF NOT EXISTS profiles_stripe_customer_id_idx ON public.profiles(stripe_customer_id);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "profiles self-select"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "profiles self-update"
ON public.profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Grant permissions
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- Comments
COMMENT ON TABLE public.profiles IS 'User profiles with subscription and usage tracking';
COMMENT ON COLUMN public.profiles.google_id IS 'Google user ID from OAuth';
COMMENT ON COLUMN public.profiles.tier IS 'Subscription tier: free or pro';


================================================================================

--- MIGRATION 2: 20250110_harden_rls_privileges.sql ---

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


================================================================================

--- MIGRATION 3: 20251011_atomic_quota.sql ---

-- Atomic quota consumers for analyze/reply
-- Ensures at most _cap increments succeed concurrently for a given user.
-- These functions use SECURITY DEFINER to bypass RLS and execute as owner.

create or replace function public.consume_analyze_quota(_user_id uuid, _cap int)
returns table(allowed boolean, new_count int)
language sql
security definer
set search_path = public
as $$
  update public.profiles
     set comments_analyzed_count = comments_analyzed_count + 1
   where id = _user_id
     and comments_analyzed_count < _cap
   returning true as allowed, comments_analyzed_count as new_count
$$;

create or replace function public.consume_reply_quota(_user_id uuid, _cap int)
returns table(allowed boolean, new_count int)
language sql
security definer
set search_path = public
as $$
  update public.profiles
     set replies_generated_count = replies_generated_count + 1
   where id = _user_id
     and replies_generated_count < _cap
   returning true as allowed, replies_generated_count as new_count
$$;

-- Grant execute to authenticated role (server uses service role which has all permissions)
-- These are called from the Node server, not from browser clients
grant execute on function public.consume_analyze_quota(uuid, int) to authenticated;
grant execute on function public.consume_reply_quota(uuid, int) to authenticated;


================================================================================

--- MIGRATION 4: 20251013_youtube_oauth_tokens.sql ---

-- ============================================================
-- YouTube OAuth Tokens Migration
-- Date: 2025-10-13
-- Purpose: Add YouTube OAuth token storage to profiles table
-- ============================================================

-- Add YouTube OAuth token columns to profiles table (idempotent)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS youtube_access_token TEXT,
  ADD COLUMN IF NOT EXISTS youtube_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS youtube_token_expiry TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS youtube_scope TEXT,
  ADD COLUMN IF NOT EXISTS youtube_token_type TEXT;

-- Ensure RLS is enabled on profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create self-update policy (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles'
    AND policyname = 'profiles self-update'
  ) THEN
    CREATE POLICY "profiles self-update"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);
  END IF;
END$$;

-- Add column comments for documentation
COMMENT ON COLUMN public.profiles.youtube_access_token IS
  'YouTube OAuth access token for API calls. Server manages via service_role.';

COMMENT ON COLUMN public.profiles.youtube_refresh_token IS
  'YouTube OAuth refresh token. Only returned on first consent. Server-managed.';

COMMENT ON COLUMN public.profiles.youtube_token_expiry IS
  'Expiry timestamp for access token. Used for proactive refresh.';

COMMENT ON COLUMN public.profiles.youtube_scope IS
  'Granted OAuth scopes (space-separated). Should include youtube.readonly and youtube.force-ssl.';

COMMENT ON COLUMN public.profiles.youtube_token_type IS
  'Token type (typically "Bearer"). Stored for OAuth2 spec compliance.';


================================================================================

--- MIGRATION 5: 20251015_channel_persistence.sql ---

-- Cached uploads per user
create table if not exists user_videos (
  user_id uuid not null references auth.users(id) on delete cascade,
  video_id text not null,
  title text not null,
  thumbnail_url text,
  published_at timestamptz,
  stats jsonb default '{}'::jsonb, -- views, likes, commentCount, etc
  fetched_at timestamptz default now(),
  primary key (user_id, video_id)
);

-- Index for efficient lookups by user
create index if not exists user_videos_user_idx on user_videos (user_id, fetched_at desc);

-- Persisted analyses (store multiple runs; fetch latest)
create table if not exists video_analyses (
  user_id uuid not null references auth.users(id) on delete cascade,
  video_id text not null,
  analyzed_at timestamptz default now(),
  sentiment jsonb not null,  -- {pos, neu, neg}
  score numeric not null,    -- normalized [0..1] "positivity" score
  top_positive jsonb default '[]'::jsonb,
  top_negative jsonb default '[]'::jsonb,
  summary text,
  raw jsonb,
  primary key (user_id, video_id, analyzed_at)
);

-- Index for efficient lookups by user and video, ordered by time descending
create index if not exists video_analyses_ix on video_analyses (user_id, video_id, analyzed_at desc);

-- Index for trends queries
create index if not exists video_analyses_user_time_idx on video_analyses (user_id, analyzed_at desc);

-- Enable Row Level Security
alter table user_videos enable row level security;
alter table video_analyses enable row level security;

-- RLS Policies: Users can only see their own data
create policy "Users can view their own videos"
  on user_videos for select
  using (auth.uid() = user_id);

create policy "Users can insert their own videos"
  on user_videos for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own videos"
  on user_videos for update
  using (auth.uid() = user_id);

create policy "Users can delete their own videos"
  on user_videos for delete
  using (auth.uid() = user_id);

create policy "Users can view their own analyses"
  on video_analyses for select
  using (auth.uid() = user_id);

create policy "Users can insert their own analyses"
  on video_analyses for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own analyses"
  on video_analyses for update
  using (auth.uid() = user_id);

create policy "Users can delete their own analyses"
  on video_analyses for delete
  using (auth.uid() = user_id);


================================================================================

✅ After running all migrations, restart your backend server.

