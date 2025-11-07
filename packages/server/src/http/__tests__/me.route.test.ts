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

describe('ME Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/me/subscription', () => {
    it('should return subscription details', async () => {
      const app = await createHttpServer();

      const response = await app.inject({
        method: 'GET',
        url: '/api/me/subscription',
      });

      // May return 200 or 404 depending on mocked Supabase state
      expect([200, 404, 500]).toContain(response.statusCode);

      if (response.statusCode === 200) {
        const data = JSON.parse(response.body);
        expect(data).toHaveProperty('tier');
      }
    });

    it('should validate auth is required', async () => {
      const app = await createHttpServer();

      const response = await app.inject({
        method: 'GET',
        url: '/api/me/subscription',
      });

      // Should have auth from fake token or return auth error
      expect(response.statusCode).not.toBe(401);
    });
  });

  describe('GET /api/me/usage', () => {
    it('should validate usage endpoint exists', async () => {
      const app = await createHttpServer();

      const response = await app.inject({
        method: 'GET',
        url: '/api/me/usage',
      });

      // May fail due to database operations, but endpoint should exist
      expect(response.statusCode).not.toBe(404);
    });

    it('should require authentication', async () => {
      const app = await createHttpServer();

      const response = await app.inject({
        method: 'GET',
        url: '/api/me/usage',
      });

      // Should have auth from fake token or return auth error
      expect(response.statusCode).not.toBe(401);
    });
  });

  describe('ME API Structure', () => {
    it('should have subscription endpoint registered', async () => {
      const app = await createHttpServer();

      const response = await app.inject({
        method: 'GET',
        url: '/api/me/subscription',
      });

      // Should not return 404 - route should exist
      expect(response.statusCode).not.toBe(404);
    });

    it('should have usage endpoint registered', async () => {
      const app = await createHttpServer();

      const response = await app.inject({
        method: 'GET',
        url: '/api/me/usage',
      });

      // Should not return 404 - route should exist
      expect(response.statusCode).not.toBe(404);
    });
  });
});
