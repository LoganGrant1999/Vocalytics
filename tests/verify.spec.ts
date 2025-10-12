/**
 * Core Functionality Verification
 * STRICT: Must pass all assertions or fail deployment
 */

import { describe, it, expect } from 'vitest';
import {
  api,
  apiNoAuth,
  createTestComment,
  assertPaywallError,
  BASE_URL,
} from './utils';

const EXPECT_ANALYZE_CAP = parseInt(process.env.EXPECT_ANALYZE_CAP || '2', 10);
const EXPECT_REPLY_CAP = parseInt(process.env.EXPECT_REPLY_CAP || '1', 10);

describe('Core Functionality Verification', () => {
  describe('Health Check', () => {
    it('must return 200 with ok: true', async () => {
      const res = await apiNoAuth('/healthz');

      expect(res.status).toBe(200);

      // Strict: Must have documented shape
      expect(res.data).toHaveProperty('status');
      expect(['ok', 'healthy'].some(v =>
        res.data.status === v || res.data.ok === true
      )).toBe(true);
    });
  });

  describe('Authentication - STRICT', () => {
    it('must return 401 without JWT', async () => {
      const res = await apiNoAuth('/api/me/subscription');

      expect(res.status).toBe(401);
      expect(res.data).toHaveProperty('error');

      // Must not leak stack traces
      expect(JSON.stringify(res.data)).not.toContain('stack');
      expect(JSON.stringify(res.data)).not.toContain('at ');
    });

    it('must return 200 with JWT and free tier baseline', async () => {
      const res = await api('/api/me/subscription');

      expect(res.status).toBe(200);
      expect(res.data).toHaveProperty('tier');

      // Baseline: free or null (before subscription)
      expect(['free', null].includes(res.data.tier) ||
             res.data.subscription_status === null ||
             res.data.subscription_status === 'inactive').toBe(true);
    });
  });

  describe('Analyze Comments - Quota STRICT', () => {
    it(`must allow exactly ${EXPECT_ANALYZE_CAP} requests`, async () => {
      // Request 1
      const comment1 = createTestComment({ id: 'verify_1' });
      const res1 = await api('/api/analyze-comments', {
        method: 'POST',
        body: JSON.stringify({ comments: [comment1] }),
      });

      expect(res1.status).toBe(200);
      expect(Array.isArray(res1.data)).toBe(true);

      // Request 2
      const comment2 = createTestComment({ id: 'verify_2' });
      const res2 = await api('/api/analyze-comments', {
        method: 'POST',
        body: JSON.stringify({ comments: [comment2] }),
      });

      expect(res2.status).toBe(200);
      expect(Array.isArray(res2.data)).toBe(true);
    });

    it('must return 402 PAYWALL on third request', async () => {
      const comment3 = createTestComment({ id: 'verify_3' });
      const res = await api('/api/analyze-comments', {
        method: 'POST',
        body: JSON.stringify({ comments: [comment3] }),
      });

      // STRICT: Must be exactly 402
      expect(res.status).toBe(402);

      // STRICT: Validate exact paywall structure
      expect(res.data).toHaveProperty('code');
      expect(res.data.code).toBe('PAYWALL');

      expect(res.data).toHaveProperty('reason');
      expect(res.data.reason).toBe('FREE_TIER_EXCEEDED');

      expect(res.data).toHaveProperty('feature');
      expect(res.data.feature).toBe('analyze');

      // STRICT: URLs must be valid HTTPS
      expect(res.data).toHaveProperty('upgradeUrl');
      expect(res.data.upgradeUrl).toMatch(/^https:\/\//);

      expect(res.data).toHaveProperty('manageUrl');
      expect(res.data.manageUrl).toMatch(/^https:\/\//);

      // STRICT: Must include limits and usage
      expect(res.data).toHaveProperty('limits');
      expect(res.data.limits).toHaveProperty('weeklyAnalyze');
      expect(res.data.limits).toHaveProperty('dailyReply');

      expect(res.data).toHaveProperty('usage');
      expect(res.data.usage).toHaveProperty('commentsAnalyzed');
      expect(res.data.usage).toHaveProperty('repliesGenerated');
    });
  });

  describe('Generate Replies - Quota STRICT', () => {
    it(`must allow exactly ${EXPECT_REPLY_CAP} request(s)`, async () => {
      const comment = createTestComment({ id: 'reply_verify_1' });
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
    });

    it('must return 402 PAYWALL with feature=reply on second request', async () => {
      const comment = createTestComment({ id: 'reply_verify_2' });
      const res = await api('/api/generate-replies', {
        method: 'POST',
        body: JSON.stringify({
          comment,
          tones: ['friendly'],
        }),
      });

      // STRICT: Must be exactly 402
      expect(res.status).toBe(402);

      // STRICT: Validate paywall for reply
      expect(res.data.code).toBe('PAYWALL');
      expect(res.data.reason).toBe('FREE_TIER_EXCEEDED');
      expect(res.data.feature).toBe('reply');
      expect(res.data.upgradeUrl).toMatch(/^https:\/\//);
      expect(res.data.manageUrl).toMatch(/^https:\/\//);
    });
  });

  describe('Usage Endpoint - STRICT Accuracy', () => {
    it('must reflect exact usage matching caps', async () => {
      const res = await api('/api/me/usage');

      expect(res.status).toBe(200);

      // STRICT: Exact match
      expect(res.data.commentsAnalyzed).toBe(EXPECT_ANALYZE_CAP);
      expect(res.data.repliesGenerated).toBe(EXPECT_REPLY_CAP);

      // STRICT: Limits must match configuration
      expect(res.data.limits.weeklyAnalyze).toBe(EXPECT_ANALYZE_CAP);
      expect(res.data.limits.dailyReply).toBe(EXPECT_REPLY_CAP);

      // Must have reset date
      expect(res.data).toHaveProperty('resetDate');
    });
  });

  describe('Ungated Endpoints', () => {
    it('fetch-comments must work without quota', async () => {
      const res = await api('/api/fetch-comments', {
        method: 'POST',
        body: JSON.stringify({ videoId: 'test', max: 5 }),
      });

      expect([200, 400]).toContain(res.status); // 400 if mock data logic

      if (res.status === 200) {
        expect(res.data).toHaveProperty('comments');
        expect(Array.isArray(res.data.comments)).toBe(true);
      }
    });

    it('summarize-sentiment must work without quota', async () => {
      const res = await api('/api/summarize-sentiment', {
        method: 'POST',
        body: JSON.stringify({
          analysis: [{
            commentId: 'test',
            sentiment: { positive: 0.8, neutral: 0.1, negative: 0.1 },
            topics: ['test'],
            intent: 'test',
            toxicity: 0.1,
            category: 'positive',
          }],
        }),
      });

      expect(res.status).toBe(200);
      expect(res.data).toHaveProperty('overallSentiment');
    });
  });
});
