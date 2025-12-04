/**
 * Update subscription details for a user from Stripe
 * Usage: npx tsx scripts/update-subscription.ts <email>
 */

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY!;
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2025-09-30.clover' as any,
});

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function updateSubscription(email: string) {
  console.log(`Fetching user: ${email}`);

  const { data: user, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', email)
    .single();

  if (error || !user) {
    console.error('User not found:', error);
    return;
  }

  console.log(`User found: ${user.id}`);
  console.log(`Subscription ID: ${user.stripe_subscription_id}`);

  if (!user.stripe_subscription_id) {
    console.log('No subscription ID found');
    return;
  }

  console.log('Fetching subscription from Stripe...');
  const subscription = await stripe.subscriptions.retrieve(user.stripe_subscription_id);

  // Get period end from cancel_at (if cancelled) or from items
  let periodEnd = subscription.cancel_at;

  if (!periodEnd && subscription.items.data.length > 0) {
    periodEnd = (subscription.items.data[0] as any).current_period_end;
  }

  if (!periodEnd) {
    console.error('No period end date found in subscription');
    return;
  }

  const subscribedUntil = new Date(periodEnd * 1000).toISOString();

  console.log(`Subscription status: ${subscription.status}`);
  console.log(`Current period end: ${subscribedUntil}`);
  console.log(`Cancel at period end: ${subscription.cancel_at_period_end}`);

  console.log('Updating database...');
  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      subscription_status: subscription.status,
      subscribed_until: subscribedUntil,
    })
    .eq('id', user.id);

  if (updateError) {
    console.error('Update error:', updateError);
    return;
  }

  console.log('✅ Subscription updated successfully!');
  console.log(`Status: ${subscription.status}`);
  console.log(`Active until: ${subscribedUntil}`);
}

const email = process.argv[2];

if (!email) {
  console.error('Usage: npx tsx scripts/update-subscription.ts <email>');
  process.exit(1);
}

updateSubscription(email)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
