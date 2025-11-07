/**
 * Fetch Comments Route Tests - Production Critical
 *
 * Tests the /fetch-comments endpoint that fetches YouTube comments
 * either by videoId or channelId with pagination support.
 *
 * Coverage:
 * - Schema validation (videoId/channelId requirement, max limits, order enum)
 * - Success cases (fetch by video, channel, with pagination, replies, ordering)
 * - Error handling (missing identifiers, API errors)
 * - Edge cases (boundary conditions, both IDs provided)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fakeVerifyToken } from './testAuth.js';

// Use vi.hoisted for proper mock function creation
const { mockFetchComments } = vi.hoisted(() => ({
  mockFetchComments: vi.fn(),
}));

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

// Mock tools
vi.mock('../../tools.js', () => ({
  fetchComments: mockFetchComments,
}));

// Import after mocks
import { createHttpServer } from '../index.js';

describe('Fetch Comments Route - Production Critical', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: Return successful fetch with 10 comments
    mockFetchComments.mockResolvedValue({
      comments: Array.from({ length: 10 }, (_, i) => ({
        id: `comment-${i + 1}`,
        videoId: 'test-video-id',
        author: `User ${i + 1}`,
        text: `Great video! Comment ${i + 1}`,
        likeCount: i * 5,
        publishedAt: new Date(Date.now() - i * 3600000).toISOString(),
        replyCount: 0,
        isReply: false,
      })),
      nextPageToken: undefined,
    });
  });

  describe('Schema Validation', () => {
    it('should reject request without videoId or channelId', async () => {
      const app = await createHttpServer();

      const response = await app.inject({
        method: 'POST',
        url: '/api/fetch-comments',
        payload: {
          max: 10,
        },
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.body);
      expect(data.code).toBe('BAD_REQUEST');
      expect(data.message).toContain('Provide videoId or channelId');
      expect(mockFetchComments).not.toHaveBeenCalled();
    });

    it('should accept request with videoId only', async () => {
      const app = await createHttpServer();

      const response = await app.inject({
        method: 'POST',
        url: '/api/fetch-comments',
        payload: {
          videoId: 'test-video-id',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockFetchComments).toHaveBeenCalledWith(
        'test-video-id',
        undefined,
        50,
        undefined,
        false,
        'time'
      );
    });

    it('should accept request with channelId only', async () => {
      const app = await createHttpServer();

      const response = await app.inject({
        method: 'POST',
        url: '/api/fetch-comments',
        payload: {
          channelId: 'test-channel-id',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockFetchComments).toHaveBeenCalledWith(
        undefined,
        'test-channel-id',
        50,
        undefined,
        false,
        'time'
      );
    });

    it('should accept both videoId and channelId', async () => {
      const app = await createHttpServer();

      const response = await app.inject({
        method: 'POST',
        url: '/api/fetch-comments',
        payload: {
          videoId: 'test-video-id',
          channelId: 'test-channel-id',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockFetchComments).toHaveBeenCalledWith(
        'test-video-id',
        'test-channel-id',
        50,
        undefined,
        false,
        'time'
      );
    });

    it('should reject empty videoId', async () => {
      const app = await createHttpServer();

      const response = await app.inject({
        method: 'POST',
        url: '/api/fetch-comments',
        payload: {
          videoId: '',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject empty channelId', async () => {
      const app = await createHttpServer();

      const response = await app.inject({
        method: 'POST',
        url: '/api/fetch-comments',
        payload: {
          channelId: '',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject max value less than 1', async () => {
      const app = await createHttpServer();

      const response = await app.inject({
        method: 'POST',
        url: '/api/fetch-comments',
        payload: {
          videoId: 'test-video-id',
          max: 0,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject max value greater than 50', async () => {
      const app = await createHttpServer();

      const response = await app.inject({
        method: 'POST',
        url: '/api/fetch-comments',
        payload: {
          videoId: 'test-video-id',
          max: 51,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should accept valid order values (time, relevance)', async () => {
      const app = await createHttpServer();

      const responseTime = await app.inject({
        method: 'POST',
        url: '/api/fetch-comments',
        payload: {
          videoId: 'test-video-id',
          order: 'time',
        },
      });

      expect(responseTime.statusCode).toBe(200);

      const responseRelevance = await app.inject({
        method: 'POST',
        url: '/api/fetch-comments',
        payload: {
          videoId: 'test-video-id',
          order: 'relevance',
        },
      });

      expect(responseRelevance.statusCode).toBe(200);
    });

    it('should reject invalid order value', async () => {
      const app = await createHttpServer();

      const response = await app.inject({
        method: 'POST',
        url: '/api/fetch-comments',
        payload: {
          videoId: 'test-video-id',
          order: 'invalid',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject additional properties', async () => {
      const app = await createHttpServer();

      const response = await app.inject({
        method: 'POST',
        url: '/api/fetch-comments',
        payload: {
          videoId: 'test-video-id',
          extraField: 'not-allowed',
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('Success Cases', () => {
    it('should fetch comments by videoId with default parameters', async () => {
      const app = await createHttpServer();

      const response = await app.inject({
        method: 'POST',
        url: '/api/fetch-comments',
        payload: {
          videoId: 'test-video-id',
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.comments).toHaveLength(10);
      expect(data.comments[0]).toHaveProperty('id');
      expect(data.comments[0]).toHaveProperty('text');
      expect(data.comments[0]).toHaveProperty('author');
      expect(mockFetchComments).toHaveBeenCalledWith(
        'test-video-id',
        undefined,
        50, // default max
        undefined,
        false, // default includeReplies
        'time' // default order
      );
    });

    it('should fetch comments by channelId', async () => {
      const app = await createHttpServer();

      mockFetchComments.mockResolvedValue({
        comments: [
          {
            id: 'channel-comment-1',
            videoId: 'some-video',
            author: 'Channel Commenter',
            text: 'Comment on channel video',
            likeCount: 10,
            publishedAt: new Date().toISOString(),
            replyCount: 0,
            isReply: false,
          },
        ],
        nextPageToken: undefined,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/fetch-comments',
        payload: {
          channelId: 'test-channel-id',
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.comments).toHaveLength(1);
      expect(data.comments[0].id).toBe('channel-comment-1');
      expect(mockFetchComments).toHaveBeenCalledWith(
        undefined,
        'test-channel-id',
        50,
        undefined,
        false,
        'time'
      );
    });

    it('should fetch comments with custom max value', async () => {
      const app = await createHttpServer();

      const response = await app.inject({
        method: 'POST',
        url: '/api/fetch-comments',
        payload: {
          videoId: 'test-video-id',
          max: 25,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockFetchComments).toHaveBeenCalledWith(
        'test-video-id',
        undefined,
        25,
        undefined,
        false,
        'time'
      );
    });

    it('should fetch comments with pagination token', async () => {
      const app = await createHttpServer();

      mockFetchComments.mockResolvedValue({
        comments: [
          {
            id: 'page2-comment-1',
            videoId: 'test-video-id',
            author: 'User',
            text: 'Second page comment',
            likeCount: 5,
            publishedAt: new Date().toISOString(),
            replyCount: 0,
            isReply: false,
          },
        ],
        nextPageToken: 'page3-token',
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/fetch-comments',
        payload: {
          videoId: 'test-video-id',
          pageToken: 'page2-token',
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.comments).toHaveLength(1);
      expect(data.nextPageToken).toBe('page3-token');
      expect(mockFetchComments).toHaveBeenCalledWith(
        'test-video-id',
        undefined,
        50,
        'page2-token',
        false,
        'time'
      );
    });

    it('should fetch comments with replies included', async () => {
      const app = await createHttpServer();

      mockFetchComments.mockResolvedValue({
        comments: [
          {
            id: 'top-comment-1',
            videoId: 'test-video-id',
            author: 'Main User',
            text: 'Top level comment',
            likeCount: 20,
            publishedAt: new Date().toISOString(),
            replyCount: 1,
            isReply: false,
          },
          {
            id: 'reply-1',
            videoId: 'test-video-id',
            author: 'Replier',
            text: 'Reply to top comment',
            likeCount: 5,
            publishedAt: new Date().toISOString(),
            replyCount: 0,
            isReply: true,
            parentId: 'top-comment-1',
          },
        ],
        nextPageToken: undefined,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/fetch-comments',
        payload: {
          videoId: 'test-video-id',
          includeReplies: true,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.comments).toHaveLength(2);
      expect(data.comments[0].isReply).toBe(false);
      expect(data.comments[1].isReply).toBe(true);
      expect(data.comments[1].parentId).toBe('top-comment-1');
      expect(mockFetchComments).toHaveBeenCalledWith(
        'test-video-id',
        undefined,
        50,
        undefined,
        true,
        'time'
      );
    });

    it('should fetch comments ordered by relevance', async () => {
      const app = await createHttpServer();

      const response = await app.inject({
        method: 'POST',
        url: '/api/fetch-comments',
        payload: {
          videoId: 'test-video-id',
          order: 'relevance',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockFetchComments).toHaveBeenCalledWith(
        'test-video-id',
        undefined,
        50,
        undefined,
        false,
        'relevance'
      );
    });

    it('should return empty comments array when no comments available', async () => {
      const app = await createHttpServer();

      mockFetchComments.mockResolvedValue({
        comments: [],
        nextPageToken: undefined,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/fetch-comments',
        payload: {
          videoId: 'empty-video-id',
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.comments).toEqual([]);
      expect(data.nextPageToken).toBeUndefined();
    });

    it('should return nextPageToken when more pages available', async () => {
      const app = await createHttpServer();

      mockFetchComments.mockResolvedValue({
        comments: Array.from({ length: 50 }, (_, i) => ({
          id: `comment-${i + 1}`,
          videoId: 'test-video-id',
          author: `User ${i + 1}`,
          text: `Comment ${i + 1}`,
          likeCount: i,
          publishedAt: new Date(Date.now() - i * 3600000).toISOString(),
          replyCount: 0,
          isReply: false,
        })),
        nextPageToken: 'next-page-token',
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/fetch-comments',
        payload: {
          videoId: 'test-video-id',
          max: 50,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.comments).toHaveLength(50);
      expect(data.nextPageToken).toBe('next-page-token');
    });
  });

  describe('Error Cases', () => {
    it('should return 500 when fetchComments throws error', async () => {
      const app = await createHttpServer();

      mockFetchComments.mockRejectedValue(new Error('YouTube API quota exceeded'));

      const response = await app.inject({
        method: 'POST',
        url: '/api/fetch-comments',
        payload: {
          videoId: 'test-video-id',
        },
      });

      expect(response.statusCode).toBe(500);
      const data = JSON.parse(response.body);
      expect(data.error).toBe('Internal Server Error');
      expect(data.message).toContain('YouTube API quota exceeded');
    });

    it('should handle network timeout errors', async () => {
      const app = await createHttpServer();

      mockFetchComments.mockRejectedValue(new Error('Network timeout'));

      const response = await app.inject({
        method: 'POST',
        url: '/api/fetch-comments',
        payload: {
          videoId: 'test-video-id',
        },
      });

      expect(response.statusCode).toBe(500);
      const data = JSON.parse(response.body);
      expect(data.message).toContain('Network timeout');
    });

    it('should handle YouTube API errors gracefully', async () => {
      const app = await createHttpServer();

      mockFetchComments.mockRejectedValue(
        new Error('YouTube API error 403: The request cannot be completed because you have exceeded your quota.')
      );

      const response = await app.inject({
        method: 'POST',
        url: '/api/fetch-comments',
        payload: {
          videoId: 'test-video-id',
        },
      });

      expect(response.statusCode).toBe(500);
      const data = JSON.parse(response.body);
      expect(data.message).toContain('quota');
    });
  });

  describe('Edge Cases', () => {
    it('should accept max = 1 (minimum allowed)', async () => {
      const app = await createHttpServer();

      mockFetchComments.mockResolvedValue({
        comments: [
          {
            id: 'single-comment',
            videoId: 'test-video-id',
            author: 'User',
            text: 'Only comment',
            likeCount: 1,
            publishedAt: new Date().toISOString(),
            replyCount: 0,
            isReply: false,
          },
        ],
        nextPageToken: 'next-token',
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/fetch-comments',
        payload: {
          videoId: 'test-video-id',
          max: 1,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.comments).toHaveLength(1);
      expect(mockFetchComments).toHaveBeenCalledWith(
        'test-video-id',
        undefined,
        1,
        undefined,
        false,
        'time'
      );
    });

    it('should accept max = 50 (maximum allowed)', async () => {
      const app = await createHttpServer();

      const response = await app.inject({
        method: 'POST',
        url: '/api/fetch-comments',
        payload: {
          videoId: 'test-video-id',
          max: 50,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockFetchComments).toHaveBeenCalledWith(
        'test-video-id',
        undefined,
        50,
        undefined,
        false,
        'time'
      );
    });

    it('should handle all optional parameters together', async () => {
      const app = await createHttpServer();

      const response = await app.inject({
        method: 'POST',
        url: '/api/fetch-comments',
        payload: {
          videoId: 'test-video-id',
          max: 25,
          pageToken: 'page2',
          includeReplies: true,
          order: 'relevance',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockFetchComments).toHaveBeenCalledWith(
        'test-video-id',
        undefined,
        25,
        'page2',
        true,
        'relevance'
      );
    });

    it('should handle special characters in videoId', async () => {
      const app = await createHttpServer();

      const specialVideoId = 'dQw4w9WgXcQ';

      const response = await app.inject({
        method: 'POST',
        url: '/api/fetch-comments',
        payload: {
          videoId: specialVideoId,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockFetchComments).toHaveBeenCalledWith(
        specialVideoId,
        undefined,
        50,
        undefined,
        false,
        'time'
      );
    });

    it('should handle special characters in channelId', async () => {
      const app = await createHttpServer();

      const specialChannelId = 'UCuAXFkgsw1L7xaCfnd5JJOw';

      const response = await app.inject({
        method: 'POST',
        url: '/api/fetch-comments',
        payload: {
          channelId: specialChannelId,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockFetchComments).toHaveBeenCalledWith(
        undefined,
        specialChannelId,
        50,
        undefined,
        false,
        'time'
      );
    });
  });

  describe('Integration Scenarios', () => {
    it('should support full pagination flow', async () => {
      const app = await createHttpServer();

      // First page
      mockFetchComments.mockResolvedValueOnce({
        comments: Array.from({ length: 10 }, (_, i) => ({
          id: `page1-comment-${i + 1}`,
          videoId: 'test-video-id',
          author: `User ${i + 1}`,
          text: `Page 1 comment ${i + 1}`,
          likeCount: i * 2,
          publishedAt: new Date(Date.now() - i * 3600000).toISOString(),
          replyCount: 0,
          isReply: false,
        })),
        nextPageToken: 'page2-token',
      });

      const response1 = await app.inject({
        method: 'POST',
        url: '/api/fetch-comments',
        payload: {
          videoId: 'test-video-id',
          max: 10,
        },
      });

      expect(response1.statusCode).toBe(200);
      const data1 = JSON.parse(response1.body);
      expect(data1.comments).toHaveLength(10);
      expect(data1.nextPageToken).toBe('page2-token');

      // Second page
      mockFetchComments.mockResolvedValueOnce({
        comments: Array.from({ length: 10 }, (_, i) => ({
          id: `page2-comment-${i + 1}`,
          videoId: 'test-video-id',
          author: `User ${i + 11}`,
          text: `Page 2 comment ${i + 1}`,
          likeCount: i,
          publishedAt: new Date(Date.now() - (i + 10) * 3600000).toISOString(),
          replyCount: 0,
          isReply: false,
        })),
        nextPageToken: undefined,
      });

      const response2 = await app.inject({
        method: 'POST',
        url: '/api/fetch-comments',
        payload: {
          videoId: 'test-video-id',
          max: 10,
          pageToken: 'page2-token',
        },
      });

      expect(response2.statusCode).toBe(200);
      const data2 = JSON.parse(response2.body);
      expect(data2.comments).toHaveLength(10);
      expect(data2.nextPageToken).toBeUndefined();
    });

    it('should handle comments with and without replies correctly', async () => {
      const app = await createHttpServer();

      mockFetchComments.mockResolvedValue({
        comments: [
          {
            id: 'comment-no-replies',
            videoId: 'test-video-id',
            author: 'User1',
            text: 'Comment without replies',
            likeCount: 10,
            publishedAt: new Date().toISOString(),
            replyCount: 0,
            isReply: false,
          },
          {
            id: 'comment-with-replies',
            videoId: 'test-video-id',
            author: 'User2',
            text: 'Comment with replies',
            likeCount: 20,
            publishedAt: new Date().toISOString(),
            replyCount: 2,
            isReply: false,
          },
          {
            id: 'reply-1',
            videoId: 'test-video-id',
            author: 'Replier1',
            text: 'First reply',
            likeCount: 5,
            publishedAt: new Date().toISOString(),
            replyCount: 0,
            isReply: true,
            parentId: 'comment-with-replies',
          },
          {
            id: 'reply-2',
            videoId: 'test-video-id',
            author: 'Replier2',
            text: 'Second reply',
            likeCount: 3,
            publishedAt: new Date().toISOString(),
            replyCount: 0,
            isReply: true,
            parentId: 'comment-with-replies',
          },
        ],
        nextPageToken: undefined,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/fetch-comments',
        payload: {
          videoId: 'test-video-id',
          includeReplies: true,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.comments).toHaveLength(4);

      const topLevelComments = data.comments.filter((c: any) => !c.isReply);
      const replies = data.comments.filter((c: any) => c.isReply);

      expect(topLevelComments).toHaveLength(2);
      expect(replies).toHaveLength(2);
      expect(replies.every((r: any) => r.parentId === 'comment-with-replies')).toBe(true);
    });

    it('should fetch by channelId and handle multiple videos', async () => {
      const app = await createHttpServer();

      mockFetchComments.mockResolvedValue({
        comments: [
          {
            id: 'comment-video1',
            videoId: 'video-1',
            author: 'User1',
            text: 'Comment on video 1',
            likeCount: 10,
            publishedAt: new Date().toISOString(),
            replyCount: 0,
            isReply: false,
          },
          {
            id: 'comment-video2',
            videoId: 'video-2',
            author: 'User2',
            text: 'Comment on video 2',
            likeCount: 15,
            publishedAt: new Date().toISOString(),
            replyCount: 0,
            isReply: false,
          },
        ],
        nextPageToken: undefined,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/fetch-comments',
        payload: {
          channelId: 'channel-123',
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.comments).toHaveLength(2);
      expect(data.comments[0].videoId).toBe('video-1');
      expect(data.comments[1].videoId).toBe('video-2');
    });
  });
});
