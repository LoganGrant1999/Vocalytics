/**
 * Rate Limits Database Layer
 *
 * Implements:
 * - Free: 50 AI replies/month, 25 posts/day
 * - Pro: Unlimited monthly, 100 posts/day fair-use cap
 * - Queue system for replies exceeding daily cap
 */

import { supabase } from './client.js';

export type Plan = 'free' | 'pro';

export interface UsageCounters {
  user_id: string;
  plan_id: Plan;
  replies_used_month: number;
  month_start: string;
  replies_posted_today: number;
  day_start: string;
  queued_replies: number;
  updated_at: string;
}

export interface PlanLimits {
  id: Plan;
  monthly_ai_replies_limit: number | null;
  daily_post_cap: number | null;
}

export interface QueuedReply {
  id: string;
  user_id: string;
  comment_id: string;
  reply_text: string;
  video_id: string | null;
  status: 'pending' | 'posted' | 'failed';
  error_message: string | null;
  created_at: string;
  posted_at: string | null;
  attempts: number;
  max_attempts: number;
}

/**
 * Roll usage counters forward for all users
 * Resets monthly/daily counters when period boundaries are crossed
 */
export async function rollUsageCounters(): Promise<void> {
  const { error } = await supabase.rpc('roll_usage_counters');
  if (error) throw error;
}

/**
 * Get a user's current usage counters
 * Automatically rolls counters forward before returning
 */
export async function getUserUsage(userId: string): Promise<UsageCounters | null> {
  // Roll counters forward first
  await rollUsageCounters();

  const { data, error } = await supabase
    .from('usage_counters')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = not found
    throw error;
  }

  return data as UsageCounters | null;
}

/**
 * Get plan limits configuration
 */
export async function getPlanLimits(plan: Plan): Promise<PlanLimits> {
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('id', plan)
    .single();

  if (error) throw error;
  return data as PlanLimits;
}

/**
 * Ensure a usage counter row exists for a user
 * Creates one if missing, updates plan if changed
 */
export async function ensureUsageRow(userId: string, plan: Plan): Promise<void> {
  const { error } = await supabase
    .from('usage_counters')
    .upsert({
      user_id: userId,
      plan_id: plan,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id',
      ignoreDuplicates: false,
    });

  if (error) throw error;
}

/**
 * Check if a user can consume reply allowance
 * Returns { allowed: true } or { allowed: false, reason: string }
 * If allowed but daily cap reached, returns { allowed: true, enqueue: true }
 */
export async function checkReplyAllowance(params: {
  userId: string;
  plan: Plan;
  willPostNow: boolean;
}): Promise<
  | { allowed: true; enqueue: false }
  | { allowed: true; enqueue: true; reason: string }
  | { allowed: false; reason: string }
> {
  const { userId, plan, willPostNow } = params;

  // Get plan limits
  const limits = await getPlanLimits(plan);

  // Roll counters and get current usage
  await rollUsageCounters();
  const usage = await getUserUsage(userId);

  if (!usage) {
    throw new Error('Usage counter not found - call ensureUsageRow first');
  }

  // Check monthly limit
  const monthlyLimit = limits.monthly_ai_replies_limit;
  if (monthlyLimit !== null && usage.replies_used_month >= monthlyLimit) {
    return {
      allowed: false,
      reason: `Monthly AI reply limit reached (${monthlyLimit}/month). ${
        plan === 'free' ? 'Upgrade to Pro for unlimited replies.' : 'Please wait for monthly reset.'
      }`,
    };
  }

  // Check daily posting cap (only if actually posting now)
  if (willPostNow) {
    const dailyCap = limits.daily_post_cap;
    if (dailyCap !== null && usage.replies_posted_today >= dailyCap) {
      return {
        allowed: true,
        enqueue: true,
        reason: `Daily posting cap reached (${dailyCap}/day). Reply will be queued and posted tomorrow.`,
      };
    }
  }

  return { allowed: true, enqueue: false };
}

/**
 * Consume reply allowance atomically
 * Increments monthly counter (for generation)
 */
export async function consumeReplyAllowance(params: {
  userId: string;
}): Promise<void> {
  const { userId } = params;

  // Use RPC for atomic increment
  const { error } = await supabase.rpc('increment_monthly_counter', {
    _user_id: userId,
  });

  if (error) {
    console.error('Error consuming reply allowance:', error);
    throw error;
  }
}

/**
 * Increment daily posting counter only (for posting a reply)
 * Does NOT increment monthly counter (that was already done during generation)
 */
export async function incrementDailyPosted(params: {
  userId: string;
}): Promise<void> {
  const { userId } = params;

  // Use RPC for atomic increment
  const { error } = await supabase.rpc('increment_daily_counter', {
    _user_id: userId,
  });

  if (error) {
    console.error('Error incrementing daily counter:', error);
    throw error;
  }
}

/**
 * Queue a reply for later posting
 */
export async function queueReply(params: {
  userId: string;
  commentId: string;
  replyText: string;
  videoId?: string;
}): Promise<string> {
  const { userId, commentId, replyText, videoId } = params;

  const { data, error } = await supabase
    .from('reply_queue')
    .insert({
      user_id: userId,
      comment_id: commentId,
      reply_text: replyText,
      video_id: videoId || null,
      status: 'pending',
    })
    .select('id')
    .single();

  if (error) throw error;

  // Increment queued counter
  const { error: counterError } = await supabase.rpc('increment_queued_counter', {
    _user_id: userId,
  });

  if (counterError) throw counterError;

  return data.id;
}

/**
 * Get pending queued replies for a user
 */
export async function getPendingQueuedReplies(params: {
  userId: string;
  limit?: number;
}): Promise<QueuedReply[]> {
  const { userId, limit = 10 } = params;

  const { data, error } = await supabase
    .from('reply_queue')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return (data as QueuedReply[]) || [];
}

/**
 * Get all pending replies across users (for worker)
 */
export async function getAllPendingReplies(limit: number = 100): Promise<QueuedReply[]> {
  const { data, error } = await supabase
    .from('reply_queue')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) throw error;

  // Filter for attempts < max_attempts in JS (Supabase doesn't support column comparisons in filters)
  return ((data as QueuedReply[]) || []).filter(r => r.attempts < r.max_attempts);
}

/**
 * Mark a queued reply as posted
 */
export async function markReplyPosted(params: {
  replyId: string;
  userId: string;
}): Promise<void> {
  const { replyId, userId } = params;

  // Update queue status
  const { error: queueError } = await supabase
    .from('reply_queue')
    .update({
      status: 'posted',
      posted_at: new Date().toISOString(),
    })
    .eq('id', replyId);

  if (queueError) throw queueError;

  // Decrement queued counter
  const { error: counterError } = await supabase.rpc('decrement_queued_counter', {
    _user_id: userId,
  });

  if (counterError) throw counterError;
}

/**
 * Mark a queued reply as failed
 */
export async function markReplyFailed(params: {
  replyId: string;
  userId: string;
  errorMessage: string;
}): Promise<void> {
  const { replyId, userId, errorMessage } = params;

  // Increment attempts
  const { data: reply, error: fetchError } = await supabase
    .from('reply_queue')
    .select('attempts, max_attempts')
    .eq('id', replyId)
    .single();

  if (fetchError) throw fetchError;

  const newAttempts = (reply.attempts || 0) + 1;
  const isFinalFailure = newAttempts >= reply.max_attempts;

  // Update queue status
  const { error: queueError } = await supabase
    .from('reply_queue')
    .update({
      status: isFinalFailure ? 'failed' : 'pending',
      attempts: newAttempts,
      error_message: errorMessage,
    })
    .eq('id', replyId);

  if (queueError) throw queueError;

  // If final failure, decrement queued counter
  if (isFinalFailure) {
    const { error: counterError } = await supabase.rpc('decrement_queued_counter', {
      _user_id: userId,
    });

    if (counterError) throw counterError;
  }
}

/**
 * Get usage stats for display (for /me/usage endpoint)
 */
export async function getUsageStats(userId: string): Promise<{
  plan: Plan;
  monthlyUsed: number;
  monthlyLimit: number | null;
  dailyPosted: number;
  dailyPostCap: number | null;
  queued: number;
  resets: {
    month: string;
    day: string;
  };
}> {
  const usage = await getUserUsage(userId);
  if (!usage) {
    throw new Error('Usage counter not found');
  }

  const limits = await getPlanLimits(usage.plan_id);

  // Calculate next reset dates
  const monthStart = new Date(usage.month_start);
  const nextMonth = new Date(monthStart);
  nextMonth.setMonth(nextMonth.getMonth() + 1);

  const dayStart = new Date(usage.day_start);
  const nextDay = new Date(dayStart);
  nextDay.setDate(nextDay.getDate() + 1);

  return {
    plan: usage.plan_id,
    monthlyUsed: usage.replies_used_month,
    monthlyLimit: limits.monthly_ai_replies_limit,
    dailyPosted: usage.replies_posted_today,
    dailyPostCap: limits.daily_post_cap,
    queued: usage.queued_replies,
    resets: {
      month: nextMonth.toISOString().split('T')[0],
      day: nextDay.toISOString().split('T')[0],
    },
  };
}
