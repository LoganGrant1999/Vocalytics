import { FastifyInstance } from 'fastify';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { getUsageStats } from '../../db/rateLimits.js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

const stripe = stripeSecretKey ? new Stripe(stripeSecretKey, {
  apiVersion: '2025-09-30.clover' as any
}) : null;

export async function meRoutes(fastify: FastifyInstance) {
  // Get subscription status
  fastify.get('/me/subscription', async (request: any, reply) => {
    const auth = request.auth;
    const userId = auth?.userId || auth?.userDbId;

    if (!userId) {
      return reply.code(401).send({
        error: 'Unauthorized',
        message: 'Missing user ID'
      });
    }

    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      const { data: user, error } = await supabase
        .from('profiles')
        .select('tier, subscription_status, subscribed_until, stripe_customer_id, stripe_subscription_id, youtube_scope')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('[me.ts] Supabase error fetching subscription:', {
          userId,
          error: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        });
        return reply.code(404).send({
          error: 'Not Found',
          message: 'User not found'
        });
      }

      if (!user) {
        console.error('[me.ts] No user found in profiles table for userId:', userId);
        return reply.code(404).send({
          error: 'Not Found',
          message: 'User not found'
        });
      }

      // Fetch subscription details from Stripe if user has an active subscription
      let nextPaymentDate = null;
      let cancelAtPeriodEnd = false;

      if (user.stripe_subscription_id && stripe) {
        try {
          // Add 5-second timeout to prevent blocking
          const subscription = await Promise.race([
            stripe.subscriptions.retrieve(user.stripe_subscription_id),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Stripe API timeout')), 5000)
            )
          ]) as any;

          // Try to get current_period_end, fallback to calculating from billing_cycle_anchor
          let periodEnd = (subscription as any).current_period_end;

          if (!periodEnd && subscription.billing_cycle_anchor && subscription.plan) {
            // Calculate next billing date based on interval
            const anchor = subscription.billing_cycle_anchor;
            const interval = subscription.plan.interval; // 'month', 'year', etc.
            const intervalCount = subscription.plan.interval_count || 1;

            const anchorDate = new Date(anchor * 1000);
            const now = new Date();

            // Calculate periods elapsed since anchor
            let nextBillingDate = new Date(anchorDate);
            while (nextBillingDate <= now) {
              if (interval === 'month') {
                nextBillingDate.setMonth(nextBillingDate.getMonth() + intervalCount);
              } else if (interval === 'year') {
                nextBillingDate.setFullYear(nextBillingDate.getFullYear() + intervalCount);
              }
            }

            periodEnd = Math.floor(nextBillingDate.getTime() / 1000);
          }

          if (periodEnd) {
            nextPaymentDate = new Date(periodEnd * 1000).toISOString();
          }
          cancelAtPeriodEnd = subscription.cancel_at_period_end;
        } catch (stripeError) {
          console.error('Error fetching Stripe subscription:', stripeError);
          // Continue without Stripe data - don't fail the whole request
        }
      }

      return reply.send({
        tier: user.tier,
        subscription_status: user.subscription_status,
        subscribed_until: user.subscribed_until,
        next_payment_date: nextPaymentDate,
        cancel_at_period_end: cancelAtPeriodEnd,
        stripe_customer_id: user.stripe_customer_id,
        stripe_subscription_id: user.stripe_subscription_id,
        scopes: user.youtube_scope ? user.youtube_scope.split(' ') : []
      });
    } catch (error: any) {
      console.error('Error fetching subscription:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  });

  // Get usage stats
  // Returns monthly/daily usage for rate limiting progress bar
  fastify.get('/me/usage', async (request: any, reply) => {
    const auth = request.auth;
    const userId = auth?.userId || auth?.userDbId;

    if (!userId) {
      return reply.code(401).send({
        code: 'UNAUTHORIZED',
        message: 'Missing auth'
      });
    }

    try {
      const stats = await getUsageStats(userId);
      return reply.send(stats);
    } catch (error: any) {
      console.error('[me.ts] Error fetching usage stats:', error);

      // If usage counter not found, user may not have usage row yet
      if (error.message === 'Usage counter not found') {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Usage data not initialized'
        });
      }

      return reply.code(500).send({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  });

  // Get dashboard stats (only from user's own videos)
  fastify.get('/me/dashboard-stats', async (request: any, reply) => {
    const auth = request.auth;
    const userId = auth?.userId || auth?.userDbId;

    if (!userId) {
      return reply.code(401).send({
        code: 'UNAUTHORIZED',
        message: 'Missing auth'
      });
    }

    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Count new comments in last 24h (based on when they were published)
      // Only count top-level comments (exclude replies which have dots in the ID)
      const { data: newCommentsData } = await supabase
        .from('comment_scores')
        .select('comment_id')
        .eq('user_id', userId)
        .gte('published_at', yesterday.toISOString());

      const newComments24h = (newCommentsData || []).filter(
        (item: any) => !item.comment_id.includes('.')
      ).length;

      // Count high-priority comments to reply to (priority >= 40)
      const { data: highPriorityData } = await supabase
        .from('comment_scores')
        .select('video_id, comment_id, priority_score')
        .eq('user_id', userId)
        .gte('priority_score', 40)
        .or('dismissed.is.null,dismissed.eq.false'); // Exclude dismissed comments

      // Filter out comments that have been replied to AND reply comments (not top-level)
      let filteredHighPriority = highPriorityData || [];
      if (highPriorityData && highPriorityData.length > 0) {
        const { data: postedReplies } = await supabase
          .from('posted_replies')
          .select('comment_id')
          .eq('user_id', userId);

        const repliedCommentIds = new Set((postedReplies || []).map((r: any) => r.comment_id));

        // Filter out:
        // 1. Comments that have been replied to (in posted_replies table)
        // 2. Reply comments themselves (comment_id contains a dot)
        filteredHighPriority = highPriorityData.filter((item: any) =>
          !repliedCommentIds.has(item.comment_id) &&
          !item.comment_id.includes('.')
        );
      }

      const highPriorityCount = filteredHighPriority.length;

      console.log(`[dashboard-stats] High-priority count: ${highPriorityCount}, videos:`,
        filteredHighPriority?.map(d => d.video_id));

      // Count replies ready to send (comments with suggested_reply that haven't been posted)
      const { data: repliesReadyData, error: repliesError } = await supabase
        .from('comment_scores')
        .select('comment_id, suggested_reply')
        .eq('user_id', userId)
        .not('suggested_reply', 'is', null)
        .or('dismissed.is.null,dismissed.eq.false'); // Exclude dismissed comments

      console.log(`[dashboard-stats] Replies with suggested_reply:`, repliesReadyData?.length || 0, 'error:', repliesError);

      // Filter out comments that have been replied to AND reply comments (not top-level)
      let repliesReady = repliesReadyData || [];
      if (repliesReadyData && repliesReadyData.length > 0) {
        const { data: postedReplies } = await supabase
          .from('posted_replies')
          .select('comment_id')
          .eq('user_id', userId);

        const repliedCommentIds = new Set((postedReplies || []).map((r: any) => r.comment_id));
        console.log(`[dashboard-stats] Posted replies count:`, postedReplies?.length || 0);

        // Filter out:
        // 1. Comments that have been replied to (in posted_replies table)
        // 2. Reply comments themselves (comment_id contains a dot)
        repliesReady = repliesReadyData.filter((item: any) =>
          !repliedCommentIds.has(item.comment_id) &&
          !item.comment_id.includes('.')
        );
      }

      const repliesReadyCount = repliesReady.length;
      console.log(`[dashboard-stats] Replies ready count:`, repliesReadyCount);

      // Calculate time saved today based on SENT replies (not just drafted)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { data: repliesPostedToday } = await supabase
        .from('posted_replies')
        .select('comment_id')
        .eq('user_id', userId)
        .gte('posted_at', today.toISOString());

      const timeSavedMinutes = (repliesPostedToday?.length || 0) * 3;

      // Get comparison: comments from most recent video vs previous
      const { data: recentAnalyses } = await supabase
        .from('video_analyses')
        .select('raw')
        .eq('user_id', userId)
        .order('analyzed_at', { ascending: false })
        .limit(2);

      let changePercent = 0;
      if (recentAnalyses && recentAnalyses.length >= 2) {
        const latestCount = (recentAnalyses[0].raw as any)?.totalComments || 0;
        const previousCount = (recentAnalyses[1].raw as any)?.totalComments || 0;
        if (previousCount > 0) {
          changePercent = Math.round(((latestCount - previousCount) / previousCount) * 100);
        }
      }

      return reply.send({
        newComments24h: newComments24h || 0,
        newCommentsChange: changePercent,
        highPriorityToReply: highPriorityCount || 0,
        repliesReady: repliesReadyCount || 0,
        timeSavedMinutes
      });
    } catch (error: any) {
      console.error('[me.ts] Error fetching dashboard stats:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  });

}
