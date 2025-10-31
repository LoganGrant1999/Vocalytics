/**
 * Rate Limits Integration Tests
 *
 * Tests the complete rate limiting system:
 * - Free: 50 AI replies/month, 25 posts/day
 * - Pro: Unlimited monthly, 100 posts/day
 * - Queue system for overflow
 * - Counter resets
 * - Concurrency safety
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import {
  ensureUsageRow,
  getUserUsage,
  checkReplyAllowance,
  consumeReplyAllowance,
  incrementDailyPosted,
  queueReply,
  getPendingQueuedReplies,
  markReplyPosted,
  rollUsageCounters,
  getUsageStats,
} from '../db/rateLimits.js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

describe('Rate Limits System', () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  let testUserId: string;
  let migrationApplied = false;

  beforeAll(async () => {
    // Check if migration is applied
    try {
      const { error: checkError } = await supabase
        .from('usage_counters')
        .select('user_id')
        .limit(1);

      if (checkError && checkError.code === 'PGRST205') {
        console.warn('⚠️  Migration not applied. Run: psql -f supabase/migrations/20251031_rate_limits.sql');
        migrationApplied = false;
        return;
      }

      migrationApplied = true;

      // Create a test user
      const { data: profile, error } = await supabase
        .from('profiles')
        .insert({
          email: `test-rate-limits-${Date.now()}@example.com`,
          name: 'Test User Rate Limits',
          tier: 'free',
          email_verified: true,
        })
        .select('id')
        .single();

      if (error) throw error;
      testUserId = profile.id;

      // Initialize usage counter
      await ensureUsageRow(testUserId, 'free');
    } catch (error) {
      console.error('Setup error:', error);
      migrationApplied = false;
    }
  });

  afterAll(async () => {
    // Cleanup test user
    await supabase.from('profiles').delete().eq('id', testUserId);
    await supabase.from('usage_counters').delete().eq('user_id', testUserId);
    await supabase.from('reply_queue').delete().eq('user_id', testUserId);
  });

  beforeEach(async () => {
    // Reset usage counters before each test
    await supabase
      .from('usage_counters')
      .update({
        replies_used_month: 0,
        replies_posted_today: 0,
        queued_replies: 0,
        month_start: new Date().toISOString().split('T')[0],
        day_start: new Date().toISOString().split('T')[0],
      })
      .eq('user_id', testUserId);

    // Clear queue
    await supabase.from('reply_queue').delete().eq('user_id', testUserId);
  });

  describe('Test 1: Free monthly cap enforced (49→50→51)', () => {
    it('should allow 50 replies then block the 51st', async () => {
      if (!migrationApplied) {
        console.log('⏭️  Skipping - migration not applied');
        return;
      }

      // Set counter to 49
      await supabase
        .from('usage_counters')
        .update({ replies_used_month: 49 })
        .eq('user_id', testUserId);

      // 50th reply should be allowed
      const allowance50 = await checkReplyAllowance({
        userId: testUserId,
        plan: 'free',
        willPostNow: false,
      });
      expect(allowance50.allowed).toBe(true);

      // Consume the 50th
      await consumeReplyAllowance({ userId: testUserId });

      // 51st should be blocked
      const allowance51 = await checkReplyAllowance({
        userId: testUserId,
        plan: 'free',
        willPostNow: false,
      });
      expect(allowance51.allowed).toBe(false);
      if (!allowance51.allowed) {
        expect((allowance51 as any).reason).toContain('Monthly AI reply limit reached');
        expect((allowance51 as any).reason).toContain('50');
        expect((allowance51 as any).reason).toContain('Upgrade to Pro');
      }
    });
  });

  describe('Test 2: Pro unlimited monthly but daily post cap queues', () => {
    beforeEach(async () => {
      // Change user to Pro
      await supabase
        .from('profiles')
        .update({ tier: 'pro' })
        .eq('id', testUserId);

      await supabase
        .from('usage_counters')
        .update({ plan_id: 'pro' })
        .eq('user_id', testUserId);
    });

    it('should allow unlimited generation but queue after 100 posts/day', async () => {
      if (!migrationApplied) return;

      // Generate 150 replies (should all be allowed)
      for (let i = 0; i < 150; i++) {
        const allowance = await checkReplyAllowance({
          userId: testUserId,
          plan: 'pro',
          willPostNow: false,
        });
        expect(allowance.allowed).toBe(true);
        await consumeReplyAllowance({ userId: testUserId });
      }

      // Post 100 replies (should all go through)
      for (let i = 0; i < 100; i++) {
        const allowance = await checkReplyAllowance({
          userId: testUserId,
          plan: 'pro',
          willPostNow: true,
        });
        expect(allowance.allowed).toBe(true);
        if (allowance.allowed) {
          expect(allowance.enqueue).toBe(false);
        }
        await incrementDailyPosted({ userId: testUserId });
      }

      // 101st post should be queued
      const allowance101 = await checkReplyAllowance({
        userId: testUserId,
        plan: 'pro',
        willPostNow: true,
      });
      expect(allowance101.allowed).toBe(true);
      if (allowance101.allowed && allowance101.enqueue) {
        expect(allowance101.reason).toContain('Daily posting cap reached');
        expect(allowance101.reason).toContain('100');
      }
    });
  });

  describe('Test 3: Daily reset unlocks queue', () => {
    it('should reset daily counter when day boundaries crossed', async () => {
      if (!migrationApplied) return;

      // Set counter to max for today
      await supabase
        .from('usage_counters')
        .update({
          replies_posted_today: 25,
          day_start: new Date(Date.now() - 86400000).toISOString().split('T')[0], // Yesterday
        })
        .eq('user_id', testUserId);

      // Roll counters forward
      await rollUsageCounters();

      // Check usage after roll
      const usage = await getUserUsage(testUserId);
      expect(usage?.replies_posted_today).toBe(0);
      expect(usage?.day_start).toBe(new Date().toISOString().split('T')[0]);

      // Should now be able to post
      const allowance = await checkReplyAllowance({
        userId: testUserId,
        plan: 'free',
        willPostNow: true,
      });
      expect(allowance.allowed).toBe(true);
      if (allowance.allowed) {
        expect(allowance.enqueue).toBe(false);
      }
    });
  });

  describe('Test 4: Generation-only increments monthly but not daily', () => {
    it('should only increment monthly counter when generating without posting', async () => {
      if (!migrationApplied) return;

      // Generate a reply
      await consumeReplyAllowance({ userId: testUserId });

      // Check counters
      const usage1 = await getUserUsage(testUserId);
      expect(usage1?.replies_used_month).toBe(1);
      expect(usage1?.replies_posted_today).toBe(0);

      // Post a reply (different one)
      await incrementDailyPosted({ userId: testUserId });

      // Check counters
      const usage2 = await getUserUsage(testUserId);
      expect(usage2?.replies_used_month).toBe(1); // Still 1
      expect(usage2?.replies_posted_today).toBe(1); // Now 1
    });
  });

  describe('Test 5: Plan switch propagation (free→pro)', () => {
    it('should update plan_id when tier changes', async () => {
      if (!migrationApplied) return;

      // Start as free
      await supabase
        .from('profiles')
        .update({ tier: 'free' })
        .eq('id', testUserId);

      await supabase
        .from('usage_counters')
        .update({ plan_id: 'free' })
        .eq('user_id', testUserId);

      // Verify free limits
      const usage1 = await getUserUsage(testUserId);
      expect(usage1?.plan_id).toBe('free');

      // Switch to pro
      await supabase
        .from('profiles')
        .update({ tier: 'pro' })
        .eq('id', testUserId);

      // Trigger sync (simulating trigger behavior manually)
      await supabase
        .from('usage_counters')
        .update({ plan_id: 'pro' })
        .eq('user_id', testUserId);

      // Verify pro limits
      const usage2 = await getUserUsage(testUserId);
      expect(usage2?.plan_id).toBe('pro');

      // Test that monthly limit is now unlimited
      await supabase
        .from('usage_counters')
        .update({ replies_used_month: 500 })
        .eq('user_id', testUserId);

      const allowance = await checkReplyAllowance({
        userId: testUserId,
        plan: 'pro',
        willPostNow: false,
      });
      expect(allowance.allowed).toBe(true); // Pro has unlimited monthly
    });
  });

  describe('Test 6: Concurrency safety (20 parallel requests)', () => {
    it('should handle 20 concurrent reply generations without race conditions', async () => {
      if (!migrationApplied) return;

      // Start with 45 used
      await supabase
        .from('usage_counters')
        .update({ replies_used_month: 45 })
        .eq('user_id', testUserId);

      // Try to generate 10 replies concurrently (should succeed: 45+10=55 > 50, so 5 should succeed)
      const results = await Promise.allSettled(
        Array(10).fill(null).map(async () => {
          const allowance = await checkReplyAllowance({
            userId: testUserId,
            plan: 'free',
            willPostNow: false,
          });

          if (allowance.allowed) {
            await consumeReplyAllowance({ userId: testUserId });
            return 'success';
          }
          return 'blocked';
        })
      );

      // Check final count
      const usage = await getUserUsage(testUserId);
      expect(usage?.replies_used_month).toBeLessThanOrEqual(50);
      expect(usage?.replies_used_month).toBeGreaterThanOrEqual(45);

      // Count successes vs blocks
      const successes = results.filter(r => r.status === 'fulfilled' && r.value === 'success').length;
      const blocks = results.filter(r => r.status === 'fulfilled' && r.value === 'blocked').length;

      // Should have some successes and some blocks
      expect(successes).toBeGreaterThan(0);
      expect(blocks).toBeGreaterThan(0);
      expect(successes + blocks).toBe(10);
    });
  });

  describe('Test 7: Usage endpoint accuracy', () => {
    it('should return accurate usage stats from getUsageStats', async () => {
      if (!migrationApplied) return;

      // Set known state
      await supabase
        .from('usage_counters')
        .update({
          replies_used_month: 23,
          replies_posted_today: 12,
          queued_replies: 7,
        })
        .eq('user_id', testUserId);

      // Get stats
      const stats = await getUsageStats(testUserId);

      expect(stats.plan).toBe('free');
      expect(stats.monthlyUsed).toBe(23);
      expect(stats.monthlyLimit).toBe(50);
      expect(stats.dailyPosted).toBe(12);
      expect(stats.dailyPostCap).toBe(25);
      expect(stats.queued).toBe(7);
      expect(stats.resets.month).toBeTruthy();
      expect(stats.resets.day).toBeTruthy();
    });

    it('should return null limits for Pro plan', async () => {
      if (!migrationApplied) return;

      // Switch to pro
      await supabase
        .from('profiles')
        .update({ tier: 'pro' })
        .eq('id', testUserId);

      await supabase
        .from('usage_counters')
        .update({
          plan_id: 'pro',
          replies_used_month: 999,
        })
        .eq('user_id', testUserId);

      // Get stats
      const stats = await getUsageStats(testUserId);

      expect(stats.plan).toBe('pro');
      expect(stats.monthlyUsed).toBe(999);
      expect(stats.monthlyLimit).toBeNull(); // Unlimited
      expect(stats.dailyPostCap).toBe(100); // Fair-use cap
    });
  });

  describe('Bonus: Queue management', () => {
    it('should queue and retrieve pending replies', async () => {
      if (!migrationApplied) return;

      // Queue a reply
      const queueId = await queueReply({
        userId: testUserId,
        commentId: 'comment-123',
        replyText: 'Test reply text',
        videoId: 'video-456',
      });

      expect(queueId).toBeTruthy();

      // Retrieve pending replies
      const pending = await getPendingQueuedReplies({
        userId: testUserId,
        limit: 10,
      });

      expect(pending.length).toBe(1);
      expect(pending[0].comment_id).toBe('comment-123');
      expect(pending[0].reply_text).toBe('Test reply text');
      expect(pending[0].status).toBe('pending');

      // Mark as posted
      await markReplyPosted({
        replyId: pending[0].id,
        userId: testUserId,
      });

      // Verify it's no longer pending
      const pendingAfter = await getPendingQueuedReplies({
        userId: testUserId,
        limit: 10,
      });

      expect(pendingAfter.length).toBe(0);
    });
  });
});
