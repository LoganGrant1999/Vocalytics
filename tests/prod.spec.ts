/**
 * Production API Tests - Happy Path & Quotas
 * Validates core functionality and free tier metering
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  api,
  apiNoAuth,
  createTestComment,
  assertPaywallError,
  logTestInfo,
  logTestSuccess,
} from './utils';

const EXPECT_ANALYZE_CAP = parseInt(process.env.EXPECT_ANALYZE_CAP || '2', 10);
const EXPECT_REPLY_CAP = parseInt(process.env.EXPECT_REPLY_CAP || '1', 10);

describe('Production API Tests', () => {
  beforeAll(() => {
    logTestInfo(`Testing with caps: analyze=${EXPECT_ANALYZE_CAP}, reply=${EXPECT_REPLY_CAP}`);
  });

  describe('Health Check', () => {
    it('should return 200 and status ok', async () => {
      const res = await apiNoAuth('/healthz');

      expect(res.status).toBe(200);
      expect(res.data).toHaveProperty('status', 'ok');
      expect(res.data).toHaveProperty('service');

      logTestSuccess('Health check passed');
    });
  });

  describe('Authentication', () => {
    it('should reject requests without JWT (401)', async () => {
      const res = await apiNoAuth('/api/me/subscription');

      expect(res.status).toBe(401);
      expect(res.data).toHaveProperty('error');

      logTestSuccess('Unauthenticated request rejected');
    });

    it('should accept requests with valid JWT', async () => {
      const res = await api('/api/me/subscription');

      expect(res.status).toBe(200);
      expect(res.data).toHaveProperty('tier');

      logTestSuccess('Authenticated request accepted');
    });
  });

  describe('Subscription Baseline', () => {
    it('should return free tier for new user', async () => {
      const res = await api('/api/me/subscription');

      expect(res.status).toBe(200);
      expect(res.data.tier).toBe('free');
      expect(res.data).toHaveProperty('subscription_status');
      expect(res.data).toHaveProperty('subscribed_until');
      expect(res.data).toHaveProperty('stripe_customer_id');
      expect(res.data).toHaveProperty('stripe_subscription_id');

      logTestSuccess('Subscription baseline verified');
    });
  });

  describe('Analyze Comments - Quota Enforcement', () => {
    it(`should allow ${EXPECT_ANALYZE_CAP} analyze requests`, async () => {
      for (let i = 0; i < EXPECT_ANALYZE_CAP; i++) {
        const comment = createTestComment({
          id: `analyze_test_${i}`,
          text: `Test comment ${i} for analyze quota`,
        });

        const res = await api('/api/analyze-comments', {
          method: 'POST',
          body: JSON.stringify({ comments: [comment] }),
        });

        expect(res.status).toBe(200);
        expect(Array.isArray(res.data)).toBe(true);
        expect(res.data.length).toBeGreaterThan(0);

        logTestSuccess(`Analyze request ${i + 1}/${EXPECT_ANALYZE_CAP} succeeded`);
      }
    });

    it('should hit paywall on analyze request after cap', async () => {
      const comment = createTestComment({
        id: 'analyze_test_over_cap',
        text: 'This should hit the paywall',
      });

      const res = await api('/api/analyze-comments', {
        method: 'POST',
        body: JSON.stringify({ comments: [comment] }),
      });

      expect(res.status).toBe(402);
      assertPaywallError(res.data);
      expect(res.data.feature).toBe('analyze');

      logTestSuccess('Analyze paywall enforced correctly');
    });
  });

  describe('Generate Replies - Quota Enforcement', () => {
    it(`should allow ${EXPECT_REPLY_CAP} reply generation`, async () => {
      for (let i = 0; i < EXPECT_REPLY_CAP; i++) {
        const comment = createTestComment({
          id: `reply_test_${i}`,
          text: `Test comment ${i} for reply quota`,
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
        expect(res.data.length).toBeGreaterThan(0);

        logTestSuccess(`Reply request ${i + 1}/${EXPECT_REPLY_CAP} succeeded`);
      }
    });

    it('should hit paywall on reply generation after cap', async () => {
      const comment = createTestComment({
        id: 'reply_test_over_cap',
        text: 'This should hit the paywall',
      });

      const res = await api('/api/generate-replies', {
        method: 'POST',
        body: JSON.stringify({
          comment,
          tones: ['friendly'],
        }),
      });

      expect(res.status).toBe(402);
      assertPaywallError(res.data);
      expect(res.data.feature).toBe('reply');

      logTestSuccess('Reply paywall enforced correctly');
    });
  });

  describe('Usage Endpoint', () => {
    it('should return accurate usage stats', async () => {
      const res = await api('/api/me/usage');

      expect(res.status).toBe(200);
      expect(res.data).toHaveProperty('commentsAnalyzed');
      expect(res.data).toHaveProperty('repliesGenerated');
      expect(res.data).toHaveProperty('limits');
      expect(res.data).toHaveProperty('resetDate');

      // Verify counts match what we sent
      expect(res.data.commentsAnalyzed).toBe(EXPECT_ANALYZE_CAP);
      expect(res.data.repliesGenerated).toBe(EXPECT_REPLY_CAP);

      // Verify limits match configuration
      expect(res.data.limits.weeklyAnalyze).toBe(EXPECT_ANALYZE_CAP);
      expect(res.data.limits.dailyReply).toBe(EXPECT_REPLY_CAP);

      logTestSuccess('Usage stats verified');
    });
  });

  describe('Billing Endpoints', () => {
    it('should create checkout session', async () => {
      const res = await api('/api/billing/checkout', {
        method: 'POST',
      });

      expect(res.status).toBe(200);
      expect(res.data).toHaveProperty('url');
      expect(res.data.url).toMatch(/^https:\/\//);
      expect(res.data.url).toContain('checkout.stripe.com');

      logTestSuccess('Checkout session created');
      logTestInfo(`Checkout URL: ${res.data.url}`);
    });

    it('should create billing portal session', async () => {
      // Note: This may fail if user doesn't have a Stripe customer ID yet
      const res = await api('/api/billing/portal', {
        method: 'POST',
      });

      if (res.status === 200) {
        expect(res.data).toHaveProperty('url');
        expect(res.data.url).toMatch(/^https:\/\//);
        expect(res.data.url).toContain('billing.stripe.com');
        logTestSuccess('Portal session created');
      } else if (res.status === 400) {
        // Expected if no Stripe customer exists yet
        expect(res.data).toHaveProperty('error');
        logTestInfo('Portal requires Stripe customer (expected for new users)');
      } else {
        throw new Error(`Unexpected status: ${res.status}`);
      }
    });
  });

  describe('Fetch Comments', () => {
    it('should fetch comments without paywall', async () => {
      const res = await api('/api/fetch-comments', {
        method: 'POST',
        body: JSON.stringify({
          videoId: 'test_video',
          max: 5,
        }),
      });

      expect(res.status).toBe(200);
      expect(res.data).toHaveProperty('comments');
      expect(Array.isArray(res.data.comments)).toBe(true);

      logTestSuccess('Fetch comments works without paywall');
    });
  });

  describe('Summarize Sentiment', () => {
    it('should summarize without paywall', async () => {
      const res = await api('/api/summarize-sentiment', {
        method: 'POST',
        body: JSON.stringify({
          analysis: [
            {
              commentId: 'test1',
              sentiment: { positive: 0.8, neutral: 0.1, negative: 0.1 },
              topics: ['test'],
              intent: 'appreciation',
              toxicity: 0.1,
              category: 'positive',
            },
          ],
        }),
      });

      expect(res.status).toBe(200);
      expect(res.data).toHaveProperty('overallSentiment');
      expect(res.data).toHaveProperty('averageScores');
      expect(res.data).toHaveProperty('totalComments');
      expect(res.data).toHaveProperty('topTopics');
      expect(res.data).toHaveProperty('toxicityLevel');

      logTestSuccess('Summarize sentiment works without paywall');
    });
  });
});
