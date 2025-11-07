/**
 * Analyze Comments Route Tests - Production Critical
 *
 * Tests the /analyze-comments endpoint that performs AI-powered sentiment analysis
 * on YouTube comments with paywall enforcement and DoS protection.
 *
 * Coverage:
 * - Schema validation (array limits, string limits, required fields)
 * - Paywall enforcement (Free vs Pro tier, quota limits)
 * - AI analysis integration (sentiment, topics, toxicity, intent)
 * - Response transformation (category mapping)
 * - Error handling (AI failures, malformed data)
 * - DoS protection (max 100 comments, max 10k chars per comment)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fakeVerifyToken } from './testAuth.js';

// Use vi.hoisted for proper mock function creation
const { mockAnalyzeComments, mockEnforceAnalyze } = vi.hoisted(() => ({
  mockAnalyzeComments: vi.fn(),
  mockEnforceAnalyze: vi.fn(),
}));

// Mock auth plugin
vi.mock('../auth.js', async () => {
  const fp = await import('fastify-plugin');
  const plugin = (app: any, opts: any, done: any) => {
    app.addHook('preHandler', fakeVerifyToken);
    done();
  };
  return {
    default: fp.default(plugin, { name: 'auth-plugin' })
  };
});

// Mock tools
vi.mock('../../tools.js', () => ({
  analyzeComments: mockAnalyzeComments,
}));

// Mock paywall
vi.mock('../paywall.js', () => ({
  enforceAnalyze: mockEnforceAnalyze,
}));

// Import after mocks
import { createHttpServer } from '../index.js';

describe('Analyze Comments Route - Production Critical', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: Allow all requests (Pro user or within quota)
    mockEnforceAnalyze.mockResolvedValue({ allowed: true });

    // Default: Return successful analysis
    mockAnalyzeComments.mockResolvedValue([
      {
        commentId: 'comment-1',
        category: 'positive',
        sentiment: {
          positive: 0.85,
          neutral: 0.10,
          negative: 0.05,
        },
        topics: ['appreciation', 'quality'],
        intent: 'praise',
        toxicity: 0.02,
      },
    ]);
  });

  describe('Schema Validation', () => {
    it('should require comments array', async () => {
      const app = await createHttpServer();

      const response = await app.inject({
        method: 'POST',
        url: '/api/analyze-comments',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      expect(mockAnalyzeComments).not.toHaveBeenCalled();
      expect(mockEnforceAnalyze).not.toHaveBeenCalled();
    });

    it('should reject empty comments array', async () => {
      const app = await createHttpServer();

      const response = await app.inject({
        method: 'POST',
        url: '/api/analyze-comments',
        payload: {
          comments: [],
        },
      });

      expect(response.statusCode).toBe(400);
      expect(mockAnalyzeComments).not.toHaveBeenCalled();
    });

    it('should reject array with more than 100 comments (DoS protection)', async () => {
      const app = await createHttpServer();

      const comments = Array.from({ length: 101 }, (_, i) => ({
        id: `comment-${i}`,
        text: `Comment ${i}`,
      }));

      const response = await app.inject({
        method: 'POST',
        url: '/api/analyze-comments',
        payload: { comments },
      });

      expect(response.statusCode).toBe(400);
      expect(mockAnalyzeComments).not.toHaveBeenCalled();
    });

    it('should accept exactly 100 comments (boundary test)', async () => {
      const app = await createHttpServer();

      const comments = Array.from({ length: 100 }, (_, i) => ({
        id: `comment-${i}`,
        text: `Comment ${i}`,
      }));

      mockAnalyzeComments.mockResolvedValue(
        comments.map(c => ({
          commentId: c.id,
          category: 'positive',
          sentiment: { positive: 0.8, neutral: 0.1, negative: 0.1 },
          topics: [],
          intent: 'praise',
          toxicity: 0.01,
        }))
      );

      const response = await app.inject({
        method: 'POST',
        url: '/api/analyze-comments',
        payload: { comments },
      });

      expect(response.statusCode).toBe(200);
      expect(mockAnalyzeComments).toHaveBeenCalledWith(comments);
    });

    it('should require id and text in each comment', async () => {
      const app = await createHttpServer();

      const response = await app.inject({
        method: 'POST',
        url: '/api/analyze-comments',
        payload: {
          comments: [
            { id: 'comment-1' }, // missing text
          ],
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject empty id string', async () => {
      const app = await createHttpServer();

      const response = await app.inject({
        method: 'POST',
        url: '/api/analyze-comments',
        payload: {
          comments: [
            { id: '', text: 'Some comment' },
          ],
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject empty text string', async () => {
      const app = await createHttpServer();

      const response = await app.inject({
        method: 'POST',
        url: '/api/analyze-comments',
        payload: {
          comments: [
            { id: 'comment-1', text: '' },
          ],
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject id longer than 100 characters', async () => {
      const app = await createHttpServer();

      const longId = 'a'.repeat(101);

      const response = await app.inject({
        method: 'POST',
        url: '/api/analyze-comments',
        payload: {
          comments: [
            { id: longId, text: 'Some comment' },
          ],
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject text longer than 10000 characters (DoS protection)', async () => {
      const app = await createHttpServer();

      const longText = 'a'.repeat(10001);

      const response = await app.inject({
        method: 'POST',
        url: '/api/analyze-comments',
        payload: {
          comments: [
            { id: 'comment-1', text: longText },
          ],
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should accept exactly 10000 character text (boundary test)', async () => {
      const app = await createHttpServer();

      const maxText = 'a'.repeat(10000);

      const response = await app.inject({
        method: 'POST',
        url: '/api/analyze-comments',
        payload: {
          comments: [
            { id: 'comment-1', text: maxText },
          ],
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should reject additional properties in comment object', async () => {
      const app = await createHttpServer();

      const response = await app.inject({
        method: 'POST',
        url: '/api/analyze-comments',
        payload: {
          comments: [
            {
              id: 'comment-1',
              text: 'Some comment',
              extraField: 'not allowed',
            },
          ],
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject additional properties in root object', async () => {
      const app = await createHttpServer();

      const response = await app.inject({
        method: 'POST',
        url: '/api/analyze-comments',
        payload: {
          comments: [
            { id: 'comment-1', text: 'Some comment' },
          ],
          extraRootField: 'not allowed',
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('Paywall Enforcement', () => {
    it('should call enforceAnalyze with correct parameters', async () => {
      const app = await createHttpServer();

      const response = await app.inject({
        method: 'POST',
        url: '/api/analyze-comments',
        payload: {
          comments: [
            { id: 'comment-1', text: 'Great video!' },
          ],
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockEnforceAnalyze).toHaveBeenCalledWith({
        userDbId: '00000000-0000-0000-0000-000000000001',
        incrementBy: 1,
      });
    });

    it('should increment by 1 regardless of comment count (per-request billing)', async () => {
      const app = await createHttpServer();

      const comments = Array.from({ length: 50 }, (_, i) => ({
        id: `comment-${i}`,
        text: `Comment ${i}`,
      }));

      mockAnalyzeComments.mockResolvedValue(
        comments.map(c => ({
          commentId: c.id,
          category: 'positive',
          sentiment: { positive: 0.8, neutral: 0.1, negative: 0.1 },
          topics: [],
          intent: 'praise',
          toxicity: 0.01,
        }))
      );

      const response = await app.inject({
        method: 'POST',
        url: '/api/analyze-comments',
        payload: { comments },
      });

      expect(response.statusCode).toBe(200);
      expect(mockEnforceAnalyze).toHaveBeenCalledWith({
        userDbId: '00000000-0000-0000-0000-000000000001',
        incrementBy: 1, // Not 50 - billing is per request
      });
    });

    it('should return 402 when quota exceeded (Free tier limit)', async () => {
      const app = await createHttpServer();

      mockEnforceAnalyze.mockResolvedValue({
        allowed: false,
        error: {
          code: 'QUOTA_EXCEEDED',
          message: 'Weekly analysis quota exceeded (2/2). Upgrade to Pro for unlimited analysis.',
          tier: 'free',
          limit: 2,
          used: 2,
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/analyze-comments',
        payload: {
          comments: [
            { id: 'comment-1', text: 'Great video!' },
          ],
        },
      });

      expect(response.statusCode).toBe(402);
      const data = JSON.parse(response.body);
      expect(data.code).toBe('QUOTA_EXCEEDED');
      expect(data.message).toContain('Upgrade to Pro');
      expect(mockAnalyzeComments).not.toHaveBeenCalled();
    });

    it('should allow Pro users unlimited analysis', async () => {
      const app = await createHttpServer();

      // Pro users get through paywall
      mockEnforceAnalyze.mockResolvedValue({ allowed: true });

      const response = await app.inject({
        method: 'POST',
        url: '/api/analyze-comments',
        payload: {
          comments: [
            { id: 'comment-1', text: 'Great video!' },
          ],
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockAnalyzeComments).toHaveBeenCalled();
    });

    it('should not call analyzeComments when paywall blocks request', async () => {
      const app = await createHttpServer();

      mockEnforceAnalyze.mockResolvedValue({
        allowed: false,
        error: {
          code: 'QUOTA_EXCEEDED',
          message: 'Quota exceeded',
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/analyze-comments',
        payload: {
          comments: [
            { id: 'comment-1', text: 'Great video!' },
          ],
        },
      });

      expect(response.statusCode).toBe(402);
      expect(mockAnalyzeComments).not.toHaveBeenCalled();
    });
  });

  describe('AI Analysis Integration', () => {
    it('should analyze comments and return sentiment data', async () => {
      const app = await createHttpServer();

      mockAnalyzeComments.mockResolvedValue([
        {
          commentId: 'comment-1',
          category: 'positive',
          sentiment: {
            positive: 0.92,
            neutral: 0.05,
            negative: 0.03,
          },
          topics: ['appreciation', 'quality'],
          intent: 'praise',
          toxicity: 0.01,
        },
      ]);

      const response = await app.inject({
        method: 'POST',
        url: '/api/analyze-comments',
        payload: {
          comments: [
            { id: 'comment-1', text: 'This is amazing! Great work!' },
          ],
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data).toHaveLength(1);
      expect(data[0].commentId).toBe('comment-1');
      expect(data[0].sentiment.label).toBe('positive');
      expect(data[0].sentiment.positive).toBe(0.92);
      expect(data[0].topics).toEqual(['appreciation', 'quality']);
      expect(data[0].intent).toBe('praise');
      expect(data[0].toxicity).toBe(0.01);
    });

    it('should handle negative sentiment comments', async () => {
      const app = await createHttpServer();

      mockAnalyzeComments.mockResolvedValue([
        {
          commentId: 'comment-1',
          category: 'negative',
          sentiment: {
            positive: 0.05,
            neutral: 0.10,
            negative: 0.85,
          },
          topics: ['criticism', 'quality'],
          intent: 'complaint',
          toxicity: 0.65,
        },
      ]);

      const response = await app.inject({
        method: 'POST',
        url: '/api/analyze-comments',
        payload: {
          comments: [
            { id: 'comment-1', text: 'This is terrible! Waste of time!' },
          ],
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data[0].sentiment.label).toBe('negative');
      expect(data[0].sentiment.negative).toBe(0.85);
      expect(data[0].toxicity).toBeGreaterThan(0.5);
    });

    it('should analyze multiple comments', async () => {
      const app = await createHttpServer();

      mockAnalyzeComments.mockResolvedValue([
        {
          commentId: 'comment-1',
          category: 'positive',
          sentiment: { positive: 0.9, neutral: 0.05, negative: 0.05 },
          topics: ['appreciation'],
          intent: 'praise',
          toxicity: 0.01,
        },
        {
          commentId: 'comment-2',
          category: 'negative',
          sentiment: { positive: 0.05, neutral: 0.15, negative: 0.80 },
          topics: ['criticism'],
          intent: 'complaint',
          toxicity: 0.60,
        },
        {
          commentId: 'comment-3',
          category: 'constructive',
          sentiment: { positive: 0.40, neutral: 0.50, negative: 0.10 },
          topics: ['feedback'],
          intent: 'suggestion',
          toxicity: 0.05,
        },
      ]);

      const response = await app.inject({
        method: 'POST',
        url: '/api/analyze-comments',
        payload: {
          comments: [
            { id: 'comment-1', text: 'Great video!' },
            { id: 'comment-2', text: 'This is terrible!' },
            { id: 'comment-3', text: 'Good content, but could improve the audio.' },
          ],
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data).toHaveLength(3);
      expect(data[0].sentiment.label).toBe('positive');
      expect(data[1].sentiment.label).toBe('negative');
      expect(data[2].sentiment.label).toBe('neutral'); // constructive → neutral mapping
    });
  });

  describe('Response Transformation', () => {
    it('should map "constructive" category to "neutral" sentiment label', async () => {
      const app = await createHttpServer();

      mockAnalyzeComments.mockResolvedValue([
        {
          commentId: 'comment-1',
          category: 'constructive',
          sentiment: { positive: 0.30, neutral: 0.60, negative: 0.10 },
          topics: ['feedback'],
          intent: 'suggestion',
          toxicity: 0.05,
        },
      ]);

      const response = await app.inject({
        method: 'POST',
        url: '/api/analyze-comments',
        payload: {
          comments: [
            { id: 'comment-1', text: 'Good video, but maybe add captions?' },
          ],
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data[0].category).toBe('constructive');
      expect(data[0].sentiment.label).toBe('neutral'); // Transformation applied
    });

    it('should map "spam" category to "neutral" sentiment label', async () => {
      const app = await createHttpServer();

      mockAnalyzeComments.mockResolvedValue([
        {
          commentId: 'comment-1',
          category: 'spam',
          sentiment: { positive: 0.10, neutral: 0.20, negative: 0.70 },
          topics: [],
          intent: 'spam',
          toxicity: 0.75,
        },
      ]);

      const response = await app.inject({
        method: 'POST',
        url: '/api/analyze-comments',
        payload: {
          comments: [
            { id: 'comment-1', text: 'Check out my channel! http://spam.com' },
          ],
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data[0].category).toBe('spam');
      expect(data[0].sentiment.label).toBe('neutral'); // Transformation applied
    });

    it('should preserve positive/negative/neutral categories as sentiment labels', async () => {
      const app = await createHttpServer();

      mockAnalyzeComments.mockResolvedValue([
        {
          commentId: 'comment-1',
          category: 'positive',
          sentiment: { positive: 0.85, neutral: 0.10, negative: 0.05 },
          topics: [],
          intent: 'praise',
          toxicity: 0.01,
        },
        {
          commentId: 'comment-2',
          category: 'negative',
          sentiment: { positive: 0.05, neutral: 0.10, negative: 0.85 },
          topics: [],
          intent: 'complaint',
          toxicity: 0.70,
        },
        {
          commentId: 'comment-3',
          category: 'neutral',
          sentiment: { positive: 0.30, neutral: 0.50, negative: 0.20 },
          topics: [],
          intent: 'question',
          toxicity: 0.02,
        },
      ]);

      const response = await app.inject({
        method: 'POST',
        url: '/api/analyze-comments',
        payload: {
          comments: [
            { id: 'comment-1', text: 'Great!' },
            { id: 'comment-2', text: 'Terrible!' },
            { id: 'comment-3', text: 'What time is it?' },
          ],
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data[0].sentiment.label).toBe('positive');
      expect(data[1].sentiment.label).toBe('negative');
      expect(data[2].sentiment.label).toBe('neutral');
    });

    it('should include all required fields in response', async () => {
      const app = await createHttpServer();

      mockAnalyzeComments.mockResolvedValue([
        {
          commentId: 'comment-1',
          category: 'positive',
          sentiment: { positive: 0.8, neutral: 0.1, negative: 0.1 },
          topics: ['topic1', 'topic2'],
          intent: 'praise',
          toxicity: 0.01,
        },
      ]);

      const response = await app.inject({
        method: 'POST',
        url: '/api/analyze-comments',
        payload: {
          comments: [
            { id: 'comment-1', text: 'Great!' },
          ],
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);

      expect(data[0]).toHaveProperty('commentId');
      expect(data[0]).toHaveProperty('sentiment');
      expect(data[0].sentiment).toHaveProperty('label');
      expect(data[0].sentiment).toHaveProperty('positive');
      expect(data[0].sentiment).toHaveProperty('neutral');
      expect(data[0].sentiment).toHaveProperty('negative');
      expect(data[0]).toHaveProperty('topics');
      expect(data[0]).toHaveProperty('intent');
      expect(data[0]).toHaveProperty('toxicity');
      expect(data[0]).toHaveProperty('category');
    });
  });

  describe('Error Handling', () => {
    it('should return 500 when analyzeComments throws error', async () => {
      const app = await createHttpServer();

      mockAnalyzeComments.mockRejectedValue(new Error('OpenAI API timeout'));

      const response = await app.inject({
        method: 'POST',
        url: '/api/analyze-comments',
        payload: {
          comments: [
            { id: 'comment-1', text: 'Great video!' },
          ],
        },
      });

      expect(response.statusCode).toBe(500);
      const data = JSON.parse(response.body);
      expect(data.error).toBe('Internal Server Error');
      expect(data.message).toContain('OpenAI API timeout');
    });

    it('should handle enforceAnalyze throwing error', async () => {
      const app = await createHttpServer();

      mockEnforceAnalyze.mockRejectedValue(new Error('Database connection failed'));

      const response = await app.inject({
        method: 'POST',
        url: '/api/analyze-comments',
        payload: {
          comments: [
            { id: 'comment-1', text: 'Great video!' },
          ],
        },
      });

      expect(response.statusCode).toBe(500);
      const data = JSON.parse(response.body);
      expect(data.message).toContain('Database connection failed');
    });

    it('should handle malformed AI response gracefully', async () => {
      const app = await createHttpServer();

      // AI returns incomplete data
      mockAnalyzeComments.mockResolvedValue([
        {
          commentId: 'comment-1',
          category: 'positive',
          // missing sentiment object
        } as any,
      ]);

      const response = await app.inject({
        method: 'POST',
        url: '/api/analyze-comments',
        payload: {
          comments: [
            { id: 'comment-1', text: 'Great video!' },
          ],
        },
      });

      // Should not crash, but may return 500 or incomplete data
      expect([200, 500]).toContain(response.statusCode);
    });
  });

  describe('Edge Cases', () => {
    it('should handle exactly 1 comment (minimum allowed)', async () => {
      const app = await createHttpServer();

      const response = await app.inject({
        method: 'POST',
        url: '/api/analyze-comments',
        payload: {
          comments: [
            { id: 'comment-1', text: 'Great video!' },
          ],
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockAnalyzeComments).toHaveBeenCalledWith([
        { id: 'comment-1', text: 'Great video!' },
      ]);
    });

    it('should handle comments with special characters and emojis', async () => {
      const app = await createHttpServer();

      mockAnalyzeComments.mockResolvedValue([
        {
          commentId: 'comment-1',
          category: 'positive',
          sentiment: { positive: 0.9, neutral: 0.05, negative: 0.05 },
          topics: [],
          intent: 'praise',
          toxicity: 0.01,
        },
      ]);

      const response = await app.inject({
        method: 'POST',
        url: '/api/analyze-comments',
        payload: {
          comments: [
            { id: 'comment-1', text: 'This is 🔥! Love it ❤️ 100% 👍' },
          ],
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data[0].commentId).toBe('comment-1');
    });

    it('should handle comments with Unicode characters', async () => {
      const app = await createHttpServer();

      const response = await app.inject({
        method: 'POST',
        url: '/api/analyze-comments',
        payload: {
          comments: [
            { id: 'comment-1', text: '素晴らしい動画です！ Отличное видео! 很棒的视频！' },
          ],
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should handle comments with URLs and special formatting', async () => {
      const app = await createHttpServer();

      mockAnalyzeComments.mockResolvedValue([
        {
          commentId: 'comment-1',
          category: 'spam',
          sentiment: { positive: 0.1, neutral: 0.2, negative: 0.7 },
          topics: [],
          intent: 'spam',
          toxicity: 0.8,
        },
      ]);

      const response = await app.inject({
        method: 'POST',
        url: '/api/analyze-comments',
        payload: {
          comments: [
            { id: 'comment-1', text: 'Check out http://example.com for more!!! 💰💰💰' },
          ],
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data[0].category).toBe('spam');
    });

    it('should handle very long comment (9999 chars)', async () => {
      const app = await createHttpServer();

      const longComment = 'a'.repeat(9999);

      const response = await app.inject({
        method: 'POST',
        url: '/api/analyze-comments',
        payload: {
          comments: [
            { id: 'comment-1', text: longComment },
          ],
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should handle comment with id at max length (100 chars)', async () => {
      const app = await createHttpServer();

      const maxLengthId = 'a'.repeat(100);

      const response = await app.inject({
        method: 'POST',
        url: '/api/analyze-comments',
        payload: {
          comments: [
            { id: maxLengthId, text: 'Great video!' },
          ],
        },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete Free user analysis flow within quota', async () => {
      const app = await createHttpServer();

      // Free user, first analysis (1/2)
      mockEnforceAnalyze.mockResolvedValue({ allowed: true });
      mockAnalyzeComments.mockResolvedValue([
        {
          commentId: 'comment-1',
          category: 'positive',
          sentiment: { positive: 0.9, neutral: 0.05, negative: 0.05 },
          topics: ['appreciation'],
          intent: 'praise',
          toxicity: 0.01,
        },
      ]);

      const response = await app.inject({
        method: 'POST',
        url: '/api/analyze-comments',
        payload: {
          comments: [
            { id: 'comment-1', text: 'Amazing video!' },
          ],
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockEnforceAnalyze).toHaveBeenCalledWith({
        userDbId: '00000000-0000-0000-0000-000000000001',
        incrementBy: 1,
      });
      expect(mockAnalyzeComments).toHaveBeenCalled();

      const data = JSON.parse(response.body);
      expect(data[0].sentiment.label).toBe('positive');
    });

    it('should handle Free user hitting quota limit', async () => {
      const app = await createHttpServer();

      // Free user exhausted quota (2/2)
      mockEnforceAnalyze.mockResolvedValue({
        allowed: false,
        error: {
          code: 'QUOTA_EXCEEDED',
          message: 'Weekly analysis quota exceeded (2/2). Upgrade to Pro for unlimited analysis.',
          tier: 'free',
          limit: 2,
          used: 2,
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/analyze-comments',
        payload: {
          comments: [
            { id: 'comment-1', text: 'Another video!' },
          ],
        },
      });

      expect(response.statusCode).toBe(402);
      const data = JSON.parse(response.body);
      expect(data.code).toBe('QUOTA_EXCEEDED');
      expect(data.message).toContain('Upgrade to Pro');
      expect(mockAnalyzeComments).not.toHaveBeenCalled();
    });

    it('should handle Pro user analyzing many comments', async () => {
      const app = await createHttpServer();

      // Pro user - no quota limits
      mockEnforceAnalyze.mockResolvedValue({ allowed: true });

      const comments = Array.from({ length: 75 }, (_, i) => ({
        id: `comment-${i}`,
        text: `Comment ${i} with some interesting content`,
      }));

      mockAnalyzeComments.mockResolvedValue(
        comments.map(c => ({
          commentId: c.id,
          category: 'positive',
          sentiment: { positive: 0.7, neutral: 0.2, negative: 0.1 },
          topics: ['content'],
          intent: 'praise',
          toxicity: 0.05,
        }))
      );

      const response = await app.inject({
        method: 'POST',
        url: '/api/analyze-comments',
        payload: { comments },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data).toHaveLength(75);
      expect(mockEnforceAnalyze).toHaveBeenCalledWith({
        userDbId: '00000000-0000-0000-0000-000000000001',
        incrementBy: 1, // Still 1 per request, not 75
      });
    });

    it('should handle mixed sentiment analysis correctly', async () => {
      const app = await createHttpServer();

      mockAnalyzeComments.mockResolvedValue([
        {
          commentId: 'c1',
          category: 'positive',
          sentiment: { positive: 0.9, neutral: 0.05, negative: 0.05 },
          topics: ['quality'],
          intent: 'praise',
          toxicity: 0.01,
        },
        {
          commentId: 'c2',
          category: 'negative',
          sentiment: { positive: 0.1, neutral: 0.1, negative: 0.8 },
          topics: ['criticism'],
          intent: 'complaint',
          toxicity: 0.7,
        },
        {
          commentId: 'c3',
          category: 'constructive',
          sentiment: { positive: 0.4, neutral: 0.5, negative: 0.1 },
          topics: ['feedback'],
          intent: 'suggestion',
          toxicity: 0.05,
        },
        {
          commentId: 'c4',
          category: 'spam',
          sentiment: { positive: 0.1, neutral: 0.2, negative: 0.7 },
          topics: [],
          intent: 'spam',
          toxicity: 0.85,
        },
      ]);

      const response = await app.inject({
        method: 'POST',
        url: '/api/analyze-comments',
        payload: {
          comments: [
            { id: 'c1', text: 'Excellent!' },
            { id: 'c2', text: 'Terrible!' },
            { id: 'c3', text: 'Good but could be better' },
            { id: 'c4', text: 'Click here http://spam.com' },
          ],
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);

      expect(data[0].sentiment.label).toBe('positive');
      expect(data[0].category).toBe('positive');

      expect(data[1].sentiment.label).toBe('negative');
      expect(data[1].category).toBe('negative');

      expect(data[2].sentiment.label).toBe('neutral'); // constructive → neutral
      expect(data[2].category).toBe('constructive');

      expect(data[3].sentiment.label).toBe('neutral'); // spam → neutral
      expect(data[3].category).toBe('spam');
    });
  });
});
