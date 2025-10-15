import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fakeVerifyToken } from './testAuth';

// Mock auth BEFORE importing anything else - use fastify-plugin wrapper
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

// Mock tools and database
vi.mock('../../tools.js', () => ({
  fetchComments: vi.fn(() =>
    Promise.resolve({
      comments: [
        {
          id: 'c1',
          videoId: 'test-video',
          author: 'User',
          text: 'Test comment',
          likeCount: 0,
          publishedAt: '2025-01-01T00:00:00Z',
          replyCount: 0,
          isReply: false,
        },
      ],
    })
  ),
  analyzeComments: vi.fn(() =>
    Promise.resolve([
      {
        commentId: 'c1',
        sentiment: { positive: 0.8, neutral: 0.1, negative: 0.1 },
        topics: ['test'],
        intent: 'praise',
        toxicity: 0.0,
        category: 'positive' as const,
      },
    ])
  ),
  generateReplies: vi.fn(),
  summarizeSentiment: vi.fn(),
}));

vi.mock('../../db/analyses.js', () => ({
  insertAnalysis: vi.fn(() =>
    Promise.resolve({
      user_id: 'test-user-id',
      video_id: 'test-video',
      analyzed_at: new Date().toISOString(),
      sentiment: { pos: 0.8, neu: 0.1, neg: 0.1 },
      score: 0.7,
      top_positive: [],
      top_negative: [],
      summary: 'Test',
      raw: null,
    })
  ),
  getLatestAnalysis: vi.fn(),
  listLatestAnalysesPerVideo: vi.fn(),
  getTrends: vi.fn(),
}));

vi.mock('../../db/videos.js', () => ({
  upsertUserVideos: vi.fn(),
  getUserVideos: vi.fn(),
  getUserVideo: vi.fn(),
}));

vi.mock('../../lib/google.js', () => ({
  getUploadsPlaylistId: vi.fn(),
  listPlaylistVideos: vi.fn(),
  getVideoStats: vi.fn(),
  getAuthedYouTubeForUser: vi.fn(),
  createOAuth2Client: vi.fn(),
  getRedirectUri: vi.fn(() => 'http://localhost:3000/api/youtube/callback'),
}));

// Mock paywall with controlled behavior
let quotaCallCount = 0;
vi.mock('../paywall.js', () => ({
  enforceAnalyze: vi.fn(async () => {
    quotaCallCount++;
    if (quotaCallCount <= 1) {
      return { allowed: true };
    } else {
      return {
        allowed: false,
        error: {
          code: 'PAYWALL',
          reason: 'FREE_TIER_EXCEEDED',
          feature: 'analyze',
          upgradeUrl: 'https://example.com/upgrade',
        },
      };
    }
  }),
  enforceReply: vi.fn(),
}));

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => ({
            data: {
              id: 'test-user-id',
              email: 'test@example.com',
              tier: 'free',
            },
            error: null,
          })),
        })),
        limit: vi.fn(() => ({ error: null })),
      })),
      insert: vi.fn(() => ({ error: null })),
      upsert: vi.fn(() => ({ error: null })),
    })),
    rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
  })),
}));

import { createHttpServer } from '../index.js';

describe('Paywall Integration Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    quotaCallCount = 0; // Reset quota counter
  });

  it('should allow first analyze within quota', async () => {
    const app = await createHttpServer();

    const response = await app.inject({
      method: 'POST',
      url: '/api/analysis/vid1',
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.body);
    expect(data.videoId).toBe('vid1');
  });

  it('should block second analyze when quota exceeded', async () => {
    const app = await createHttpServer();

    // First request - should succeed
    const response1 = await app.inject({
      method: 'POST',
      url: '/api/analysis/vid1',
    });

    expect(response1.statusCode).toBe(200);

    // Second request - should be blocked by paywall
    const response2 = await app.inject({
      method: 'POST',
      url: '/api/analysis/vid2',
    });

    expect(response2.statusCode).toBe(402);
    const data = JSON.parse(response2.body);
    expect(data.code).toBe('PAYWALL');
    expect(data.reason).toBe('FREE_TIER_EXCEEDED');
    expect(data.feature).toBe('analyze');
    expect(data.upgradeUrl).toBeDefined();
  });

  it('should return standardized ApiErrorResponse format on paywall', async () => {
    const app = await createHttpServer();

    // Exhaust quota
    await app.inject({
      method: 'POST',
      url: '/api/analysis/vid1',
    });

    // Trigger paywall
    const response = await app.inject({
      method: 'POST',
      url: '/api/analysis/vid2',
    });

    expect(response.statusCode).toBe(402);
    const data = JSON.parse(response.body);

    // Verify standardized error format
    expect(data).toHaveProperty('code');
    expect(data).toHaveProperty('reason');
    expect(data).toHaveProperty('feature');
    expect(data).toHaveProperty('upgradeUrl');
    expect(data.code).toBe('PAYWALL');
  });
});
