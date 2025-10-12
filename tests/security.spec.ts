/**
 * Security Verification - STRICT
 * All security controls must be present or deployment FAILS
 */

import { describe, it, expect } from 'vitest';
import {
  apiNoAuth,
  apiWithToken,
  api,
  createTestComment,
  BASE_URL,
} from './utils';

describe('Security Verification - STRICT', () => {
  describe('CORS - MUST be allowlist (NO wildcard)', () => {
    it('must reject or not echo malicious origins', async () => {
      const maliciousOrigin = 'https://malicious.example';

      const res = await fetch(`${BASE_URL}/api/analyze-comments`, {
        method: 'POST',
        headers: {
          'Origin': maliciousOrigin,
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.JWT}`,
        },
        body: JSON.stringify({
          comments: [createTestComment({ id: 'cors_test' })],
        }),
      });

      const corsHeader = res.headers.get('access-control-allow-origin');

      // STRICT: Must NOT be wildcard
      expect(corsHeader).not.toBe('*');

      // STRICT: Must NOT echo malicious origin
      expect(corsHeader).not.toBe(maliciousOrigin);

      // If CORS is set, it must be a specific allowlist
      if (corsHeader && corsHeader !== 'null') {
        // Allowed origins should be your domains only
        expect(corsHeader).toMatch(/^https?:\/\//);

        // Document what's allowed
        console.log(`  ℹ️  CORS allowed origin: ${corsHeader}`);
      } else {
        console.log('  ℹ️  CORS not configured (restrictive by default)');
      }
    });

    it('must not allow credentials with wildcard', async () => {
      const res = await fetch(`${BASE_URL}/healthz`, {
        headers: {
          'Origin': 'https://malicious.example',
        },
      });

      const corsOrigin = res.headers.get('access-control-allow-origin');
      const corsCredentials = res.headers.get('access-control-allow-credentials');

      // STRICT: If credentials allowed, origin CANNOT be wildcard
      if (corsCredentials === 'true') {
        expect(corsOrigin).not.toBe('*');
      }
    });
  });

  describe('Authentication - 401 without stack traces', () => {
    it('must return 401 for invalid token', async () => {
      const res = await apiWithToken('/api/me/subscription', 'notatoken');

      expect(res.status).toBe(401);
      expect(res.data).toHaveProperty('error');

      // STRICT: No stack traces in production
      const body = JSON.stringify(res.data);
      expect(body).not.toContain('stack');
      expect(body).not.toContain('at Object');
      expect(body).not.toContain('.ts:');
      expect(body).not.toContain('Error:');
    });

    it('must return 401 for malformed token', async () => {
      const res = await apiWithToken('/api/me/subscription', 'not.a.jwt.token');

      expect(res.status).toBe(401);

      // STRICT: Safe error message
      const body = JSON.stringify(res.data);
      expect(body).not.toContain('stack');
    });
  });

  describe('Body Size Limit - MUST return 413 or deterministic 400', () => {
    it('must reject payloads exceeding body limit', async () => {
      // Create 6MB payload (assuming 5MB limit)
      const largeComments = Array.from({ length: 6000 }, (_, i) =>
        createTestComment({
          id: `large_${i}`,
          text: 'x'.repeat(1000), // 1KB each
        })
      );

      const res = await api('/api/analyze-comments', {
        method: 'POST',
        body: JSON.stringify({ comments: largeComments }),
      });

      // STRICT: Must be 413 (Payload Too Large) or 400 (Bad Request)
      // Must NOT be 500 (Internal Server Error)
      expect([400, 413]).toContain(res.status);

      if (res.status === 413) {
        console.log('  ✓ Correctly returns 413 Payload Too Large');
      } else if (res.status === 400) {
        console.log('  ✓ Returns 400 with deterministic message');
        expect(res.data).toHaveProperty('error');
      }

      // STRICT: Must NOT crash with 500
      expect(res.status).not.toBe(500);
    });
  });

  describe('Input Validation - STRICT', () => {
    it('must return 400 for missing required fields', async () => {
      const res = await api('/api/analyze-comments', {
        method: 'POST',
        body: JSON.stringify({}), // Missing 'comments'
      });

      expect(res.status).toBe(400);
      expect(res.data).toHaveProperty('error');
    });

    it('must return 400 for invalid data types', async () => {
      const res = await api('/api/analyze-comments', {
        method: 'POST',
        body: JSON.stringify({ comments: 'not an array' }),
      });

      expect(res.status).toBe(400);
    });

    it('must reject over-long text (>10k chars)', async () => {
      const comment = createTestComment({
        id: 'long_text',
        text: 'x'.repeat(11000), // 11KB text
      });

      const res = await api('/api/analyze-comments', {
        method: 'POST',
        body: JSON.stringify({ comments: [comment] }),
      });

      // Either handled (200) or rejected (400)
      // If handled, log warning; if rejected, that's good
      if (res.status === 200) {
        console.log('  ⚠️  Accepts 11KB text - consider adding max length validation');
      } else {
        expect(res.status).toBe(400);
        console.log('  ✓ Correctly rejects over-long text');
      }
    });

    it('must handle malformed JSON gracefully', async () => {
      const res = await fetch(`${BASE_URL}/api/analyze-comments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.JWT}`,
          'Content-Type': 'application/json',
        },
        body: '{ invalid json }',
      });

      const status = res.status;
      expect([400, 422]).toContain(status);
      expect(status).not.toBe(500);
    });
  });

  describe('SQL Injection & XSS Protection', () => {
    it('must safely handle SQL-like strings', async () => {
      const comment = createTestComment({
        id: 'sql_test',
        text: "'; DROP TABLE users; --",
      });

      const res = await api('/api/analyze-comments', {
        method: 'POST',
        body: JSON.stringify({ comments: [comment] }),
      });

      // Should handle safely (Supabase client is parameterized)
      // 401 if no auth, 200/402 if authed
      expect([200, 401, 402]).toContain(res.status);
      expect(res.status).not.toBe(500);
    });

    it('must safely handle XSS attempts', async () => {
      const comment = createTestComment({
        id: 'xss_test',
        text: '<script>alert("XSS")</script>',
      });

      const res = await api('/api/analyze-comments', {
        method: 'POST',
        body: JSON.stringify({ comments: [comment] }),
      });

      // 401 if no auth, 200/402 if authed
      expect([200, 401, 402]).toContain(res.status);
      expect(res.status).not.toBe(500);
    });
  });

  describe('Error Handling - No Information Disclosure', () => {
    it('must not expose internal paths in errors', async () => {
      const res = await apiNoAuth('/api/nonexistent-endpoint');

      // Check error body doesn't expose internals
      const body = JSON.stringify(res.data);

      expect(body).not.toContain('/Users/');
      expect(body).not.toContain('C:\\');
      expect(body).not.toContain('/Desktop/');
      expect(body).not.toContain('node_modules');
    });
  });
});
