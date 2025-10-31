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

}
