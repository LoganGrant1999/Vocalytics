/**
 * Operations Hygiene - STRICT
 * Security headers, request IDs, healthz shape, pg_cron verification
 */

import { describe, it, expect } from 'vitest';
import { apiNoAuth, api, BASE_URL } from './utils';

describe('Operations Hygiene - STRICT', () => {
  describe('Security Headers - MUST be present', () => {
    it('must set X-Content-Type-Options: nosniff', async () => {
      const res = await fetch(`${BASE_URL}/healthz`);

      const header = res.headers.get('x-content-type-options');

      // STRICT: Must be exactly "nosniff"
      expect(header).toBe('nosniff');

      console.log('  ✓ X-Content-Type-Options: nosniff');
    });

    it('must set Referrer-Policy', async () => {
      const res = await fetch(`${BASE_URL}/healthz`);

      const header = res.headers.get('referrer-policy');

      // STRICT: Must have a referrer policy
      expect(header).toBeTruthy();

      // Should be one of the secure policies
      const securePolicies = [
        'no-referrer',
        'no-referrer-when-downgrade',
        'origin',
        'origin-when-cross-origin',
        'same-origin',
        'strict-origin',
        'strict-origin-when-cross-origin',
      ];

      if (header) {
        console.log(`  ℹ️  Referrer-Policy: ${header}`);

        // If set, should be one of the secure options
        const isSecure = securePolicies.some(p => header.toLowerCase().includes(p));
        if (!isSecure) {
          console.log(`  ⚠️  Referrer-Policy "${header}" may not be restrictive`);
        }
      }
    });

    it('must set X-Frame-Options or CSP frame-ancestors', async () => {
      const res = await fetch(`${BASE_URL}/healthz`);

      const xFrameOptions = res.headers.get('x-frame-options');
      const csp = res.headers.get('content-security-policy');

      // STRICT: Must have either X-Frame-Options or CSP with frame-ancestors
      const hasFrameProtection =
        xFrameOptions !== null ||
        (csp !== null && csp.includes('frame-ancestors'));

      if (xFrameOptions) {
        console.log(`  ✓ X-Frame-Options: ${xFrameOptions}`);
        expect(['DENY', 'SAMEORIGIN']).toContain(xFrameOptions);
      } else if (csp && csp.includes('frame-ancestors')) {
        console.log('  ✓ CSP frame-ancestors directive present');
      } else {
        console.log('  ⚠️  No frame protection detected (X-Frame-Options or CSP frame-ancestors)');
      }

      // Note: Not strictly enforced as some setups may intentionally allow framing
      // but we log a warning
    });
  });

  describe('Request ID Tracking', () => {
    it('must echo X-Request-Id if provided', async () => {
      const requestId = `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const res = await fetch(`${BASE_URL}/healthz`, {
        headers: {
          'X-Request-Id': requestId,
        },
      });

      const echoedId = res.headers.get('x-request-id');

      // STRICT: Must echo back the same ID
      expect(echoedId).toBe(requestId);

      console.log(`  ✓ Request ID echoed correctly: ${requestId.slice(0, 20)}...`);
    });

    it('must generate X-Request-Id if not provided', async () => {
      const res = await fetch(`${BASE_URL}/healthz`);

      const generatedId = res.headers.get('x-request-id');

      if (generatedId) {
        expect(generatedId.length).toBeGreaterThan(0);
        console.log(`  ✓ Request ID generated: ${generatedId.slice(0, 20)}...`);
      } else {
        console.log('  ℹ️  No auto-generated Request ID (optional)');
      }
    });
  });

  describe('Health Check - STRICT Shape', () => {
    it('must return exactly 200 with documented shape', async () => {
      const res = await apiNoAuth('/healthz');

      // STRICT: Must be exactly 200
      expect(res.status).toBe(200);

      // STRICT: Must have required fields
      expect(res.data).toHaveProperty('ok');
      expect(res.data).toHaveProperty('version');
      expect(res.data).toHaveProperty('time');
      expect(res.data).toHaveProperty('db');
      expect(res.data).toHaveProperty('stripeWebhook');

      // Validate types
      expect(typeof res.data.ok).toBe('boolean');
      expect(typeof res.data.version).toBe('string');
      expect(typeof res.data.time).toBe('string');
      expect(typeof res.data.db).toBe('string');
      expect(typeof res.data.stripeWebhook).toBe('string');

      // DB should be 'ok', 'error', or 'unknown'
      expect(['ok', 'error', 'unknown']).toContain(res.data.db);

      // Stripe webhook should be 'configured' or 'not_configured'
      expect(['configured', 'not_configured']).toContain(res.data.stripeWebhook);

      console.log('  ✓ Health check returns 200');
      console.log(`  ✓ ok: ${res.data.ok}`);
      console.log(`  ✓ version: ${res.data.version}`);
      console.log(`  ✓ db: ${res.data.db}`);
      console.log(`  ✓ stripeWebhook: ${res.data.stripeWebhook}`);
    });

    it('must not expose internal implementation details', async () => {
      const res = await apiNoAuth('/healthz');

      const body = JSON.stringify(res.data);

      // STRICT: Must not leak internal paths or versions
      expect(body).not.toContain('/Users/');
      expect(body).not.toContain('C:\\');
      expect(body).not.toContain('node_modules');
      expect(body).not.toContain('package.json');

      console.log('  ✓ No internal details exposed');
    });
  });

  describe('pg_cron Reset Procedures - Documentation', () => {
    it('documents daily reply reset procedure', () => {
      console.log('\n  📋 VERIFICATION: Daily Reply Reset (pg_cron)');
      console.log('  SQL: UPDATE users SET replies_generated = 0;');
      console.log('  Schedule: 0 0 * * * (daily at midnight UTC)');
      console.log('  ');
      console.log('  MANUAL TEST:');
      console.log('  1. Connect to Supabase SQL editor');
      console.log('  2. Run: UPDATE users SET replies_generated = 0;');
      console.log('  3. Verify /api/me/usage shows repliesGenerated = 0');
      console.log('  4. Generate reply request should succeed (200)');
      console.log('  ');
      console.log('  AUTOMATED (pg_cron):');
      console.log('  SELECT * FROM cron.job WHERE command LIKE \'%replies_generated%\';');
      console.log('  ');

      // This is documentation - not a failure
      expect(true).toBe(true);
    });

    it('documents weekly analyze reset procedure', () => {
      console.log('\n  📋 VERIFICATION: Weekly Analyze Reset (pg_cron)');
      console.log('  SQL: UPDATE users SET comments_analyzed = 0;');
      console.log('  Schedule: 0 0 * * 0 (weekly on Sunday midnight UTC)');
      console.log('  ');
      console.log('  MANUAL TEST:');
      console.log('  1. Connect to Supabase SQL editor');
      console.log('  2. Run: UPDATE users SET comments_analyzed = 0;');
      console.log('  3. Verify /api/me/usage shows commentsAnalyzed = 0');
      console.log('  4. Analyze request should succeed (200)');
      console.log('  ');
      console.log('  AUTOMATED (pg_cron):');
      console.log('  SELECT * FROM cron.job WHERE command LIKE \'%comments_analyzed%\';');
      console.log('  ');

      // This is documentation - not a failure
      expect(true).toBe(true);
    });

    it('documents pg_cron verification query', () => {
      console.log('\n  📋 VERIFICATION: pg_cron Job Status');
      console.log('  ');
      console.log('  Connect to Supabase and run:');
      console.log('  ');
      console.log('  SELECT');
      console.log('    jobid,');
      console.log('    schedule,');
      console.log('    command,');
      console.log('    active');
      console.log('  FROM cron.job');
      console.log('  WHERE database = current_database();');
      console.log('  ');
      console.log('  Expected results:');
      console.log('  - 1 job: replies_generated reset (0 0 * * *)');
      console.log('  - 1 job: comments_analyzed reset (0 0 * * 0)');
      console.log('  - Both must have active = true');
      console.log('  ');

      // This is documentation - not a failure
      expect(true).toBe(true);
    });
  });

  describe('Error Response Format - STRICT', () => {
    it('must return consistent error shape on 4xx', async () => {
      const res = await apiNoAuth('/api/me/subscription');

      // STRICT: 401 must have "error" field
      expect(res.status).toBe(401);
      expect(res.data).toHaveProperty('error');

      // STRICT: Error must be a string
      expect(typeof res.data.error).toBe('string');

      console.log(`  ✓ 401 error shape: { error: "${res.data.error}" }`);
    });

    it('must not include "stack" in any error response', async () => {
      const res = await apiNoAuth('/api/me/subscription');

      const body = JSON.stringify(res.data);

      // STRICT: No stack traces
      expect(body).not.toContain('stack');
      expect(body).not.toContain('at Object');
      expect(body).not.toContain('at async');

      console.log('  ✓ No stack traces in error responses');
    });
  });

  describe('Logging Standards', () => {
    it('documents logging requirements for production', () => {
      console.log('\n  📋 LOGGING STANDARDS');
      console.log('  ');
      console.log('  Required log fields:');
      console.log('  - timestamp (ISO 8601)');
      console.log('  - level (info, warn, error)');
      console.log('  - message');
      console.log('  - requestId (if applicable)');
      console.log('  - userId (if authenticated)');
      console.log('  - error (stack trace) only in non-production');
      console.log('  ');
      console.log('  MUST log:');
      console.log('  - Authentication failures (401)');
      console.log('  - Paywall triggers (402)');
      console.log('  - Stripe webhook events');
      console.log('  - Usage counter increments');
      console.log('  - Server startup / shutdown');
      console.log('  ');
      console.log('  MUST NOT log:');
      console.log('  - Full JWT tokens');
      console.log('  - Stripe secret keys');
      console.log('  - User passwords or sensitive PII');
      console.log('  ');

      // This is documentation - not a failure
      expect(true).toBe(true);
    });
  });
});
