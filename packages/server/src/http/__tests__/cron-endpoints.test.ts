/**
 * Cron Endpoint Tests - Production Critical
 *
 * Tests the cron job endpoints that run scheduled workers.
 * These endpoints must be secured with CRON_SECRET to prevent unauthorized access.
 *
 * Critical Scenarios:
 * - POST /api/cron/queue-worker (runs every 5 minutes)
 * - POST /api/cron/reset-counters (runs daily at 00:10 PT)
 * - CRON_SECRET authentication
 * - Worker invocation and error handling
 * - Response structure validation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHttpServer } from '../index.js';
import type { FastifyInstance } from 'fastify';

// Use vi.hoisted for proper mock function creation
const {
  mockProcessQueue,
  mockRollUsageCounters,
} = vi.hoisted(() => ({
  mockProcessQueue: vi.fn(),
  mockRollUsageCounters: vi.fn(),
}));

// Mock queue worker
vi.mock('../../workers/queueWorker.js', () => ({
  processQueue: mockProcessQueue,
}));

// Mock rate limits (for rollUsageCounters)
vi.mock('../../db/rateLimits.js', async () => {
  const actual = await vi.importActual('../../db/rateLimits.js');
  return {
    ...actual,
    rollUsageCounters: mockRollUsageCounters,
  };
});

describe('Cron Endpoints - Production Critical', () => {
  let app: FastifyInstance;
  let originalCronSecret: string | undefined;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Save original CRON_SECRET
    originalCronSecret = process.env.CRON_SECRET;

    // Set a test CRON_SECRET
    process.env.CRON_SECRET = 'test-cron-secret-123';

    // Default mock implementations
    mockProcessQueue.mockResolvedValue(undefined);
    mockRollUsageCounters.mockResolvedValue(undefined);

    app = await createHttpServer();
  });

  afterEach(async () => {
    await app.close();

    // Restore original CRON_SECRET
    if (originalCronSecret !== undefined) {
      process.env.CRON_SECRET = originalCronSecret;
    } else {
      delete process.env.CRON_SECRET;
    }
  });

  describe('POST /api/cron/queue-worker - Authentication', () => {
    it('should accept request with valid CRON_SECRET', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/cron/queue-worker',
        headers: {
          Authorization: 'Bearer test-cron-secret-123',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockProcessQueue).toHaveBeenCalled();
    });

    it('should reject request without Authorization header', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/cron/queue-worker',
      });

      expect(response.statusCode).toBe(401);
      const data = JSON.parse(response.body);
      expect(data.error).toBe('Unauthorized');
      expect(mockProcessQueue).not.toHaveBeenCalled();
    });

    it('should reject request with invalid CRON_SECRET', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/cron/queue-worker',
        headers: {
          Authorization: 'Bearer wrong-secret',
        },
      });

      expect(response.statusCode).toBe(401);
      const data = JSON.parse(response.body);
      expect(data.error).toBe('Unauthorized');
      expect(mockProcessQueue).not.toHaveBeenCalled();
    });

    it('should reject request with malformed Authorization header', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/cron/queue-worker',
        headers: {
          Authorization: 'test-cron-secret-123', // Missing "Bearer "
        },
      });

      expect(response.statusCode).toBe(401);
      expect(mockProcessQueue).not.toHaveBeenCalled();
    });

    it('should reject request with empty Authorization header', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/cron/queue-worker',
        headers: {
          Authorization: '',
        },
      });

      expect(response.statusCode).toBe(401);
      expect(mockProcessQueue).not.toHaveBeenCalled();
    });

    it('should allow request when CRON_SECRET is not set', async () => {
      // Temporarily unset CRON_SECRET
      delete process.env.CRON_SECRET;

      // Need to recreate server for env change to take effect
      await app.close();
      app = await createHttpServer();

      const response = await app.inject({
        method: 'POST',
        url: '/api/cron/queue-worker',
      });

      // Should succeed without auth when CRON_SECRET not set
      expect(response.statusCode).toBe(200);
      expect(mockProcessQueue).toHaveBeenCalled();
    });
  });

  describe('POST /api/cron/queue-worker - Execution', () => {
    it('should call processQueue successfully', async () => {
      mockProcessQueue.mockResolvedValue(undefined);

      const response = await app.inject({
        method: 'POST',
        url: '/api/cron/queue-worker',
        headers: {
          Authorization: 'Bearer test-cron-secret-123',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockProcessQueue).toHaveBeenCalled();
      expect(mockProcessQueue).toHaveBeenCalledTimes(1);

      const data = JSON.parse(response.body);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Queue processed successfully');
      expect(data.timestamp).toBeDefined();
      expect(new Date(data.timestamp).getTime()).toBeGreaterThan(0);
    });

    it('should handle processQueue errors gracefully', async () => {
      const error = new Error('Queue processing failed: Database connection lost');
      mockProcessQueue.mockRejectedValue(error);

      const response = await app.inject({
        method: 'POST',
        url: '/api/cron/queue-worker',
        headers: {
          Authorization: 'Bearer test-cron-secret-123',
        },
      });

      expect(response.statusCode).toBe(500);
      expect(mockProcessQueue).toHaveBeenCalled();

      const data = JSON.parse(response.body);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Queue processing failed');
      expect(data.timestamp).toBeDefined();
    });

    it('should return proper response structure on success', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/cron/queue-worker',
        headers: {
          Authorization: 'Bearer test-cron-secret-123',
        },
      });

      const data = JSON.parse(response.body);
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('message');
      expect(data).toHaveProperty('timestamp');
      expect(typeof data.success).toBe('boolean');
      expect(typeof data.message).toBe('string');
      expect(typeof data.timestamp).toBe('string');
    });

    it('should return proper response structure on error', async () => {
      mockProcessQueue.mockRejectedValue(new Error('Test error'));

      const response = await app.inject({
        method: 'POST',
        url: '/api/cron/queue-worker',
        headers: {
          Authorization: 'Bearer test-cron-secret-123',
        },
      });

      const data = JSON.parse(response.body);
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('error');
      expect(data).toHaveProperty('timestamp');
      expect(data.success).toBe(false);
      expect(typeof data.error).toBe('string');
    });

    it('should handle timeout errors', async () => {
      mockProcessQueue.mockRejectedValue(new Error('Operation timed out'));

      const response = await app.inject({
        method: 'POST',
        url: '/api/cron/queue-worker',
        headers: {
          Authorization: 'Bearer test-cron-secret-123',
        },
      });

      expect(response.statusCode).toBe(500);
      const data = JSON.parse(response.body);
      expect(data.error).toContain('timed out');
    });

    it('should handle network errors', async () => {
      mockProcessQueue.mockRejectedValue(new Error('ECONNREFUSED'));

      const response = await app.inject({
        method: 'POST',
        url: '/api/cron/queue-worker',
        headers: {
          Authorization: 'Bearer test-cron-secret-123',
        },
      });

      expect(response.statusCode).toBe(500);
      const data = JSON.parse(response.body);
      expect(data.error).toContain('ECONNREFUSED');
    });
  });

  describe('POST /api/cron/reset-counters - Authentication', () => {
    it('should accept request with valid CRON_SECRET', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/cron/reset-counters',
        headers: {
          Authorization: 'Bearer test-cron-secret-123',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockRollUsageCounters).toHaveBeenCalled();
    });

    it('should reject request without Authorization header', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/cron/reset-counters',
      });

      expect(response.statusCode).toBe(401);
      const data = JSON.parse(response.body);
      expect(data.error).toBe('Unauthorized');
      expect(mockRollUsageCounters).not.toHaveBeenCalled();
    });

    it('should reject request with invalid CRON_SECRET', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/cron/reset-counters',
        headers: {
          Authorization: 'Bearer wrong-secret',
        },
      });

      expect(response.statusCode).toBe(401);
      const data = JSON.parse(response.body);
      expect(data.error).toBe('Unauthorized');
      expect(mockRollUsageCounters).not.toHaveBeenCalled();
    });

    it('should reject request with malformed Authorization header', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/cron/reset-counters',
        headers: {
          Authorization: 'test-cron-secret-123', // Missing "Bearer "
        },
      });

      expect(response.statusCode).toBe(401);
      expect(mockRollUsageCounters).not.toHaveBeenCalled();
    });

    it('should reject request with empty Authorization header', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/cron/reset-counters',
        headers: {
          Authorization: '',
        },
      });

      expect(response.statusCode).toBe(401);
      expect(mockRollUsageCounters).not.toHaveBeenCalled();
    });

    it('should allow request when CRON_SECRET is not set', async () => {
      // Temporarily unset CRON_SECRET
      delete process.env.CRON_SECRET;

      // Need to recreate server for env change to take effect
      await app.close();
      app = await createHttpServer();

      const response = await app.inject({
        method: 'POST',
        url: '/api/cron/reset-counters',
      });

      // Should succeed without auth when CRON_SECRET not set
      expect(response.statusCode).toBe(200);
      expect(mockRollUsageCounters).toHaveBeenCalled();
    });
  });

  describe('POST /api/cron/reset-counters - Execution', () => {
    it('should call rollUsageCounters successfully', async () => {
      mockRollUsageCounters.mockResolvedValue(undefined);

      const response = await app.inject({
        method: 'POST',
        url: '/api/cron/reset-counters',
        headers: {
          Authorization: 'Bearer test-cron-secret-123',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockRollUsageCounters).toHaveBeenCalled();
      expect(mockRollUsageCounters).toHaveBeenCalledTimes(1);

      const data = JSON.parse(response.body);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Counters reset successfully');
      expect(data.timestamp).toBeDefined();
      expect(new Date(data.timestamp).getTime()).toBeGreaterThan(0);
    });

    it('should handle rollUsageCounters errors gracefully', async () => {
      const error = new Error('Counter reset failed: Database error');
      mockRollUsageCounters.mockRejectedValue(error);

      const response = await app.inject({
        method: 'POST',
        url: '/api/cron/reset-counters',
        headers: {
          Authorization: 'Bearer test-cron-secret-123',
        },
      });

      expect(response.statusCode).toBe(500);
      expect(mockRollUsageCounters).toHaveBeenCalled();

      const data = JSON.parse(response.body);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Counter reset failed');
      expect(data.timestamp).toBeDefined();
    });

    it('should return proper response structure on success', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/cron/reset-counters',
        headers: {
          Authorization: 'Bearer test-cron-secret-123',
        },
      });

      const data = JSON.parse(response.body);
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('message');
      expect(data).toHaveProperty('timestamp');
      expect(typeof data.success).toBe('boolean');
      expect(typeof data.message).toBe('string');
      expect(typeof data.timestamp).toBe('string');
    });

    it('should return proper response structure on error', async () => {
      mockRollUsageCounters.mockRejectedValue(new Error('Test error'));

      const response = await app.inject({
        method: 'POST',
        url: '/api/cron/reset-counters',
        headers: {
          Authorization: 'Bearer test-cron-secret-123',
        },
      });

      const data = JSON.parse(response.body);
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('error');
      expect(data).toHaveProperty('timestamp');
      expect(data.success).toBe(false);
      expect(typeof data.error).toBe('string');
    });

    it('should handle timeout errors', async () => {
      mockRollUsageCounters.mockRejectedValue(new Error('Operation timed out'));

      const response = await app.inject({
        method: 'POST',
        url: '/api/cron/reset-counters',
        headers: {
          Authorization: 'Bearer test-cron-secret-123',
        },
      });

      expect(response.statusCode).toBe(500);
      const data = JSON.parse(response.body);
      expect(data.error).toContain('timed out');
    });

    it('should handle database connection errors', async () => {
      mockRollUsageCounters.mockRejectedValue(new Error('Connection pool exhausted'));

      const response = await app.inject({
        method: 'POST',
        url: '/api/cron/reset-counters',
        headers: {
          Authorization: 'Bearer test-cron-secret-123',
        },
      });

      expect(response.statusCode).toBe(500);
      const data = JSON.parse(response.body);
      expect(data.error).toContain('Connection pool exhausted');
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle concurrent cron job requests', async () => {
      mockProcessQueue.mockResolvedValue(undefined);
      mockRollUsageCounters.mockResolvedValue(undefined);

      // Simulate Vercel running both cron jobs simultaneously
      const [response1, response2] = await Promise.all([
        app.inject({
          method: 'POST',
          url: '/api/cron/queue-worker',
          headers: {
            Authorization: 'Bearer test-cron-secret-123',
          },
        }),
        app.inject({
          method: 'POST',
          url: '/api/cron/reset-counters',
          headers: {
            Authorization: 'Bearer test-cron-secret-123',
          },
        }),
      ]);

      expect(response1.statusCode).toBe(200);
      expect(response2.statusCode).toBe(200);
      expect(mockProcessQueue).toHaveBeenCalledTimes(1);
      expect(mockRollUsageCounters).toHaveBeenCalledTimes(1);
    });

    it('should handle rapid sequential requests to same endpoint', async () => {
      mockProcessQueue.mockResolvedValue(undefined);

      // Make requests sequentially (one after another, rapidly)
      const response1 = await app.inject({
        method: 'POST',
        url: '/api/cron/queue-worker',
        headers: {
          Authorization: 'Bearer test-cron-secret-123',
        },
      });

      const response2 = await app.inject({
        method: 'POST',
        url: '/api/cron/queue-worker',
        headers: {
          Authorization: 'Bearer test-cron-secret-123',
        },
      });

      const response3 = await app.inject({
        method: 'POST',
        url: '/api/cron/queue-worker',
        headers: {
          Authorization: 'Bearer test-cron-secret-123',
        },
      });

      expect(response1.statusCode).toBe(200);
      expect(response2.statusCode).toBe(200);
      expect(response3.statusCode).toBe(200);
      expect(mockProcessQueue).toHaveBeenCalledTimes(3);
    });

    it('should maintain isolation between endpoints', async () => {
      // Queue worker succeeds, counter reset fails
      mockProcessQueue.mockResolvedValue(undefined);
      mockRollUsageCounters.mockRejectedValue(new Error('Reset failed'));

      const response1 = await app.inject({
        method: 'POST',
        url: '/api/cron/queue-worker',
        headers: {
          Authorization: 'Bearer test-cron-secret-123',
        },
      });

      const response2 = await app.inject({
        method: 'POST',
        url: '/api/cron/reset-counters',
        headers: {
          Authorization: 'Bearer test-cron-secret-123',
        },
      });

      expect(response1.statusCode).toBe(200);
      expect(response2.statusCode).toBe(500);
      expect(mockProcessQueue).toHaveBeenCalled();
      expect(mockRollUsageCounters).toHaveBeenCalled();
    });
  });

  describe('Security & Edge Cases', () => {
    it('should not leak error details in 401 response', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/cron/queue-worker',
        headers: {
          Authorization: 'Bearer wrong-secret',
        },
      });

      expect(response.statusCode).toBe(401);
      const data = JSON.parse(response.body);
      expect(data.error).toBe('Unauthorized');
      // Should not reveal what the correct secret is
      expect(response.body).not.toContain('test-cron-secret-123');
    });

    it('should validate timestamp format', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/cron/queue-worker',
        headers: {
          Authorization: 'Bearer test-cron-secret-123',
        },
      });

      const data = JSON.parse(response.body);
      expect(data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(() => new Date(data.timestamp)).not.toThrow();
    });

    it('should handle case-sensitive Bearer token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/cron/queue-worker',
        headers: {
          Authorization: 'bearer test-cron-secret-123', // lowercase "bearer"
        },
      });

      expect(response.statusCode).toBe(401);
      expect(mockProcessQueue).not.toHaveBeenCalled();
    });

    it('should handle extra whitespace in Authorization header', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/cron/queue-worker',
        headers: {
          Authorization: 'Bearer  test-cron-secret-123', // extra space
        },
      });

      expect(response.statusCode).toBe(401);
      expect(mockProcessQueue).not.toHaveBeenCalled();
    });

    it('should reject non-POST methods', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/cron/queue-worker',
        headers: {
          Authorization: 'Bearer test-cron-secret-123',
        },
      });

      expect(response.statusCode).toBe(404);
      expect(mockProcessQueue).not.toHaveBeenCalled();
    });

    it('should handle special characters in CRON_SECRET', async () => {
      const specialSecret = 'test-secret-!@#$%^&*()_+-=';
      process.env.CRON_SECRET = specialSecret;

      await app.close();
      app = await createHttpServer();

      const response = await app.inject({
        method: 'POST',
        url: '/api/cron/queue-worker',
        headers: {
          Authorization: `Bearer ${specialSecret}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockProcessQueue).toHaveBeenCalled();
    });

    it('should handle very long CRON_SECRET', async () => {
      const longSecret = 'a'.repeat(256);
      process.env.CRON_SECRET = longSecret;

      await app.close();
      app = await createHttpServer();

      const response = await app.inject({
        method: 'POST',
        url: '/api/cron/queue-worker',
        headers: {
          Authorization: `Bearer ${longSecret}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockProcessQueue).toHaveBeenCalled();
    });
  });
});
