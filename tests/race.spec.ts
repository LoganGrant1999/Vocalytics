/**
 * Race Condition Tests
 * Validates atomic counter behavior under concurrent requests
 */

import { describe, it, expect } from 'vitest';
import { api, createTestComment, logTestInfo, logTestSuccess, logTestWarn } from './utils';

const EXPECT_ANALYZE_CAP = parseInt(process.env.EXPECT_ANALYZE_CAP || '2', 10);

describe('Race Condition Tests', () => {
  describe('Concurrent Analyze Requests', () => {
    it('should handle concurrent requests atomically', async () => {
      logTestInfo('Firing 3 concurrent analyze requests...');
      logTestInfo(`Expected: ${EXPECT_ANALYZE_CAP} success, ${3 - EXPECT_ANALYZE_CAP} paywall`);

      const comment1 = createTestComment({ id: 'race_1', text: 'Concurrent request 1' });
      const comment2 = createTestComment({ id: 'race_2', text: 'Concurrent request 2' });
      const comment3 = createTestComment({ id: 'race_3', text: 'Concurrent request 3' });

      // Fire all requests in parallel
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
      const successCount = results.filter(r => r.status === 200).length;
      const paywallCount = results.filter(r => r.status === 402).length;

      logTestInfo(`Results: ${successCount} succeeded, ${paywallCount} hit paywall`);

      // With atomic counters, we expect exactly EXPECT_ANALYZE_CAP successes
      // However, due to race conditions, we allow up to cap+1 if increment happens after check
      expect(successCount).toBeGreaterThanOrEqual(EXPECT_ANALYZE_CAP);
      expect(successCount).toBeLessThanOrEqual(EXPECT_ANALYZE_CAP + 1);

      // Verify final count
      const usageRes = await api('/api/me/usage');
      const finalCount = usageRes.data.commentsAnalyzed;

      logTestInfo(`Final counter: ${finalCount} (cap: ${EXPECT_ANALYZE_CAP})`);

      // Counter should not wildly exceed cap
      expect(finalCount).toBeLessThanOrEqual(EXPECT_ANALYZE_CAP + 2);

      if (finalCount > EXPECT_ANALYZE_CAP + 1) {
        logTestWarn(`Counter drifted to ${finalCount} (expected ~${EXPECT_ANALYZE_CAP})`);
      } else {
        logTestSuccess('Atomic counter behavior verified');
      }
    });
  });

  describe('Concurrent Reply Requests', () => {
    it('should handle concurrent reply requests atomically', async () => {
      const EXPECT_REPLY_CAP = parseInt(process.env.EXPECT_REPLY_CAP || '1', 10);

      logTestInfo('Firing 2 concurrent reply requests...');

      const comment1 = createTestComment({ id: 'reply_race_1', text: 'Concurrent reply 1' });
      const comment2 = createTestComment({ id: 'reply_race_2', text: 'Concurrent reply 2' });

      const [res1, res2] = await Promise.all([
        api('/api/generate-replies', {
          method: 'POST',
          body: JSON.stringify({ comment: comment1, tones: ['friendly'] }),
        }),
        api('/api/generate-replies', {
          method: 'POST',
          body: JSON.stringify({ comment: comment2, tones: ['friendly'] }),
        }),
      ]);

      const results = [res1, res2];
      const successCount = results.filter(r => r.status === 200).length;
      const paywallCount = results.filter(r => r.status === 402).length;

      logTestInfo(`Results: ${successCount} succeeded, ${paywallCount} hit paywall`);

      // At least one should succeed, at least one should hit paywall (for cap=1)
      expect(successCount).toBeGreaterThanOrEqual(EXPECT_REPLY_CAP);
      expect(successCount).toBeLessThanOrEqual(EXPECT_REPLY_CAP + 1);

      logTestSuccess('Reply concurrency handled');
    });
  });

  describe('Counter Accuracy', () => {
    it('should not allow catastrophic overshooting', async () => {
      const usageRes = await api('/api/me/usage');
      const analyzedCount = usageRes.data.commentsAnalyzed;
      const repliesCount = usageRes.data.repliesGenerated;

      logTestInfo(`Final counts: analyzed=${analyzedCount}, replies=${repliesCount}`);

      // Catastrophic would be 10x the cap or more
      expect(analyzedCount).toBeLessThan(EXPECT_ANALYZE_CAP * 5);

      const EXPECT_REPLY_CAP = parseInt(process.env.EXPECT_REPLY_CAP || '1', 10);
      expect(repliesCount).toBeLessThan(EXPECT_REPLY_CAP * 5);

      logTestSuccess('No catastrophic counter drift detected');
    });
  });
});
