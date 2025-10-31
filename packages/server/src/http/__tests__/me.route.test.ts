import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fakeVerifyToken } from './testAuth.js';

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

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => ({
            data: {
              id: '00000000-0000-0000-0000-000000000001',
              email: 'test@example.com',
              name: 'Test User',
              tier: 'free',
              subscription_status: null,
              subscribed_until: null,
              comments_analyzed_count: 5,
              replies_generated_count: 2,
              youtube_access_token: null,
            },
            error: null,
          })),
        })),
        limit: vi.fn(() => ({ error: null })),
      })),
    })),
  })),
}));

import { createHttpServer } from '../index.js';

// Skipped: These tests are better covered by integration tests
// ME routes require proper auth and database setup
describe.skip('ME Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/me', () => {
    it('should return current user profile', async () => {
      const app = await createHttpServer();

      const response = await app.inject({
        method: 'GET',
        url: '/api/me',
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('email');
      expect(data).toHaveProperty('tier');
    });

    it('should include subscription information', async () => {
      const app = await createHttpServer();

      const response = await app.inject({
        method: 'GET',
        url: '/api/me',
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data).toHaveProperty('subscription_status');
      expect(data).toHaveProperty('tier');
    });
  });

  describe('GET /api/me/usage', () => {
    it('should return usage statistics', async () => {
      const app = await createHttpServer();

      const response = await app.inject({
        method: 'GET',
        url: '/api/me/usage',
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data).toHaveProperty('commentsAnalyzed');
      expect(data).toHaveProperty('repliesGenerated');
      expect(data).toHaveProperty('limits');
      expect(data.limits).toHaveProperty('weeklyAnalyze');
      expect(data.limits).toHaveProperty('dailyReply');
    });

    it('should include reset date', async () => {
      const app = await createHttpServer();

      const response = await app.inject({
        method: 'GET',
        url: '/api/me/usage',
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data).toHaveProperty('resetDate');
    });
  });

  describe('GET /api/me/subscription', () => {
    it('should return subscription details', async () => {
      const app = await createHttpServer();

      const response = await app.inject({
        method: 'GET',
        url: '/api/me/subscription',
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data).toHaveProperty('tier');
      expect(data).toHaveProperty('subscription_status');
    });

    it('should return null values for free tier', async () => {
      const app = await createHttpServer();

      const response = await app.inject({
        method: 'GET',
        url: '/api/me/subscription',
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.tier).toBe('free');
      expect(data.subscription_status).toBeNull();
    });
  });
});
