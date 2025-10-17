import { FastifyInstance } from 'fastify';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

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

      if (error || !user) {
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
          const subscription = await stripe.subscriptions.retrieve(user.stripe_subscription_id);
          // Access current_period_end with type assertion for compatibility
          const periodEnd = (subscription as any).current_period_end;
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
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      const { data: user, error } = await supabase
        .from('profiles')
        .select('comments_analyzed_count, replies_generated_count, reset_date, tier')
        .eq('id', userId)
        .single();

      if (error || !user) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'User not found'
        });
      }

      // Get limits based on tier
      const weeklyAnalyze = user.tier === 'pro' ? 10000 : parseInt(process.env.FREE_LIMIT_ANALYZE_WEEKLY || '100');
      const dailyReply = user.tier === 'pro' ? 1000 : parseInt(process.env.FREE_LIMIT_REPLY_DAILY || '50');

      return reply.send({
        commentsAnalyzed: user.comments_analyzed_count ?? 0,
        repliesGenerated: user.replies_generated_count ?? 0,
        limits: {
          weeklyAnalyze,
          dailyReply
        },
        resetDate: user.reset_date
      });
    } catch (error: any) {
      console.error('Error fetching usage:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  });

}
