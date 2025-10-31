/**
 * Queue Worker
 *
 * Processes pending queued replies and posts them to YouTube when under daily cap.
 * Runs every 5 minutes via cron job.
 *
 * Workflow:
 * 1. Fetch all pending replies from reply_queue
 * 2. Group by user
 * 3. For each user, check daily posting cap
 * 4. Post replies that fit under cap
 * 5. Mark replies as posted/failed
 */

import { createClient } from '@supabase/supabase-js';
import {
  getAllPendingReplies,
  getUserUsage,
  getPlanLimits,
  incrementDailyPosted,
  markReplyPosted,
  markReplyFailed,
  rollUsageCounters,
} from '../db/rateLimits.js';
import { postCommentReply } from '../lib/google.js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface UserPostingStatus {
  userId: string;
  plan: 'free' | 'pro';
  dailyCap: number | null;
  dailyPosted: number;
  remainingToday: number;
  youtubeToken: string | null;
}

/**
 * Main worker function
 */
async function processQueue(): Promise<void> {
  console.log('[queueWorker] Starting queue processing...');

  try {
    // Roll counters forward to handle day boundaries
    await rollUsageCounters();

    // Fetch pending replies (limit 100 per run)
    const pendingReplies = await getAllPendingReplies(100);

    if (pendingReplies.length === 0) {
      console.log('[queueWorker] No pending replies to process');
      return;
    }

    console.log(`[queueWorker] Found ${pendingReplies.length} pending replies`);

    // Group replies by user
    const repliesByUser = new Map<string, typeof pendingReplies>();
    for (const reply of pendingReplies) {
      const userId = reply.user_id;
      if (!repliesByUser.has(userId)) {
        repliesByUser.set(userId, []);
      }
      repliesByUser.get(userId)!.push(reply);
    }

    console.log(`[queueWorker] Processing replies for ${repliesByUser.size} users`);

    // Process each user's queue
    for (const [userId, userReplies] of repliesByUser) {
      await processUserQueue(userId, userReplies);
    }

    console.log('[queueWorker] Queue processing complete');
  } catch (error: any) {
    console.error('[queueWorker] Fatal error processing queue:', error);
  }
}

/**
 * Process queued replies for a single user
 */
async function processUserQueue(userId: string, replies: any[]): Promise<void> {
  console.log(`[queueWorker] Processing ${replies.length} replies for user ${userId}`);

  try {
    // Get user's posting status
    const status = await getUserPostingStatus(userId);

    if (!status.youtubeToken) {
      console.error(`[queueWorker] User ${userId} has no YouTube token, skipping`);
      // Mark all their replies as failed
      for (const reply of replies) {
        await markReplyFailed({
          replyId: reply.id,
          userId,
          errorMessage: 'YouTube account disconnected',
        });
      }
      return;
    }

    // Determine how many replies we can post today
    const canPostToday = status.remainingToday === Infinity
      ? replies.length
      : Math.max(0, status.remainingToday);

    if (canPostToday === 0) {
      console.log(`[queueWorker] User ${userId} has reached daily cap, skipping`);
      return;
    }

    // Post replies up to the cap (oldest first)
    const repliesToPost = replies.slice(0, canPostToday);
    console.log(`[queueWorker] Posting ${repliesToPost.length} replies for user ${userId}`);

    for (const reply of repliesToPost) {
      try {
        // Post to YouTube
        await postCommentReply(status.youtubeToken, reply.comment_id, reply.reply_text);

        // Increment daily posting counter and mark as posted
        await incrementDailyPosted({ userId });
        await markReplyPosted({ replyId: reply.id, userId });

        console.log(`[queueWorker] Successfully posted reply ${reply.id}`);
      } catch (error: any) {
        console.error(`[queueWorker] Failed to post reply ${reply.id}:`, error);

        // Mark as failed (will retry up to max_attempts)
        await markReplyFailed({
          replyId: reply.id,
          userId,
          errorMessage: error.message || 'Unknown error',
        });
      }
    }
  } catch (error: any) {
    console.error(`[queueWorker] Error processing user ${userId} queue:`, error);
  }
}

/**
 * Get user's current posting status
 */
async function getUserPostingStatus(userId: string): Promise<UserPostingStatus> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Get user's plan and YouTube token
  const { data: profile } = await supabase
    .from('profiles')
    .select('tier, youtube_access_token')
    .eq('id', userId)
    .single();

  const plan = (profile?.tier || 'free') as 'free' | 'pro';
  const youtubeToken = profile?.youtube_access_token || null;

  // Get usage counters
  const usage = await getUserUsage(userId);
  const limits = await getPlanLimits(plan);

  if (!usage) {
    throw new Error('Usage counter not found');
  }

  const dailyCap = limits.daily_post_cap;
  const dailyPosted = usage.replies_posted_today;
  const remainingToday = dailyCap === null
    ? Infinity
    : Math.max(0, dailyCap - dailyPosted);

  return {
    userId,
    plan,
    dailyCap,
    dailyPosted,
    remainingToday,
    youtubeToken,
  };
}

/**
 * Run the worker
 */
async function main(): Promise<void> {
  console.log('[queueWorker] Worker started');
  await processQueue();
  console.log('[queueWorker] Worker finished');
  process.exit(0);
}

// Run if invoked directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('[queueWorker] Unhandled error:', error);
    process.exit(1);
  });
}

export { processQueue };
