-- Rate Limits Migration: Free=50/mo, Pro=unlimited with 100/day posting cap
-- Created: 2025-10-31
-- FIXED: Handles orphaned profiles gracefully

-- ============================================================================
-- 0. Clean up orphaned profiles (optional - run first if needed)
-- ============================================================================
-- This removes profiles that don't have corresponding auth.users entries
-- Uncomment if you want to clean up orphaned data:
-- DELETE FROM profiles WHERE id NOT IN (SELECT id FROM auth.users);

-- ============================================================================
-- 1. Plans table (enum-like with rows)
-- ============================================================================
create table if not exists plans (
  id text primary key,           -- 'free' | 'pro'
  monthly_ai_replies_limit int,  -- null means unlimited
  daily_post_cap int             -- null means unlimited post rate
);

comment on table plans is 'Rate limit configurations per plan tier';
comment on column plans.monthly_ai_replies_limit is 'Max AI replies per month (null = unlimited)';
comment on column plans.daily_post_cap is 'Max posted replies per day (null = unlimited)';

-- Insert Free plan: 50 replies/month, 25 posts/day
insert into plans (id, monthly_ai_replies_limit, daily_post_cap)
  values ('free', 50, 25)
on conflict (id) do update set
  monthly_ai_replies_limit = excluded.monthly_ai_replies_limit,
  daily_post_cap = excluded.daily_post_cap;

-- Insert Pro plan: unlimited monthly, 100 posts/day fair-use cap
insert into plans (id, monthly_ai_replies_limit, daily_post_cap)
  values ('pro', null, 100)
on conflict (id) do update set
  monthly_ai_replies_limit = excluded.monthly_ai_replies_limit,
  daily_post_cap = excluded.daily_post_cap;

-- ============================================================================
-- 2. Per-user usage counters
-- ============================================================================
create table if not exists usage_counters (
  user_id uuid primary key,  -- Changed: remove FK constraint to avoid orphan issues
  plan_id text not null references plans(id),

  -- Replies generated/posted this month
  replies_used_month int not null default 0,
  month_start date not null default (date_trunc('month', now())::date),

  -- Replies actually posted to YouTube today (for fair-use)
  replies_posted_today int not null default 0,
  day_start date not null default (now()::date),

  -- Queue stats
  queued_replies int not null default 0,

  updated_at timestamptz not null default now()
);

comment on table usage_counters is 'Per-user usage tracking for rate limits';
comment on column usage_counters.replies_used_month is 'Total AI replies used this month';
comment on column usage_counters.replies_posted_today is 'Replies posted to YouTube today';
comment on column usage_counters.queued_replies is 'Replies waiting in queue to be posted';

create index if not exists usage_counters_plan_idx on usage_counters (plan_id);
create index if not exists usage_counters_updated_at_idx on usage_counters (updated_at);

-- ============================================================================
-- 3. Function to roll month/day counters forward
-- ============================================================================
create or replace function public.roll_usage_counters()
returns void
language plpgsql
security definer
as $$
begin
  update usage_counters
  set
    -- Reset monthly counter if we're in a new month
    replies_used_month = case
      when month_start < date_trunc('month', now())::date
      then 0
      else replies_used_month
    end,
    month_start = case
      when month_start < date_trunc('month', now())::date
      then date_trunc('month', now())::date
      else month_start
    end,
    -- Reset daily counter if we're on a new day
    replies_posted_today = case
      when day_start < now()::date
      then 0
      else replies_posted_today
    end,
    day_start = case
      when day_start < now()::date
      then now()::date
      else day_start
    end,
    updated_at = now()
  where
    month_start < date_trunc('month', now())::date
    or day_start < now()::date;
end;
$$;

comment on function public.roll_usage_counters is 'Resets usage counters when month/day boundaries are crossed';

-- ============================================================================
-- 3b. Function to atomically consume reply allowance
-- ============================================================================
create or replace function public.consume_reply_allowance(
  _user_id uuid,
  _increment_daily boolean
)
returns void
language plpgsql
security definer
as $$
begin
  update usage_counters
  set
    replies_used_month = replies_used_month + 1,
    replies_posted_today = case
      when _increment_daily then replies_posted_today + 1
      else replies_posted_today
    end,
    updated_at = now()
  where user_id = _user_id;
end;
$$;

comment on function public.consume_reply_allowance is 'Atomically increments reply usage counters';

-- ============================================================================
-- 3c. Function to atomically increment monthly counter only
-- ============================================================================
create or replace function public.increment_monthly_counter(
  _user_id uuid
)
returns void
language plpgsql
security definer
as $$
begin
  update usage_counters
  set
    replies_used_month = replies_used_month + 1,
    updated_at = now()
  where user_id = _user_id;
end;
$$;

comment on function public.increment_monthly_counter is 'Atomically increments monthly counter for reply generation';

-- ============================================================================
-- 3d. Function to atomically increment daily counter only
-- ============================================================================
create or replace function public.increment_daily_counter(
  _user_id uuid
)
returns void
language plpgsql
security definer
as $$
begin
  update usage_counters
  set
    replies_posted_today = replies_posted_today + 1,
    updated_at = now()
  where user_id = _user_id;
end;
$$;

comment on function public.increment_daily_counter is 'Atomically increments daily posting counter';

-- ============================================================================
-- 3e. Function to atomically increment queued counter
-- ============================================================================
create or replace function public.increment_queued_counter(
  _user_id uuid
)
returns void
language plpgsql
security definer
as $$
begin
  update usage_counters
  set
    queued_replies = queued_replies + 1,
    updated_at = now()
  where user_id = _user_id;
end;
$$;

comment on function public.increment_queued_counter is 'Atomically increments queued replies counter';

-- ============================================================================
-- 3f. Function to atomically decrement queued counter
-- ============================================================================
create or replace function public.decrement_queued_counter(
  _user_id uuid
)
returns void
language plpgsql
security definer
as $$
begin
  update usage_counters
  set
    queued_replies = greatest(queued_replies - 1, 0),
    updated_at = now()
  where user_id = _user_id;
end;
$$;

comment on function public.decrement_queued_counter is 'Atomically decrements queued replies counter';

-- ============================================================================
-- 4. Reply queue for deferred posting
-- ============================================================================
create table if not exists reply_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,  -- Changed: remove FK to avoid orphan issues
  comment_id text not null,
  reply_text text not null,
  video_id text,
  status text not null default 'pending', -- 'pending' | 'posted' | 'failed'
  error_message text,
  created_at timestamptz not null default now(),
  posted_at timestamptz,
  attempts int not null default 0,
  max_attempts int not null default 3
);

comment on table reply_queue is 'Queue for replies that exceed daily posting cap';
comment on column reply_queue.status is 'pending: waiting to post, posted: successfully posted, failed: max retries exceeded';

create index if not exists reply_queue_user_id_idx on reply_queue (user_id);
create index if not exists reply_queue_status_idx on reply_queue (status);
create index if not exists reply_queue_created_at_idx on reply_queue (created_at);

-- ============================================================================
-- 5. RLS Policies
-- ============================================================================

-- Plans table: readable by all authenticated users
alter table plans enable row level security;

drop policy if exists "plans are readable by authenticated users" on plans;
create policy "plans are readable by authenticated users"
  on plans for select
  using (auth.role() = 'authenticated');

-- Usage counters: users can only read their own
alter table usage_counters enable row level security;

drop policy if exists "user can read own usage" on usage_counters;
create policy "user can read own usage"
  on usage_counters for select
  using (auth.uid() = user_id);

drop policy if exists "user cannot insert directly" on usage_counters;
create policy "user cannot insert directly"
  on usage_counters for insert
  with check (false);

drop policy if exists "user cannot update directly" on usage_counters;
create policy "user cannot update directly"
  on usage_counters for update
  using (false);

-- Reply queue: users can only read their own queued replies
alter table reply_queue enable row level security;

drop policy if exists "user can read own queue" on reply_queue;
create policy "user can read own queue"
  on reply_queue for select
  using (auth.uid() = user_id);

drop policy if exists "user cannot modify queue directly" on reply_queue;
create policy "user cannot modify queue directly"
  on reply_queue for all
  using (false);

-- ============================================================================
-- 6. Initialize usage_counters for existing users
-- ============================================================================

-- Sync existing users from profiles table
-- Skip any profiles that might be orphaned
insert into usage_counters (user_id, plan_id)
select
  p.id as user_id,
  coalesce(p.tier, 'free') as plan_id
from profiles p
where p.id not in (select user_id from usage_counters)
on conflict (user_id) do nothing;

-- ============================================================================
-- 7. Trigger to auto-create usage_counter on profile creation
-- ============================================================================

create or replace function public.handle_new_user_usage_counter()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into usage_counters (user_id, plan_id)
  values (new.id, coalesce(new.tier, 'free'))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_profile_created_usage_counter on profiles;
create trigger on_profile_created_usage_counter
  after insert on profiles
  for each row
  execute function public.handle_new_user_usage_counter();

-- ============================================================================
-- 8. Trigger to sync plan changes from profiles.tier to usage_counters.plan_id
-- ============================================================================

create or replace function public.sync_usage_counter_plan()
returns trigger
language plpgsql
security definer
as $$
begin
  if old.tier is distinct from new.tier then
    update usage_counters
    set
      plan_id = new.tier,
      updated_at = now()
    where user_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_profile_tier_changed on profiles;
create trigger on_profile_tier_changed
  after update on profiles
  for each row
  when (old.tier is distinct from new.tier)
  execute function public.sync_usage_counter_plan();

-- ============================================================================
-- Done
-- ============================================================================
