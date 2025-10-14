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
