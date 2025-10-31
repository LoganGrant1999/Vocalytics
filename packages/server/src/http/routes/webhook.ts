import { FastifyInstance } from 'fastify';
import Stripe from 'stripe';
import { recordStripeEvent, markStripeEventProcessed } from '../../db/stripe.js';
import { supabase } from '../../db/client.js';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!stripeSecretKey) {
  throw new Error('STRIPE_SECRET_KEY must be set');
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2025-09-30.clover' as any
});

export async function webhookRoute(fastify: FastifyInstance) {
  fastify.post(
    '/webhook/stripe',
    {
      config: {
        rawBody: true
      }
    },
    async (request: any, reply) => {
      const signature = request.headers['stripe-signature'];

      if (!signature) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Missing stripe-signature header'
        });
      }

      let event: Stripe.Event;

      try {
        // Verify webhook signature
        if (webhookSecret) {
          const rawBody = request.rawBody || request.body;
          event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
        } else {
          // In development/testing, skip verification
          console.warn('STRIPE_WEBHOOK_SECRET not set - skipping signature verification (local dev)');
          try {
            const rawBody = request.rawBody || request.body;
            event = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
          } catch (parseErr: any) {
            console.error('Failed to parse webhook body:', parseErr.message);
            return reply.code(400).send({
              error: 'Bad Request',
              message: 'Invalid JSON in webhook body'
            });
          }
        }
      } catch (err: any) {
        console.error('Webhook signature verification failed:', err.message);
        return reply.code(400).send({
          error: 'Webhook Error',
          message: `Webhook signature verification failed: ${err.message}`
        });
      }

      try {
        // Record event in database (idempotency check)
        const { isNew } = await recordStripeEvent({
          eventId: event.id,
          type: event.type,
          payload: event.data.object as any
        });

        if (!isNew) {
          // Already processed this event
          console.log(`Duplicate event ${event.id}, skipping`);
          return reply.send({ received: true, duplicate: true });
        }

        // Process the event
        await processStripeEvent(event);

        // Mark as processed
        await markStripeEventProcessed(event.id);

        return reply.send({ received: true });
      } catch (error: any) {
        console.error('Error processing webhook:', error);
        return reply.code(500).send({
          error: 'Internal Server Error',
          message: error.message
        });
      }
    }
  );
}

async function processStripeEvent(event: Stripe.Event): Promise<void> {
  console.log(`Processing event: ${event.type}`);

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      await handleCheckoutCompleted(session);
      break;
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionChange(subscription);
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionDeleted(subscription);
      break;
    }

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const customerId = session.customer as string;
  // Note: appUserId for potential future use in logging/debugging
  // const appUserId = session.client_reference_id || session.metadata?.user_id;

  if (!customerId) {
    console.error('No customer ID in checkout session');
    return;
  }

  // Find user by customer ID in profiles table
  const { data: user, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!user || error) {
    console.error(`User not found for customer ${customerId}:`, error?.message);
    return;
  }

  console.log(`Checkout completed for user ${user.id}`);

  // If the session has a subscription, fetch it and update the user
  if (session.subscription) {
    const subscriptionId = typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription.id;

    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);

      // Update user with subscription details and upgrade to pro
      const status = subscription.status;
      const periodEnd = (subscription as any).current_period_end;
      const currentPeriodEnd = periodEnd ? new Date(periodEnd * 1000) : null;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          stripe_subscription_id: subscription.id,
          subscription_status: status,
          subscribed_until: currentPeriodEnd?.toISOString() || null,
          tier: status === 'active' ? 'pro' : user.tier
        })
        .eq('id', user.id);

      if (updateError) {
        throw new Error(`Failed to update user ${user.id}: ${updateError.message}`);
      }

      console.log(`User ${user.id} upgraded to pro via checkout completion`);
    } catch (subError: any) {
      console.error(`Failed to retrieve/update subscription for checkout:`, subError.message);
    }
  }
}

async function handleSubscriptionChange(subscription: Stripe.Subscription): Promise<void> {
  const customerId = subscription.customer as string;

  // Find user by customer ID in profiles table
  const { data: user, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!user || error) {
    console.error(`User not found for customer ${customerId}:`, error?.message);
    return;
  }

  const status = subscription.status;
  // Access the property with type assertion for compatibility
  const periodEnd = (subscription as any).current_period_end;
  const currentPeriodEnd = periodEnd ? new Date(periodEnd * 1000) : null;

  // Prevent out-of-order webhook processing:
  // If user already has a subscribed_until date that's LATER than this event,
  // skip this update (it's an older event arriving late)
  if (user.subscribed_until && currentPeriodEnd) {
    const existingUntil = new Date(user.subscribed_until);
    if (existingUntil > currentPeriodEnd) {
      console.log(`Skipping out-of-order webhook for user ${user.id}: existing until ${existingUntil} > event until ${currentPeriodEnd}`);
      return;
    }
  }

  // Update user subscription info
  const updates: any = {
    stripe_subscription_id: subscription.id,
    subscription_status: status,
    subscribed_until: currentPeriodEnd?.toISOString() || null,
    // Set tier to pro if subscription is active
    tier: status === 'active' ? 'pro' : user.tier
  };

  const { error: updateError } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id);

  if (updateError) {
    throw new Error(`Failed to update user ${user.id}: ${updateError.message}`);
  }

  console.log(`Subscription ${status} for user ${user.id}, valid until ${currentPeriodEnd}`);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  const customerId = subscription.customer as string;

  // Find user by customer ID in profiles table
  const { data: user, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!user || error) {
    console.error(`User not found for customer ${customerId}:`, error?.message);
    return;
  }

  // Prevent out-of-order webhook processing:
  // Only process deletion if this subscription ID matches the user's current subscription
  // If they have a different (newer) subscription, skip this deletion event
  if (user.stripe_subscription_id && user.stripe_subscription_id !== subscription.id) {
    console.log(`Skipping out-of-order deletion for user ${user.id}: user has different subscription ${user.stripe_subscription_id} vs deleted ${subscription.id}`);
    return;
  }

  // Update user subscription info - downgrade to free
  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      subscription_status: 'canceled',
      subscribed_until: null,
      tier: 'free'
    })
    .eq('id', user.id);

  if (updateError) {
    throw new Error(`Failed to update user ${user.id}: ${updateError.message}`);
  }

  console.log(`Subscription canceled for user ${user.id}`);
}
