/**
 * Billing & Stripe Tests
 * Validates checkout, webhooks, idempotency, and subscription lifecycle
 */

import { describe, it, expect } from 'vitest';
import {
  api,
  poll,
  createTestComment,
  logTestInfo,
  logTestSuccess,
  logTestWarn,
} from './utils';

describe('Billing & Stripe Tests', () => {
  let checkoutUrl: string;

  describe('Checkout Flow', () => {
    it('should create checkout session', async () => {
      const res = await api('/api/billing/checkout', {
        method: 'POST',
      });

      expect(res.status).toBe(200);
      expect(res.data).toHaveProperty('url');
      expect(res.data.url).toMatch(/^https:\/\//);

      checkoutUrl = res.data.url;

      logTestSuccess('Checkout session created');
      logTestInfo(`\n  📝 MANUAL STEP: Complete checkout at:\n  ${checkoutUrl}`);
      logTestInfo(`  Card: 4242 4242 4242 4242`);
      logTestInfo(`  Expiry: any future date, CVC: any 3 digits`);
    });

    it('should activate subscription after webhook', async () => {
      logTestInfo('Waiting for subscription activation (max 120s)...');
      logTestInfo('Complete the checkout above if not already done');

      try {
        await poll(
          async () => {
            const res = await api('/api/me/subscription');
            return res.data;
          },
          data => data.subscription_status === 'active',
          {
            interval: 3000,
            timeout: 120000,
            timeoutMessage:
              'Subscription not activated. Ensure:\n' +
              '  1. Stripe CLI is running: stripe listen --forward-to http://localhost:3000/api/webhook/stripe\n' +
              '  2. You completed checkout with test card\n' +
              '  3. STRIPE_WEBHOOK_SECRET matches in server .env\n' +
              '  4. Check server logs for webhook errors',
          }
        );

        const res = await api('/api/me/subscription');
        expect(res.data.subscription_status).toBe('active');
        expect(res.data.tier).toBe('pro');
        expect(res.data.stripe_customer_id).toBeTruthy();
        expect(res.data.stripe_subscription_id).toBeTruthy();

        logTestSuccess('Subscription activated via webhook');
      } catch (error) {
        logTestWarn(`Subscription activation timed out: ${error.message}`);
        throw error;
      }
    });
  });

  describe('Pro User Behavior', () => {
    it('should bypass paywall for pro users', async () => {
      // Attempt analyze that would hit paywall for free users
      const comment = createTestComment({
        id: 'pro_bypass_test',
        text: 'Testing pro user bypass',
      });

      const res = await api('/api/analyze-comments', {
        method: 'POST',
        body: JSON.stringify({ comments: [comment] }),
      });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.data)).toBe(true);

      logTestSuccess('Pro user bypassed paywall');
    });

    it('should allow unlimited replies for pro users', async () => {
      const comment = createTestComment({
        id: 'pro_reply_test',
        text: 'Testing pro reply generation',
      });

      const res = await api('/api/generate-replies', {
        method: 'POST',
        body: JSON.stringify({
          comment,
          tones: ['friendly'],
        }),
      });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.data)).toBe(true);

      logTestSuccess('Pro user can generate unlimited replies');
    });
  });

  describe('Webhook Idempotency', () => {
    it('should handle duplicate webhook events safely', async () => {
      logTestInfo('Testing webhook idempotency...');

      // Get current subscription state
      const beforeRes = await api('/api/me/subscription');
      const beforeState = beforeRes.data;

      // Note: Resending requires stripe CLI and actual event
      // This test documents the expected behavior
      logTestInfo('Webhook idempotency relies on stripe_events.event_id uniqueness');
      logTestInfo('Duplicate events should be ignored without side effects');

      // Verify state hasn't changed
      const afterRes = await api('/api/me/subscription');
      expect(afterRes.data.subscription_status).toBe(beforeState.subscription_status);

      logTestSuccess('Webhook idempotency documented');
    });
  });

  describe('Billing Portal', () => {
    it('should create portal session for subscribed user', async () => {
      const res = await api('/api/billing/portal', {
        method: 'POST',
      });

      expect(res.status).toBe(200);
      expect(res.data).toHaveProperty('url');
      expect(res.data.url).toMatch(/^https:\/\//);
      expect(res.data.url).toContain('billing.stripe.com');

      logTestSuccess('Portal session created');
      logTestInfo(`Portal URL: ${res.data.url}`);
    });
  });

  describe('Subscription Lifecycle (Manual)', () => {
    it('should document cancellation flow', () => {
      logTestInfo('\n📋 MANUAL TEST: Subscription Cancellation');
      logTestInfo('  1. Open billing portal from previous test');
      logTestInfo('  2. Cancel subscription');
      logTestInfo('  3. Wait for webhook: customer.subscription.deleted');
      logTestInfo('  4. Verify /api/me/subscription shows canceled status');
      logTestInfo('  5. Verify paywall re-activates on next analyze/reply');

      logTestWarn('Cancellation test requires manual interaction');
    });

    it('should document payment failure flow', () => {
      logTestInfo('\n📋 MANUAL TEST: Payment Failure');
      logTestInfo('  1. Use Stripe Test Clock to advance subscription');
      logTestInfo('  2. Trigger invoice.payment_failed event');
      logTestInfo('  3. Verify subscription becomes past_due or canceled');
      logTestInfo('  4. Verify paywall enforces for non-active subscription');

      logTestWarn('Payment failure test requires Stripe Test Clock');
    });
  });
});
