import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import 'dotenv/config';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey, {
  apiVersion: '2025-09-30.clover'
}) : null;

async function testSubscriptionAPI(email) {
  console.log(`\n=== Testing Subscription API for ${email} ===\n`);

  // Get user from database
  const { data: user, error } = await supabase
    .from('profiles')
    .select('tier, subscription_status, subscribed_until, stripe_customer_id, stripe_subscription_id, youtube_scope')
    .eq('email', email)
    .single();

  if (error || !user) {
    console.error('Error finding user:', error?.message);
    return;
  }

  console.log('Database data:');
  console.log(JSON.stringify(user, null, 2));

  // Fetch subscription details from Stripe
  let nextPaymentDate = null;
  let cancelAtPeriodEnd = false;

  if (user.stripe_subscription_id && stripe) {
    try {
      console.log('\nFetching from Stripe...');
      const subscription = await stripe.subscriptions.retrieve(user.stripe_subscription_id);
      console.log('Stripe subscription status:', subscription.status);
      console.log('Stripe subscription cancel_at_period_end:', subscription.cancel_at_period_end);
      console.log('Stripe subscription billing_cycle_anchor:', subscription.billing_cycle_anchor);
      console.log('Stripe subscription created:', subscription.created);
      console.log('Stripe subscription plan:', subscription.plan);

      const periodEnd = subscription.current_period_end;
      if (periodEnd) {
        nextPaymentDate = new Date(periodEnd * 1000).toISOString();
        console.log('Stripe current_period_end:', nextPaymentDate);
      }
      cancelAtPeriodEnd = subscription.cancel_at_period_end;
    } catch (stripeError) {
      console.error('Error fetching Stripe subscription:', stripeError.message);
    }
  }

  console.log('\n=== Final API Response ===');
  const response = {
    tier: user.tier,
    subscription_status: user.subscription_status,
    subscribed_until: user.subscribed_until,
    next_payment_date: nextPaymentDate,
    cancel_at_period_end: cancelAtPeriodEnd,
    stripe_customer_id: user.stripe_customer_id,
    stripe_subscription_id: user.stripe_subscription_id,
    scopes: user.youtube_scope ? user.youtube_scope.split(' ') : []
  };
  console.log(JSON.stringify(response, null, 2));
}

const email = process.argv[2] || 'logangibbons1999@gmail.com';
testSubscriptionAPI(email);
