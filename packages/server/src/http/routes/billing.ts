import { FastifyInstance } from 'fastify';
import Stripe from 'stripe';
import { supabase } from '../../db/client.js';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  throw new Error('STRIPE_SECRET_KEY must be set');
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2025-09-30.clover' as any
});

const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID;
const STRIPE_CHECKOUT_SUCCESS_URL = process.env.STRIPE_CHECKOUT_SUCCESS_URL || 'http://localhost:5173/billing?success=true';
const STRIPE_CHECKOUT_CANCEL_URL = process.env.STRIPE_CHECKOUT_CANCEL_URL || 'http://localhost:5173/billing?canceled=true';
const STRIPE_PORTAL_RETURN_URL = process.env.STRIPE_PORTAL_RETURN_URL || 'http://localhost:5173/billing';

export async function billingRoutes(fastify: FastifyInstance) {
  console.log('[billing.ts] Registering billing routes');
  console.log('[billing.ts] STRIPE_CHECKOUT_SUCCESS_URL:', STRIPE_CHECKOUT_SUCCESS_URL);
  console.log('[billing.ts] STRIPE_CHECKOUT_CANCEL_URL:', STRIPE_CHECKOUT_CANCEL_URL);
  console.log('[billing.ts] STRIPE_PORTAL_RETURN_URL:', STRIPE_PORTAL_RETURN_URL);

  // Test route to verify registration works
  fastify.get('/billing/test', async (request: any, reply) => {
    console.log('[billing.ts] /billing/test handler called');
    return reply.send({ message: 'Billing routes working!' });
  });

  // Create checkout session
  fastify.post('/billing/checkout', async (request: any, reply) => {
    console.log('[billing.ts] /billing/checkout handler called', {
      userId: request.auth?.userId,
      userDbId: request.auth?.userDbId,
      auth: request.auth
    });
    const auth = request.auth;

    if (!STRIPE_PRICE_ID) {
      console.log('[billing.ts] STRIPE_PRICE_ID not configured');
      return reply.code(500).send({
        error: 'Configuration Error',
        message: 'STRIPE_PRICE_ID is not configured'
      });
    }

    try {
      console.log('[billing.ts] Looking up user in profiles:', auth.userId);
      const { data: user, error: userError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', auth.userId)
        .single();

      console.log('[billing.ts] User found:', !!user, 'Error:', userError?.message);

      if (!user || userError) {
        console.log('[billing.ts] User not found in database');
        return reply.code(404).send({
          error: 'Not Found',
          message: 'User not found'
        });
      }

      let customerId = user.stripe_customer_id;

      // Create or retrieve Stripe customer
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email || undefined,
          metadata: {
            app_user_id: auth.userId,
            user_db_id: user.id
          }
        });
        customerId = customer.id;

        // Update user with customer ID
        await supabase
          .from('profiles')
          .update({ stripe_customer_id: customerId })
          .eq('id', user.id);
      }

      // Check for existing active subscription
      if (user.stripe_subscription_id) {
        const existingSubscription = await stripe.subscriptions.retrieve(user.stripe_subscription_id);
        if (existingSubscription && ['active', 'trialing'].includes(existingSubscription.status)) {
          console.log('[billing.ts] User already has active subscription:', user.stripe_subscription_id);
          return reply.code(400).send({
            error: 'Already Subscribed',
            message: 'You already have an active subscription. Use the billing portal to manage it.'
          });
        }
      }

      // Create checkout session
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        line_items: [
          {
            price: STRIPE_PRICE_ID,
            quantity: 1
          }
        ],
        success_url: STRIPE_CHECKOUT_SUCCESS_URL,
        cancel_url: STRIPE_CHECKOUT_CANCEL_URL,
        client_reference_id: auth.userId,
        metadata: {
          user_id: auth.userId,
          profile_id: user.id
        }
      });

      return reply.send({
        url: session.url
      });
    } catch (error: any) {
      console.error('Error creating checkout session:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  });

  // Create portal session
  fastify.post('/billing/portal', async (request: any, reply) => {
    const auth = request.auth;

    try {
      const { data: user, error: userError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', auth.userId)
        .single();

      if (!user || userError) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'User not found'
        });
      }

      // Ensure customer exists - create if missing
      let customerId = user.stripe_customer_id;

      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email || undefined,
          metadata: {
            app_user_id: auth.userId,
            user_db_id: user.id
          }
        });
        customerId = customer.id;

        // Update user with customer ID
        await supabase
          .from('profiles')
          .update({ stripe_customer_id: customerId })
          .eq('id', user.id);
      }

      // Create portal session
      try {
        const params: Stripe.BillingPortal.SessionCreateParams = {
          customer: customerId,
          return_url: STRIPE_PORTAL_RETURN_URL
        };

        // Use portal configuration if provided
        if (process.env.STRIPE_PORTAL_CONFIGURATION_ID) {
          params.configuration = process.env.STRIPE_PORTAL_CONFIGURATION_ID;
        }

        const session = await stripe.billingPortal.sessions.create(params);

        return reply.send({
          url: session.url
        });
      } catch (portalError: any) {
        // Common issue: Billing Portal not configured in Stripe Dashboard
        console.error('Stripe Billing Portal error:', portalError);
        return reply.code(422).send({
          code: 'STRIPE_PORTAL_ERROR',
          error: 'Stripe Billing Portal Configuration Required',
          message: 'The Billing Portal is not configured in your Stripe account.',
          hint: 'Enable Billing Portal in Stripe Dashboard (Settings > Billing > Customer Portal) and ensure a product/price is active.',
          details: portalError.message,
          docs: 'https://stripe.com/docs/billing/subscriptions/integrating-customer-portal'
        });
      }
    } catch (error: any) {
      console.error('Error creating portal session:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  });
}
