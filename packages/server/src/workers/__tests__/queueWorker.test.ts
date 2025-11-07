/**
 * Queue Worker Tests - Production Critical
 *
 * Tests the queue worker that processes pending replies and posts them to YouTube.
 * This worker runs every 5 minutes in production via cron job.
 *
 * Critical Scenarios:
 * - Empty queue handling
 * - Processing replies when users have capacity
 * - Respecting daily posting caps
 * - Handling YouTube token issues
 * - Retry logic for failures
 * - Multiple users in one run
 * - Counter increments
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted for proper mock function creation
const {
  mockRollUsageCounters,
  mockGetAllPendingReplies,
  mockGetUserUsage,
  mockGetPlanLimits,
  mockIncrementDailyPosted,
  mockMarkReplyPosted,
  mockMarkReplyFailed,
  mockPostCommentReply,
  mockSupabaseFrom,
} = vi.hoisted(() => ({
  mockRollUsageCounters: vi.fn(),
  mockGetAllPendingReplies: vi.fn(),
  mockGetUserUsage: vi.fn(),
  mockGetPlanLimits: vi.fn(),
  mockIncrementDailyPosted: vi.fn(),
  mockMarkReplyPosted: vi.fn(),
  mockMarkReplyFailed: vi.fn(),
  mockPostCommentReply: vi.fn(),
  mockSupabaseFrom: vi.fn(),
}));

// Mock rate limits database functions
vi.mock('../../db/rateLimits.js', () => ({
  rollUsageCounters: mockRollUsageCounters,
  getAllPendingReplies: mockGetAllPendingReplies,
  getUserUsage: mockGetUserUsage,
  getPlanLimits: mockGetPlanLimits,
  incrementDailyPosted: mockIncrementDailyPosted,
  markReplyPosted: mockMarkReplyPosted,
  markReplyFailed: mockMarkReplyFailed,
}));

// Mock Google library
vi.mock('../../lib/google.js', () => ({
  postCommentReply: mockPostCommentReply,
}));

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockSupabaseFrom,
  })),
}));

// Import after mocks
import { processQueue } from '../queueWorker.js';

describe('Queue Worker - Production Critical', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default successful mocks
    mockRollUsageCounters.mockResolvedValue(undefined);
    mockIncrementDailyPosted.mockResolvedValue(undefined);
    mockMarkReplyPosted.mockResolvedValue(undefined);
    mockMarkReplyFailed.mockResolvedValue(undefined);
    mockPostCommentReply.mockResolvedValue(undefined);

    // Default Supabase mock
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
  });

  describe('Empty Queue Scenarios', () => {
    it('should handle empty queue gracefully', async () => {
      mockGetAllPendingReplies.mockResolvedValue([]);

      await processQueue();

      expect(mockRollUsageCounters).toHaveBeenCalled();
      expect(mockGetAllPendingReplies).toHaveBeenCalledWith(100);
      expect(mockPostCommentReply).not.toHaveBeenCalled();
      expect(mockMarkReplyPosted).not.toHaveBeenCalled();
    });

    it('should not throw error when no replies exist', async () => {
      mockGetAllPendingReplies.mockResolvedValue([]);

      await expect(processQueue()).resolves.not.toThrow();
    });
  });

  describe('Successful Reply Processing', () => {
    it('should process pending reply and post to YouTube', async () => {
      const userId = 'user-123';
      const mockReply = {
        id: 'reply-1',
        user_id: userId,
        comment_id: 'comment-123',
        reply_text: 'Thanks for watching!',
        status: 'pending',
        attempts: 0,
        max_attempts: 3,
      };

      mockGetAllPendingReplies.mockResolvedValue([mockReply]);

      // Mock user profile with YouTube token
      const mockSingle = vi.fn().mockResolvedValue({
        data: {
          tier: 'pro',
          youtube_access_token: 'ya29.test_token',
        },
        error: null,
      });

      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: mockSingle,
      });

      // Mock usage: 50 posted today, cap is 100
      mockGetUserUsage.mockResolvedValue({
        user_id: userId,
        plan_id: 'pro',
        replies_used_month: 150,
        replies_posted_today: 50,
        queued_replies: 1,
        month_start: '2025-01-01',
        day_start: '2025-01-07',
        updated_at: '2025-01-07T12:00:00Z',
      });

      mockGetPlanLimits.mockResolvedValue({
        id: 'pro',
        monthly_ai_replies_limit: null, // Unlimited
        daily_post_cap: 100,
      });

      await processQueue();

      // Should post to YouTube
      expect(mockPostCommentReply).toHaveBeenCalledWith(
        'ya29.test_token',
        'comment-123',
        'Thanks for watching!'
      );

      // Should increment daily counter
      expect(mockIncrementDailyPosted).toHaveBeenCalledWith({ userId });

      // Should mark as posted
      expect(mockMarkReplyPosted).toHaveBeenCalledWith({
        replyId: 'reply-1',
        userId,
      });

      // Should not mark as failed
      expect(mockMarkReplyFailed).not.toHaveBeenCalled();
    });

    it('should process multiple replies for single user', async () => {
      const userId = 'user-123';
      const mockReplies = [
        {
          id: 'reply-1',
          user_id: userId,
          comment_id: 'comment-1',
          reply_text: 'Reply 1',
          status: 'pending',
        },
        {
          id: 'reply-2',
          user_id: userId,
          comment_id: 'comment-2',
          reply_text: 'Reply 2',
          status: 'pending',
        },
        {
          id: 'reply-3',
          user_id: userId,
          comment_id: 'comment-3',
          reply_text: 'Reply 3',
          status: 'pending',
        },
      ];

      mockGetAllPendingReplies.mockResolvedValue(mockReplies);

      // Mock user with capacity for all 3
      const mockSingle = vi.fn().mockResolvedValue({
        data: {
          tier: 'pro',
          youtube_access_token: 'ya29.test_token',
        },
        error: null,
      });

      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: mockSingle,
      });

      mockGetUserUsage.mockResolvedValue({
        user_id: userId,
        plan_id: 'pro',
        replies_posted_today: 0,
        queued_replies: 3,
      });

      mockGetPlanLimits.mockResolvedValue({
        id: 'pro',
        monthly_ai_replies_limit: null,
        daily_post_cap: 100,
      });

      await processQueue();

      // Should post all 3 replies
      expect(mockPostCommentReply).toHaveBeenCalledTimes(3);
      expect(mockIncrementDailyPosted).toHaveBeenCalledTimes(3);
      expect(mockMarkReplyPosted).toHaveBeenCalledTimes(3);
    });

    it('should process replies for multiple users', async () => {
      const mockReplies = [
        {
          id: 'reply-1',
          user_id: 'user-1',
          comment_id: 'comment-1',
          reply_text: 'Reply from user 1',
          status: 'pending',
        },
        {
          id: 'reply-2',
          user_id: 'user-2',
          comment_id: 'comment-2',
          reply_text: 'Reply from user 2',
          status: 'pending',
        },
      ];

      mockGetAllPendingReplies.mockResolvedValue(mockReplies);

      // Mock both users with tokens and capacity
      const mockSingle = vi.fn()
        .mockResolvedValueOnce({
          data: {
            tier: 'pro',
            youtube_access_token: 'ya29.token1',
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            tier: 'pro',
            youtube_access_token: 'ya29.token2',
          },
          error: null,
        });

      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: mockSingle,
      });

      mockGetUserUsage.mockResolvedValue({
        replies_posted_today: 0,
        queued_replies: 1,
      });

      mockGetPlanLimits.mockResolvedValue({
        id: 'pro',
        monthly_ai_replies_limit: null,
        daily_post_cap: 100,
      });

      await processQueue();

      // Should post for both users
      expect(mockPostCommentReply).toHaveBeenCalledTimes(2);
      expect(mockPostCommentReply).toHaveBeenCalledWith(
        'ya29.token1',
        'comment-1',
        'Reply from user 1'
      );
      expect(mockPostCommentReply).toHaveBeenCalledWith(
        'ya29.token2',
        'comment-2',
        'Reply from user 2'
      );
    });
  });

  describe('Daily Cap Enforcement', () => {
    it('should skip user who has reached daily cap', async () => {
      const userId = 'user-123';
      const mockReply = {
        id: 'reply-1',
        user_id: userId,
        comment_id: 'comment-123',
        reply_text: 'Test reply',
        status: 'pending',
      };

      mockGetAllPendingReplies.mockResolvedValue([mockReply]);

      // Mock user at daily cap (100/100 for Pro)
      const mockSingle = vi.fn().mockResolvedValue({
        data: {
          tier: 'pro',
          youtube_access_token: 'ya29.test_token',
        },
        error: null,
      });

      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: mockSingle,
      });

      mockGetUserUsage.mockResolvedValue({
        user_id: userId,
        plan_id: 'pro',
        replies_posted_today: 100, // At cap
        queued_replies: 1,
      });

      mockGetPlanLimits.mockResolvedValue({
        id: 'pro',
        monthly_ai_replies_limit: null,
        daily_post_cap: 100,
      });

      await processQueue();

      // Should NOT post
      expect(mockPostCommentReply).not.toHaveBeenCalled();
      expect(mockIncrementDailyPosted).not.toHaveBeenCalled();
      expect(mockMarkReplyPosted).not.toHaveBeenCalled();
      expect(mockMarkReplyFailed).not.toHaveBeenCalled();
    });

    it('should only post replies up to daily cap', async () => {
      const userId = 'user-123';
      const mockReplies = [
        { id: 'reply-1', user_id: userId, comment_id: 'c1', reply_text: 'R1', status: 'pending' },
        { id: 'reply-2', user_id: userId, comment_id: 'c2', reply_text: 'R2', status: 'pending' },
        { id: 'reply-3', user_id: userId, comment_id: 'c3', reply_text: 'R3', status: 'pending' },
        { id: 'reply-4', user_id: userId, comment_id: 'c4', reply_text: 'R4', status: 'pending' },
        { id: 'reply-5', user_id: userId, comment_id: 'c5', reply_text: 'R5', status: 'pending' },
      ];

      mockGetAllPendingReplies.mockResolvedValue(mockReplies);

      // User has room for 2 more posts today (98/100)
      const mockSingle = vi.fn().mockResolvedValue({
        data: {
          tier: 'pro',
          youtube_access_token: 'ya29.test_token',
        },
        error: null,
      });

      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: mockSingle,
      });

      mockGetUserUsage.mockResolvedValue({
        user_id: userId,
        plan_id: 'pro',
        replies_posted_today: 98, // 2 remaining
        queued_replies: 5,
      });

      mockGetPlanLimits.mockResolvedValue({
        id: 'pro',
        monthly_ai_replies_limit: null,
        daily_post_cap: 100,
      });

      await processQueue();

      // Should only post 2 replies (oldest first)
      expect(mockPostCommentReply).toHaveBeenCalledTimes(2);
      expect(mockPostCommentReply).toHaveBeenCalledWith('ya29.test_token', 'c1', 'R1');
      expect(mockPostCommentReply).toHaveBeenCalledWith('ya29.test_token', 'c2', 'R2');
      expect(mockMarkReplyPosted).toHaveBeenCalledTimes(2);
    });

    it('should handle Free tier daily cap (25/day)', async () => {
      const userId = 'user-free';
      const mockReplies = [
        { id: 'reply-1', user_id: userId, comment_id: 'c1', reply_text: 'R1', status: 'pending' },
        { id: 'reply-2', user_id: userId, comment_id: 'c2', reply_text: 'R2', status: 'pending' },
      ];

      mockGetAllPendingReplies.mockResolvedValue(mockReplies);

      // Free user at 24/25
      const mockSingle = vi.fn().mockResolvedValue({
        data: {
          tier: 'free',
          youtube_access_token: 'ya29.test_token',
        },
        error: null,
      });

      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: mockSingle,
      });

      mockGetUserUsage.mockResolvedValue({
        user_id: userId,
        plan_id: 'free',
        replies_posted_today: 24, // 1 remaining
        queued_replies: 2,
      });

      mockGetPlanLimits.mockResolvedValue({
        id: 'free',
        monthly_ai_replies_limit: 50,
        daily_post_cap: 25,
      });

      await processQueue();

      // Should only post 1 reply
      expect(mockPostCommentReply).toHaveBeenCalledTimes(1);
      expect(mockPostCommentReply).toHaveBeenCalledWith('ya29.test_token', 'c1', 'R1');
    });
  });

  describe('YouTube Token Issues', () => {
    it('should mark all replies as failed when user has no YouTube token', async () => {
      const userId = 'user-123';
      const mockReplies = [
        { id: 'reply-1', user_id: userId, comment_id: 'c1', reply_text: 'R1', status: 'pending' },
        { id: 'reply-2', user_id: userId, comment_id: 'c2', reply_text: 'R2', status: 'pending' },
      ];

      mockGetAllPendingReplies.mockResolvedValue(mockReplies);

      // Mock user WITHOUT YouTube token
      const mockSingle = vi.fn().mockResolvedValue({
        data: {
          tier: 'pro',
          youtube_access_token: null, // No token!
        },
        error: null,
      });

      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: mockSingle,
      });

      mockGetUserUsage.mockResolvedValue({
        user_id: userId,
        plan_id: 'pro',
        replies_posted_today: 0,
        queued_replies: 2,
      });

      mockGetPlanLimits.mockResolvedValue({
        id: 'pro',
        monthly_ai_replies_limit: null,
        daily_post_cap: 100,
      });

      await processQueue();

      // Should NOT post
      expect(mockPostCommentReply).not.toHaveBeenCalled();

      // Should mark both as failed
      expect(mockMarkReplyFailed).toHaveBeenCalledTimes(2);
      expect(mockMarkReplyFailed).toHaveBeenCalledWith({
        replyId: 'reply-1',
        userId,
        errorMessage: 'YouTube account disconnected',
      });
      expect(mockMarkReplyFailed).toHaveBeenCalledWith({
        replyId: 'reply-2',
        userId,
        errorMessage: 'YouTube account disconnected',
      });
    });
  });

  describe('Failure Handling & Retries', () => {
    it('should mark reply as failed when YouTube API fails', async () => {
      const userId = 'user-123';
      const mockReply = {
        id: 'reply-1',
        user_id: userId,
        comment_id: 'comment-123',
        reply_text: 'Test reply',
        status: 'pending',
      };

      mockGetAllPendingReplies.mockResolvedValue([mockReply]);

      // Mock user with token
      const mockSingle = vi.fn().mockResolvedValue({
        data: {
          tier: 'pro',
          youtube_access_token: 'ya29.test_token',
        },
        error: null,
      });

      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: mockSingle,
      });

      mockGetUserUsage.mockResolvedValue({
        user_id: userId,
        plan_id: 'pro',
        replies_posted_today: 0,
        queued_replies: 1,
      });

      mockGetPlanLimits.mockResolvedValue({
        id: 'pro',
        monthly_ai_replies_limit: null,
        daily_post_cap: 100,
      });

      // Mock YouTube API failure
      mockPostCommentReply.mockRejectedValue(new Error('YouTube API quota exceeded'));

      await processQueue();

      // Should attempt to post
      expect(mockPostCommentReply).toHaveBeenCalled();

      // Should NOT mark as posted
      expect(mockMarkReplyPosted).not.toHaveBeenCalled();

      // Should mark as failed with error message
      expect(mockMarkReplyFailed).toHaveBeenCalledWith({
        replyId: 'reply-1',
        userId,
        errorMessage: 'YouTube API quota exceeded',
      });

      // Should NOT increment daily counter (failed post)
      expect(mockIncrementDailyPosted).not.toHaveBeenCalled();
    });

    it('should continue processing other replies if one fails', async () => {
      const userId = 'user-123';
      const mockReplies = [
        { id: 'reply-1', user_id: userId, comment_id: 'c1', reply_text: 'R1', status: 'pending' },
        { id: 'reply-2', user_id: userId, comment_id: 'c2', reply_text: 'R2', status: 'pending' },
        { id: 'reply-3', user_id: userId, comment_id: 'c3', reply_text: 'R3', status: 'pending' },
      ];

      mockGetAllPendingReplies.mockResolvedValue(mockReplies);

      const mockSingle = vi.fn().mockResolvedValue({
        data: {
          tier: 'pro',
          youtube_access_token: 'ya29.test_token',
        },
        error: null,
      });

      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: mockSingle,
      });

      mockGetUserUsage.mockResolvedValue({
        user_id: userId,
        plan_id: 'pro',
        replies_posted_today: 0,
        queued_replies: 3,
      });

      mockGetPlanLimits.mockResolvedValue({
        id: 'pro',
        monthly_ai_replies_limit: null,
        daily_post_cap: 100,
      });

      // Second post fails, others succeed
      mockPostCommentReply
        .mockResolvedValueOnce(undefined) // Reply 1 succeeds
        .mockRejectedValueOnce(new Error('Network error')) // Reply 2 fails
        .mockResolvedValueOnce(undefined); // Reply 3 succeeds

      await processQueue();

      // Should attempt all 3
      expect(mockPostCommentReply).toHaveBeenCalledTimes(3);

      // Should mark 2 as posted (1 and 3)
      expect(mockMarkReplyPosted).toHaveBeenCalledTimes(2);
      expect(mockMarkReplyPosted).toHaveBeenCalledWith({ replyId: 'reply-1', userId });
      expect(mockMarkReplyPosted).toHaveBeenCalledWith({ replyId: 'reply-3', userId });

      // Should mark 1 as failed (2)
      expect(mockMarkReplyFailed).toHaveBeenCalledTimes(1);
      expect(mockMarkReplyFailed).toHaveBeenCalledWith({
        replyId: 'reply-2',
        userId,
        errorMessage: 'Network error',
      });
    });
  });

  describe('Edge Cases & Error Handling', () => {
    it('should handle missing usage counter gracefully', async () => {
      const userId = 'user-123';
      const mockReply = {
        id: 'reply-1',
        user_id: userId,
        comment_id: 'comment-123',
        reply_text: 'Test reply',
        status: 'pending',
      };

      mockGetAllPendingReplies.mockResolvedValue([mockReply]);

      const mockSingle = vi.fn().mockResolvedValue({
        data: {
          tier: 'pro',
          youtube_access_token: 'ya29.test_token',
        },
        error: null,
      });

      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: mockSingle,
      });

      // Usage counter not found
      mockGetUserUsage.mockResolvedValue(null);

      await processQueue();

      // Should NOT post (error getting status)
      expect(mockPostCommentReply).not.toHaveBeenCalled();
      expect(mockMarkReplyPosted).not.toHaveBeenCalled();
      // Worker should continue (catch error internally)
    });

    it('should respect 100-reply limit per run', async () => {
      const userId = 'user-123';
      // Create 150 pending replies
      const mockReplies = Array.from({ length: 150 }, (_, i) => ({
        id: `reply-${i}`,
        user_id: userId,
        comment_id: `comment-${i}`,
        reply_text: `Reply ${i}`,
        status: 'pending',
      }));

      // Worker fetches max 100
      mockGetAllPendingReplies.mockResolvedValue(mockReplies.slice(0, 100));

      const mockSingle = vi.fn().mockResolvedValue({
        data: {
          tier: 'pro',
          youtube_access_token: 'ya29.test_token',
        },
        error: null,
      });

      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: mockSingle,
      });

      mockGetUserUsage.mockResolvedValue({
        user_id: userId,
        plan_id: 'pro',
        replies_posted_today: 0,
        queued_replies: 150,
      });

      mockGetPlanLimits.mockResolvedValue({
        id: 'pro',
        monthly_ai_replies_limit: null,
        daily_post_cap: 100,
      });

      await processQueue();

      // Should request exactly 100 replies
      expect(mockGetAllPendingReplies).toHaveBeenCalledWith(100);

      // Should post all 100 (user has capacity)
      expect(mockPostCommentReply).toHaveBeenCalledTimes(100);
    });

    it('should handle counter roll forward', async () => {
      mockGetAllPendingReplies.mockResolvedValue([]);

      await processQueue();

      // Should call roll counters at start
      expect(mockRollUsageCounters).toHaveBeenCalled();
      expect(mockGetAllPendingReplies).toHaveBeenCalled();

      // Verify rollUsageCounters was called first (called once each)
      expect(mockRollUsageCounters).toHaveBeenCalledTimes(1);
      expect(mockGetAllPendingReplies).toHaveBeenCalledTimes(1);
    });

    it('should not crash on fatal errors', async () => {
      // Simulate database error
      mockRollUsageCounters.mockRejectedValue(new Error('Database connection failed'));

      // Should not throw, just log error
      await expect(processQueue()).resolves.not.toThrow();
    });
  });

  describe('Counter Management', () => {
    it('should increment daily counter for each successful post', async () => {
      const userId = 'user-123';
      const mockReplies = [
        { id: 'reply-1', user_id: userId, comment_id: 'c1', reply_text: 'R1', status: 'pending' },
        { id: 'reply-2', user_id: userId, comment_id: 'c2', reply_text: 'R2', status: 'pending' },
      ];

      mockGetAllPendingReplies.mockResolvedValue(mockReplies);

      const mockSingle = vi.fn().mockResolvedValue({
        data: {
          tier: 'pro',
          youtube_access_token: 'ya29.test_token',
        },
        error: null,
      });

      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: mockSingle,
      });

      mockGetUserUsage.mockResolvedValue({
        user_id: userId,
        plan_id: 'pro',
        replies_posted_today: 0,
        queued_replies: 2,
      });

      mockGetPlanLimits.mockResolvedValue({
        id: 'pro',
        monthly_ai_replies_limit: null,
        daily_post_cap: 100,
      });

      await processQueue();

      // Should increment counter for each post
      expect(mockIncrementDailyPosted).toHaveBeenCalledTimes(2);
      expect(mockIncrementDailyPosted).toHaveBeenCalledWith({ userId });
    });

    it('should not increment counter on failed posts', async () => {
      const userId = 'user-123';
      const mockReply = {
        id: 'reply-1',
        user_id: userId,
        comment_id: 'comment-123',
        reply_text: 'Test reply',
        status: 'pending',
      };

      mockGetAllPendingReplies.mockResolvedValue([mockReply]);

      const mockSingle = vi.fn().mockResolvedValue({
        data: {
          tier: 'pro',
          youtube_access_token: 'ya29.test_token',
        },
        error: null,
      });

      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: mockSingle,
      });

      mockGetUserUsage.mockResolvedValue({
        user_id: userId,
        plan_id: 'pro',
        replies_posted_today: 0,
        queued_replies: 1,
      });

      mockGetPlanLimits.mockResolvedValue({
        id: 'pro',
        monthly_ai_replies_limit: null,
        daily_post_cap: 100,
      });

      // Fail the post
      mockPostCommentReply.mockRejectedValue(new Error('API error'));

      await processQueue();

      // Should NOT increment counter
      expect(mockIncrementDailyPosted).not.toHaveBeenCalled();
    });
  });
});
