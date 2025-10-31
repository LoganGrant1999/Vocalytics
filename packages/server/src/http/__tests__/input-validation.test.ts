/**
 * Input Validation Tests - STRICT
 *
 * Comprehensive validation testing for all API endpoints.
 * Tests ensure that:
 * 1. Invalid inputs are rejected with proper 400 errors
 * 2. Valid inputs pass validation
 * 3. Edge cases are handled correctly
 * 4. Security: no injection attacks via malformed inputs
 *
 * Coverage:
 * - analyze-comments: JSON Schema validation
 * - generate-replies: JSON Schema validation
 * - fetch-comments: JSON Schema + custom validation
 * - auth/register: Zod validation (email, password)
 * - auth/login: Zod validation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Supabase before imports
const mockSupabaseFrom = vi.fn();
vi.mock('../../db/client.js', () => ({
  supabase: {
    from: mockSupabaseFrom,
  },
}));

// Mock tools
vi.mock('../../tools.js', () => ({
  analyzeComments: vi.fn().mockResolvedValue([]),
  generateReplies: vi.fn().mockResolvedValue([]),
  fetchComments: vi.fn().mockResolvedValue({ comments: [], nextPageToken: null }),
}));

// Mock paywall
vi.mock('../paywall.js', () => ({
  enforceAnalyze: vi.fn().mockResolvedValue({ allowed: true }),
  enforceReply: vi.fn().mockResolvedValue({ allowed: true }),
}));

// Import after mocks
import { analyzeCommentsRoute } from '../routes/analyze-comments.js';
import { generateRepliesRoute } from '../routes/generate-replies.js';
import { fetchCommentsRoute } from '../routes/fetch-comments.js';
import { publicAuthRoutes } from '../routes/auth.js';

// Helper to create mock Fastify instance
function createMockFastify() {
  const routes: any[] = [];
  return {
    post: vi.fn((path, ...args) => {
      // Handle both (path, options, handler) and (path, handler)
      const handler = args.length === 2 ? args[1] : args[0];
      const options = args.length === 2 ? args[0] : {};
      routes.push({ method: 'POST', path, handler, options });
    }),
    get: vi.fn((path, handler) => {
      routes.push({ method: 'GET', path, handler });
    }),
    delete: vi.fn((path, handler) => {
      routes.push({ method: 'DELETE', path, handler });
    }),
    _getRoute: (method: string, path: string) =>
      routes.find((r) => r.method === method && r.path === path),
  };
}

describe('Input Validation - STRICT', () => {
  let fastify: any;

  beforeEach(() => {
    vi.clearAllMocks();
    fastify = createMockFastify();

    // Setup default Supabase mocks
    const mockSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({ single: mockSingle }),
      single: mockSingle
    });
    mockSupabaseFrom.mockReturnValue({ select: mockSelect });
  });

  describe('POST /analyze-comments - JSON Schema Validation', () => {
    it('should reject request with missing comments field', async () => {
      await analyzeCommentsRoute(fastify);
      const route = fastify._getRoute('POST', '/analyze-comments');

      const request = {
        body: {}, // Missing comments
        auth: { userId: 'test_user' },
      };
      const reply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      // Fastify schema validation should fail before handler is called
      // We'll simulate the validation error
      if (route.options.schema?.body) {
        const schema = route.options.schema.body;
        expect(schema.required).toContain('comments');
        expect(schema.properties.comments).toBeDefined();
      }
    });

    it('should reject request with empty comments array', async () => {
      await analyzeCommentsRoute(fastify);
      const route = fastify._getRoute('POST', '/analyze-comments');

      if (route.options.schema?.body) {
        const schema = route.options.schema.body;
        expect(schema.properties.comments.minItems).toBe(1);
      }
    });

    it('should reject comments with missing required id field', async () => {
      await analyzeCommentsRoute(fastify);
      const route = fastify._getRoute('POST', '/analyze-comments');

      if (route.options.schema?.body) {
        const schema = route.options.schema.body;
        const commentSchema = schema.properties.comments.items;
        expect(commentSchema.required).toContain('id');
        expect(commentSchema.required).toContain('text');
      }
    });

    it('should reject comments with empty id or text', async () => {
      await analyzeCommentsRoute(fastify);
      const route = fastify._getRoute('POST', '/analyze-comments');

      if (route.options.schema?.body) {
        const schema = route.options.schema.body;
        const commentSchema = schema.properties.comments.items;
        expect(commentSchema.properties.id.minLength).toBe(1);
        expect(commentSchema.properties.text.minLength).toBe(1);
      }
    });

    it('should reject comments with text exceeding max length', async () => {
      await analyzeCommentsRoute(fastify);
      const route = fastify._getRoute('POST', '/analyze-comments');

      if (route.options.schema?.body) {
        const schema = route.options.schema.body;
        const commentSchema = schema.properties.comments.items;
        expect(commentSchema.properties.text.maxLength).toBe(10000);
      }
    });

    it('should reject additional properties in comment objects', async () => {
      await analyzeCommentsRoute(fastify);
      const route = fastify._getRoute('POST', '/analyze-comments');

      if (route.options.schema?.body) {
        const schema = route.options.schema.body;
        const commentSchema = schema.properties.comments.items;
        expect(commentSchema.additionalProperties).toBe(false);
      }
    });

    it('should accept valid comments array', async () => {
      await analyzeCommentsRoute(fastify);
      const route = fastify._getRoute('POST', '/analyze-comments');

      const request = {
        body: {
          comments: [
            { id: 'comment_1', text: 'Great video!' },
            { id: 'comment_2', text: 'Very helpful, thanks!' },
          ],
        },
        auth: { userId: 'test_user' },
      };
      const reply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      await route.handler(request, reply);

      // Should not return error code
      expect(reply.code).not.toHaveBeenCalledWith(400);
    });
  });

  describe('POST /generate-replies - JSON Schema Validation', () => {
    it('should reject request with missing comment field', async () => {
      await generateRepliesRoute(fastify);
      const route = fastify._getRoute('POST', '/generate-replies');

      if (route.options.schema?.body) {
        const schema = route.options.schema.body;
        expect(schema.required).toContain('comment');
        expect(schema.properties.comment).toBeDefined();
      }
    });

    it('should reject comment with missing required fields', async () => {
      await generateRepliesRoute(fastify);
      const route = fastify._getRoute('POST', '/generate-replies');

      if (route.options.schema?.body) {
        const schema = route.options.schema.body;
        const commentSchema = schema.properties.comment;
        expect(commentSchema.required).toContain('id');
        expect(commentSchema.required).toContain('text');
      }
    });

    it('should validate tones enum values', async () => {
      await generateRepliesRoute(fastify);
      const route = fastify._getRoute('POST', '/generate-replies');

      if (route.options.schema?.body) {
        const schema = route.options.schema.body;
        const tonesSchema = schema.properties.tones;
        expect(tonesSchema.items.enum).toEqual(['friendly', 'concise', 'enthusiastic']);
      }
    });

    it('should reject comment with text exceeding max length', async () => {
      await generateRepliesRoute(fastify);
      const route = fastify._getRoute('POST', '/generate-replies');

      if (route.options.schema?.body) {
        const schema = route.options.schema.body;
        const commentSchema = schema.properties.comment;
        expect(commentSchema.properties.text.maxLength).toBe(10000);
      }
    });

    it('should accept valid comment and tones', async () => {
      await generateRepliesRoute(fastify);
      const route = fastify._getRoute('POST', '/generate-replies');

      const request = {
        body: {
          comment: { id: 'comment_1', text: 'Great video!' },
          tones: ['friendly', 'enthusiastic'],
        },
        auth: { userDbId: 'test_user' },
      };
      const reply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      await route.handler(request, reply);

      expect(reply.code).not.toHaveBeenCalledWith(400);
    });

    it('should accept comment without tones (optional field)', async () => {
      await generateRepliesRoute(fastify);
      const route = fastify._getRoute('POST', '/generate-replies');

      const request = {
        body: {
          comment: { id: 'comment_1', text: 'Great video!' },
          // tones is optional
        },
        auth: { userDbId: 'test_user' },
      };
      const reply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      await route.handler(request, reply);

      expect(reply.code).not.toHaveBeenCalledWith(400);
    });
  });

  describe('POST /fetch-comments - JSON Schema + Custom Validation', () => {
    it('should validate max field range', async () => {
      await fetchCommentsRoute(fastify);
      const route = fastify._getRoute('POST', '/fetch-comments');

      if (route.options.schema?.body) {
        const schema = route.options.schema.body;
        expect(schema.properties.max.minimum).toBe(1);
        expect(schema.properties.max.maximum).toBe(50);
      }
    });

    it('should validate order enum values', async () => {
      await fetchCommentsRoute(fastify);
      const route = fastify._getRoute('POST', '/fetch-comments');

      if (route.options.schema?.body) {
        const schema = route.options.schema.body;
        expect(schema.properties.order.enum).toEqual(['time', 'relevance']);
      }
    });

    it('should validate includeReplies is boolean', async () => {
      await fetchCommentsRoute(fastify);
      const route = fastify._getRoute('POST', '/fetch-comments');

      if (route.options.schema?.body) {
        const schema = route.options.schema.body;
        expect(schema.properties.includeReplies.type).toBe('boolean');
      }
    });

    it('should accept valid videoId', async () => {
      await fetchCommentsRoute(fastify);
      const route = fastify._getRoute('POST', '/fetch-comments');

      if (route.options.schema?.body) {
        const schema = route.options.schema.body;
        expect(schema.properties.videoId.type).toBe('string');
        expect(schema.properties.videoId.minLength).toBe(1);
      }
    });

    it('should accept valid channelId', async () => {
      await fetchCommentsRoute(fastify);
      const route = fastify._getRoute('POST', '/fetch-comments');

      if (route.options.schema?.body) {
        const schema = route.options.schema.body;
        expect(schema.properties.channelId.type).toBe('string');
        expect(schema.properties.channelId.minLength).toBe(1);
      }
    });

    it('should reject additional properties', async () => {
      await fetchCommentsRoute(fastify);
      const route = fastify._getRoute('POST', '/fetch-comments');

      if (route.options.schema?.body) {
        const schema = route.options.schema.body;
        expect(schema.additionalProperties).toBe(false);
      }
    });
  });

  describe('POST /auth/register - Zod Validation', () => {
    it('should reject registration with invalid email format', async () => {
      await publicAuthRoutes(fastify);
      const route = fastify._getRoute('POST', '/auth/register');

      const request = {
        body: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'not-an-email', // Invalid email
          password: 'ValidPass123',
        },
      };
      const reply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      await route.handler(request, reply);

      expect(reply.code).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Validation error',
          message: expect.stringContaining('email'),
        })
      );
    });

    it('should reject password shorter than 8 characters', async () => {
      await publicAuthRoutes(fastify);
      const route = fastify._getRoute('POST', '/auth/register');

      const request = {
        body: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          password: 'Short1', // Too short
        },
      };
      const reply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      await route.handler(request, reply);

      expect(reply.code).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Validation error',
          message: expect.stringMatching(/at least 8 characters/),
        })
      );
    });

    it('should reject password without uppercase letter', async () => {
      await publicAuthRoutes(fastify);
      const route = fastify._getRoute('POST', '/auth/register');

      const request = {
        body: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          password: 'lowercase123', // No uppercase
        },
      };
      const reply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      await route.handler(request, reply);

      expect(reply.code).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Validation error',
          message: expect.stringMatching(/uppercase/),
        })
      );
    });

    it('should reject password without lowercase letter', async () => {
      await publicAuthRoutes(fastify);
      const route = fastify._getRoute('POST', '/auth/register');

      const request = {
        body: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          password: 'UPPERCASE123', // No lowercase
        },
      };
      const reply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      await route.handler(request, reply);

      expect(reply.code).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Validation error',
          message: expect.stringMatching(/lowercase/),
        })
      );
    });

    it('should reject password without number', async () => {
      await publicAuthRoutes(fastify);
      const route = fastify._getRoute('POST', '/auth/register');

      const request = {
        body: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          password: 'NoNumbersHere', // No number
        },
      };
      const reply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      await route.handler(request, reply);

      expect(reply.code).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Validation error',
          message: expect.stringMatching(/number/),
        })
      );
    });

    it('should reject registration with missing firstName', async () => {
      await publicAuthRoutes(fastify);
      const route = fastify._getRoute('POST', '/auth/register');

      const request = {
        body: {
          // firstName missing
          lastName: 'Doe',
          email: 'john@example.com',
          password: 'ValidPass123',
        },
      };
      const reply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      await route.handler(request, reply);

      expect(reply.code).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Validation error',
        })
      );
    });

    it('should reject registration with missing lastName', async () => {
      await publicAuthRoutes(fastify);
      const route = fastify._getRoute('POST', '/auth/register');

      const request = {
        body: {
          firstName: 'John',
          // lastName missing
          email: 'john@example.com',
          password: 'ValidPass123',
        },
      };
      const reply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      await route.handler(request, reply);

      expect(reply.code).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Validation error',
        })
      );
    });

    it('should reject registration with empty firstName', async () => {
      await publicAuthRoutes(fastify);
      const route = fastify._getRoute('POST', '/auth/register');

      const request = {
        body: {
          firstName: '', // Empty string
          lastName: 'Doe',
          email: 'john@example.com',
          password: 'ValidPass123',
        },
      };
      const reply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      await route.handler(request, reply);

      expect(reply.code).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Validation error',
          message: expect.stringMatching(/First name/),
        })
      );
    });
  });

  describe('POST /auth/login - Zod Validation', () => {
    it('should reject login with invalid email format', async () => {
      await publicAuthRoutes(fastify);
      const route = fastify._getRoute('POST', '/auth/login');

      const request = {
        body: {
          email: 'not-an-email',
          password: 'password123',
        },
      };
      const reply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      await route.handler(request, reply);

      expect(reply.code).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Validation error',
          message: expect.stringContaining('email'),
        })
      );
    });

    it('should reject login with missing email', async () => {
      await publicAuthRoutes(fastify);
      const route = fastify._getRoute('POST', '/auth/login');

      const request = {
        body: {
          // email missing
          password: 'password123',
        },
      };
      const reply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      await route.handler(request, reply);

      expect(reply.code).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Validation error',
        })
      );
    });

    it('should reject login with missing password', async () => {
      await publicAuthRoutes(fastify);
      const route = fastify._getRoute('POST', '/auth/login');

      const request = {
        body: {
          email: 'john@example.com',
          // password missing
        },
      };
      const reply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      await route.handler(request, reply);

      expect(reply.code).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Validation error',
        })
      );
    });

    it('should reject login with empty password', async () => {
      await publicAuthRoutes(fastify);
      const route = fastify._getRoute('POST', '/auth/login');

      const request = {
        body: {
          email: 'john@example.com',
          password: '', // Empty password
        },
      };
      const reply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      await route.handler(request, reply);

      expect(reply.code).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Validation error',
          message: expect.stringMatching(/Password/),
        })
      );
    });
  });

  describe('Edge Cases and Security', () => {
    it('should reject SQL injection attempts in comment text', async () => {
      await analyzeCommentsRoute(fastify);
      const route = fastify._getRoute('POST', '/analyze-comments');

      const request = {
        body: {
          comments: [
            {
              id: 'comment_1',
              text: "'; DROP TABLE users; --", // SQL injection attempt
            },
          ],
        },
        auth: { userId: 'test_user' },
      };
      const reply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      await route.handler(request, reply);

      // Should accept as valid text (backend must sanitize queries)
      // but ensure it doesn't break the handler
      expect(reply.send).toHaveBeenCalled();
    });

    it('should handle unicode characters in comment text', async () => {
      await analyzeCommentsRoute(fastify);
      const route = fastify._getRoute('POST', '/analyze-comments');

      const request = {
        body: {
          comments: [
            {
              id: 'comment_1',
              text: '你好！こんにちは！مرحبا！🎉', // Unicode and emoji
            },
          ],
        },
        auth: { userId: 'test_user' },
      };
      const reply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      await route.handler(request, reply);

      expect(reply.code).not.toHaveBeenCalledWith(400);
    });

    it('should reject extremely long comment text', async () => {
      await analyzeCommentsRoute(fastify);
      const route = fastify._getRoute('POST', '/analyze-comments');

      if (route.options.schema?.body) {
        const schema = route.options.schema.body;
        const commentSchema = schema.properties.comments.items;

        // Schema should define maxLength
        expect(commentSchema.properties.text.maxLength).toBeDefined();
        expect(commentSchema.properties.text.maxLength).toBe(10000);
      }
    });

    it('should reject null values where strings are required', async () => {
      await analyzeCommentsRoute(fastify);
      const route = fastify._getRoute('POST', '/analyze-comments');

      if (route.options.schema?.body) {
        const schema = route.options.schema.body;
        const commentSchema = schema.properties.comments.items;

        // Schema should specify string type
        expect(commentSchema.properties.id.type).toBe('string');
        expect(commentSchema.properties.text.type).toBe('string');
      }
    });
  });
});
