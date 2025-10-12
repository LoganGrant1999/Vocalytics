import { FastifyInstance } from 'fastify';
import Stripe from 'stripe';
import { getUserById, updateUserStripe } from '../../db/users.js';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  throw new Error('STRIPE_SECRET_KEY must be set');
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2024-06-20'
});

const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID;
const STRIPE_CHECKOUT_SUCCESS_URL = process.env.STRIPE_CHECKOUT_SUCCESS_URL || 'https://yourapp.com/success?session_id={CHECKOUT_SESSION_ID}';
const STRIPE_CHECKOUT_CANCEL_URL = process.env.STRIPE_CHECKOUT_CANCEL_URL || 'https://yourapp.com/pricing';
const STRIPE_PORTAL_RETURN_URL = process.env.STRIPE_PORTAL_RETURN_URL || 'https://yourapp.com/account';

export async function billingRoutes(fastify: FastifyInstance) {
  // Create checkout session
  fastify.post('/billing/checkout', async (request: any, reply) => {
    const auth = request.auth;

    if (!STRIPE_PRICE_ID) {
      return reply.code(500).send({
        error: 'Configuration Error',
        message: 'STRIPE_PRICE_ID is not configured'
      });
    }

    try {
      const user = await getUserById(auth.userDbId);

      if (!user) {
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
            app_user_id: auth.appUserId,
            user_db_id: user.id
          }
        });
        customerId = customer.id;

        // Update user with customer ID
        await updateUserStripe({
          userId: user.id,
          stripeCustomerId: customerId
        });
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
        client_reference_id: auth.appUserId,
        metadata: {
          app_user_id: auth.appUserId,
          user_db_id: user.id
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
      const user = await getUserById(auth.userDbId);

      if (!user) {
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
            app_user_id: user.app_user_id || auth.userId,
            user_db_id: user.id
          }
        });
        customerId = customer.id;

        // Update user with customer ID
        await updateUserStripe({
          userId: user.id,
          stripeCustomerId: customerId
        });
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
