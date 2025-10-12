-- ============================================================
-- TubeWhisper Supabase Schema
-- Production-Ready as of 2025-10-10
-- ============================================================

-- 1. Enable extensions
create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";
create extension if not exists pg_cron;

-- ============================================================
-- USERS TABLE
-- Tracks per-user tier, usage, and subscription linkage
-- ============================================================

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  app_user_id text unique,          -- ChatGPT app user identifier if available
  email text,                       -- Optional, from OAuth
  tier text not null check (tier in ('free','pro')) default 'free',
  comments_analyzed_count int not null default 0 check (comments_analyzed_count >= 0),
  replies_generated_count int not null default 0 check (replies_generated_count >= 0),
  reset_date date default now(),
  subscribed_until timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Helpful indexes
create index if not exists idx_users_email
  on public.users(email) where email is not null;
create index if not exists idx_users_stripe_customer
  on public.users(stripe_customer_id) where stripe_customer_id is not null;
create index if not exists idx_users_stripe_subscription
  on public.users(stripe_subscription_id) where stripe_subscription_id is not null;

-- ============================================================
-- UPDATED_AT TRIGGER
-- Automatically updates timestamp on row changes
-- ============================================================

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $
begin
  new.updated_at = now();
  return new;
end$;

drop trigger if exists trg_users_touch on public.users;
create trigger trg_users_touch
before update on public.users
for each row execute function public.touch_updated_at();

-- ============================================================
-- USAGE_EVENTS TABLE
-- Optional audit log for usage tracking (debug/analytics)
-- ============================================================

create table if not exists public.usage_events (
  id bigserial primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  action text not null check (action in ('analyze','reply')),
  count int not null default 1 check (count > 0),
  metadata jsonb,
  timestamp timestamptz not null default now()
);

create index if not exists idx_usage_user_time
  on public.usage_events(user_id, timestamp desc);

-- ============================================================
-- STRIPE_EVENTS TABLE
-- Stores webhook payloads for idempotency and replay safety
-- ============================================================

create table if not exists public.stripe_events (
  id bigserial primary key,
  event_id text not null unique,
  type text not null,
  payload jsonb not null,
  processed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_stripe_events_processed_created
  on public.stripe_events(processed, created_at desc);

-- ============================================================
-- RESET PROCEDURES
-- Weekly and daily resets for free-tier usage counters
-- ============================================================

create or replace procedure public.reset_weekly_comments()
language sql as $
  update public.users
  set comments_analyzed_count = 0,
      reset_date = now()::date
  where tier = 'free';
$;

create or replace procedure public.reset_daily_replies()
language sql as $
  update public.users
  set replies_generated_count = 0
  where tier = 'free';
$;

-- ============================================================
-- SCHEDULED JOBS (pg_cron)
-- Automatically call reset procedures on intervals
-- ============================================================

-- Schedule daily reply resets (00:00 UTC)
select cron.schedule(
  'daily_reset_replies',
  '0 0 * * *',
  $call public.reset_daily_replies();$
);

-- Schedule weekly comment resets (Monday 00:00 UTC)
select cron.schedule(
  'weekly_reset_comments',
  '0 0 * * 1',
  $call public.reset_weekly_comments();$
);

-- ============================================================
-- SECURITY / ACCESS CONTROL
-- Enable RLS so only service-role key has full access
-- ============================================================

alter table public.users enable row level security;
alter table public.usage_events enable row level security;
alter table public.stripe_events enable row level security;

-- NOTE: For production hardened RLS policies and privilege grants,
-- apply migration: supabase/migrations/20250110_harden_rls_privileges.sql
-- This adds client-scoped SELECT/UPDATE policies for users and usage_events
-- while keeping stripe_events server-only.

-- ============================================================
-- END OF SCHEMA
-- ============================================================
