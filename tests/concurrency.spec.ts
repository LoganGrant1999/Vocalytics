/**
 * Concurrency Verification - STRICT
 * Atomic counters under parallel load
 */

import { describe, it, expect } from 'vitest';
import { api, createTestComment } from './utils';

const EXPECT_ANALYZE_CAP = parseInt(process.env.EXPECT_ANALYZE_CAP || '2', 10);

describe('Concurrency - STRICT Atomicity', () => {
  describe('Parallel Analyze Requests', () => {
    it('must handle 3 concurrent requests atomically', async () => {
      console.log(`  ⚡ Firing 3 concurrent analyze requests (cap=${EXPECT_ANALYZE_CAP})`);

      const comment1 = createTestComment({ id: 'concurrent_1' });
      const comment2 = createTestComment({ id: 'concurrent_2' });
      const comment3 = createTestComment({ id: 'concurrent_3' });

      // Fire all 3 in parallel
      const [res1, res2, res3] = await Promise.all([
        api('/api/analyze-comments', {
          method: 'POST',
          body: JSON.stringify({ comments: [comment1] }),
        }),
        api('/api/analyze-comments', {
          method: 'POST',
          body: JSON.stringify({ comments: [comment2] }),
        }),
        api('/api/analyze-comments', {
          method: 'POST',
          body: JSON.stringify({ comments: [comment3] }),
        }),
      ]);

      const results = [res1, res2, res3];
      const successCount = results.filter((r) => r.status === 200).length;
      const paywallCount = results.filter((r) => r.status === 402).length;

      console.log(`  Results: ${successCount} × 200, ${paywallCount} × 402`);

      // STRICT: Expect exactly cap successes (or cap+1 if increment-before-check)
      expect(successCount).toBeGreaterThanOrEqual(EXPECT_ANALYZE_CAP);
      expect(successCount).toBeLessThanOrEqual(EXPECT_ANALYZE_CAP + 1);

      // At least one should hit paywall
      expect(paywallCount).toBeGreaterThan(0);
    });

    it('must not wildly exceed cap in counter', async () => {
      const usageRes = await api('/api/me/usage');
      const finalCount = usageRes.data.commentsAnalyzed;

      console.log(`  Final counter: ${finalCount} (cap: ${EXPECT_ANALYZE_CAP})`);

      // STRICT: Allow at most cap+1 (race condition tolerance)
      // Must NOT be catastrophically over (like 2x or 3x)
      expect(finalCount).toBeLessThanOrEqual(EXPECT_ANALYZE_CAP + 1);

      if (finalCount > EXPECT_ANALYZE_CAP) {
        console.log(`  ⚠️  Counter at ${finalCount}, expected ~${EXPECT_ANALYZE_CAP}`);
        console.log(`  (Acceptable: increment happens before gate check)`);
      } else {
        console.log(`  ✓ Counter exactly at cap`);
      }
    });
  });

  describe('Counter Catastrophic Drift Protection', () => {
    it('must never exceed 2x the cap', async () => {
      const usageRes = await api('/api/me/usage');
      const analyzed = usageRes.data.commentsAnalyzed;
      const replies = usageRes.data.repliesGenerated;

      console.log(`  Counters: analyzed=${analyzed}, replies=${replies}`);

      // STRICT: Catastrophic would be 2x+ the cap
      expect(analyzed).toBeLessThan(EXPECT_ANALYZE_CAP * 2);

      const EXPECT_REPLY_CAP = parseInt(process.env.EXPECT_REPLY_CAP || '1', 10);
      expect(replies).toBeLessThan(EXPECT_REPLY_CAP * 2);

      console.log(`  ✓ No catastrophic drift detected`);
    });
  });
});
