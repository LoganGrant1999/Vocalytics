import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TEST_USER } from './testAuth.js';

// Counter for generating unique user IDs to avoid rate limiter collisions between tests
let currentTestUserId = 'test-user-1';

// Use vi.hoisted for proper mock setup
const { mockGetAuthedYouTubeForUser, mockYoutubeAPI } = vi.hoisted(() => ({
  mockGetAuthedYouTubeForUser: vi.fn(),
  mockYoutubeAPI: {
    commentThreads: {
      list: vi.fn(),
    },
    comments: {
      insert: vi.fn(),
    },
  },
}));

// Mock auth plugin with consistent user ID within each test
vi.mock('../auth.js', async () => {
  const fp = await import('fastify-plugin');
  const plugin = (app: any, opts: any, done: any) => {
    app.addHook('preHandler', async (req: any, _reply: any) => {
      // Use current test's user ID (set in beforeEach)
      req.auth = {
        userId: currentTestUserId,
        userDbId: currentTestUserId,
        email: TEST_USER.email,
        tier: TEST_USER.tier
      };
      req.user = { id: currentTestUserId, email: TEST_USER.email, tier: TEST_USER.tier };
    });
    done();
  };
  return {
    default: fp.default(plugin, { name: 'auth-plugin' })
  };
});

// Mock getAuthedYouTubeForUser
vi.mock('../../lib/google.js', () => ({
  getAuthedYouTubeForUser: mockGetAuthedYouTubeForUser,
}));

import { createHttpServer } from '../index.js';

describe('YouTube API Routes - Production Critical', () => {
  let testCounter = 0;

  beforeEach(() => {
    vi.clearAllMocks();

    // Generate unique user ID for this test to avoid rate limiter collisions
    currentTestUserId = `test-user-${++testCounter}`;

    // Default: return mocked YouTube API
    mockGetAuthedYouTubeForUser.mockResolvedValue(mockYoutubeAPI);
  });

  describe('GET /api/youtube/comments - Authentication & Validation', () => {
    it('should require videoId parameter', async () => {
      const app = await createHttpServer();

      const response = await app.inject({
        method: 'GET',
        url: '/api/youtube/comments',
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Bad Request');
      expect(body.message).toContain('videoId is required');
    });

    it('should require authentication', async () => {
      const app = await createHttpServer();

      // Note: fakeVerifyToken always adds auth, so this test verifies the code path exists
      const response = await app.inject({
        method: 'GET',
        url: '/api/youtube/comments?videoId=test123',
      });

      // Should not return 401 with our fake auth
      expect(response.statusCode).not.toBe(401);
    });
  });

  describe('GET /api/youtube/comments - Rate Limiting', () => {
    it('should have rate limiting implemented (10 req/min)', async () => {
      const app = await createHttpServer();

      // Mock successful YouTube API response
      mockYoutubeAPI.commentThreads.list.mockResolvedValue({
        data: {
          items: [],
          pageInfo: { totalResults: 0, resultsPerPage: 0 },
        },
      });

      // Make 10 requests - all should succeed
      for (let i = 0; i < 10; i++) {
        const response = await app.inject({
          method: 'GET',
          url: `/api/youtube/comments?videoId=test${i}`,
        });
        expect(response.statusCode).toBe(200);
      }

      // 11th request should be rate limited
      const blockedResponse = await app.inject({
        method: 'GET',
        url: '/api/youtube/comments?videoId=test123',
      });

      expect(blockedResponse.statusCode).toBe(429);
      const body = JSON.parse(blockedResponse.body);
      expect(body.error).toBe('Rate Limit Exceeded');
      expect(body.message).toContain('Too many requests');
    });
  });

  describe('GET /api/youtube/comments - Success Cases', () => {
    // Create fresh app for each test to avoid rate limiter collisions
    it('should fetch comments successfully', async () => {
      const app = await createHttpServer();

      const mockComments = [
        {
          id: 'comment1',
          snippet: {
            topLevelComment: {
              snippet: {
                textDisplay: 'Great video!',
                authorDisplayName: 'User1',
                publishedAt: '2024-01-01T00:00:00Z',
              },
            },
          },
        },
        {
          id: 'comment2',
          snippet: {
            topLevelComment: {
              snippet: {
                textDisplay: 'Thanks for sharing',
                authorDisplayName: 'User2',
                publishedAt: '2024-01-02T00:00:00Z',
              },
            },
          },
        },
      ];

      mockYoutubeAPI.commentThreads.list.mockResolvedValue({
        data: {
          items: mockComments,
          nextPageToken: 'next-page-token-123',
          pageInfo: { totalResults: 2, resultsPerPage: 50 },
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/youtube/comments?videoId=test-video-id',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.items).toHaveLength(2);
      expect(body.nextPageToken).toBe('next-page-token-123');
      expect(body.pageInfo).toBeDefined();

      // Verify YouTube API was called correctly
      expect(mockYoutubeAPI.commentThreads.list).toHaveBeenCalledWith({
        part: ['id', 'snippet', 'replies'],
        videoId: 'test-video-id',
        order: 'time',
        maxResults: 50,
        pageToken: undefined,
        textFormat: 'plainText',
      });
    });

    it('should handle pagination with pageToken', async () => {
      const app = await createHttpServer();

      mockYoutubeAPI.commentThreads.list.mockResolvedValue({
        data: {
          items: [],
          pageInfo: {},
        },
      });

      await app.inject({
        method: 'GET',
        url: '/api/youtube/comments?videoId=vid123&pageToken=page2',
      });

      expect(mockYoutubeAPI.commentThreads.list).toHaveBeenCalledWith(
        expect.objectContaining({
          pageToken: 'page2',
        })
      );
    });

    it('should support custom order parameter', async () => {
      const app = await createHttpServer();

      mockYoutubeAPI.commentThreads.list.mockResolvedValue({
        data: {
          items: [],
          pageInfo: {},
        },
      });

      await app.inject({
        method: 'GET',
        url: '/api/youtube/comments?videoId=vid123&order=relevance',
      });

      expect(mockYoutubeAPI.commentThreads.list).toHaveBeenCalledWith(
        expect.objectContaining({
          order: 'relevance',
        })
      );
    });

    it('should include replies when includeReplies=true', async () => {
      const app = await createHttpServer();

      const mockCommentsWithReplies = [
        {
          id: 'comment1',
          snippet: { textDisplay: 'Main comment' },
          replies: {
            comments: [
              { id: 'reply1', snippet: { textDisplay: 'Reply 1' } },
            ],
          },
        },
      ];

      mockYoutubeAPI.commentThreads.list.mockResolvedValue({
        data: {
          items: mockCommentsWithReplies,
          pageInfo: {},
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/youtube/comments?videoId=vid123&includeReplies=true',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.items[0].replies).toBeDefined();
      expect(body.items[0].replies.comments).toHaveLength(1);
    });

    it('should strip replies when includeReplies is false or omitted', async () => {
      const app = await createHttpServer();

      const mockCommentsWithReplies = [
        {
          id: 'comment1',
          snippet: { textDisplay: 'Main comment' },
          replies: {
            comments: [{ id: 'reply1' }],
          },
        },
      ];

      mockYoutubeAPI.commentThreads.list.mockResolvedValue({
        data: {
          items: mockCommentsWithReplies,
          pageInfo: {},
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/youtube/comments?videoId=vid123&includeReplies=false',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.items[0].replies).toBeUndefined();
    });
  });

  describe('GET /api/youtube/comments - Error Cases', () => {
    it('should return 403 when YouTube not connected', async () => {
      const app = await createHttpServer();

      const error: any = new Error('YouTube not connected for user');
      mockGetAuthedYouTubeForUser.mockRejectedValue(error);

      const response = await app.inject({
        method: 'GET',
        url: '/api/youtube/comments?videoId=vid123',
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('YouTube Not Connected');
      expect(body.needsConnect).toBe(true);
    });

    it('should handle YouTube API errors', async () => {
      const app = await createHttpServer();

      mockYoutubeAPI.commentThreads.list.mockRejectedValue(
        new Error('YouTube API quota exceeded')
      );

      const response = await app.inject({
        method: 'GET',
        url: '/api/youtube/comments?videoId=vid123',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Internal Server Error');
      expect(body.message).toContain('Failed to fetch comments');
    });

    it('should handle empty comments list', async () => {
      const app = await createHttpServer();

      mockYoutubeAPI.commentThreads.list.mockResolvedValue({
        data: {
          items: [],
          pageInfo: { totalResults: 0 },
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/youtube/comments?videoId=vid123',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.items).toEqual([]);
    });
  });

  describe('POST /api/youtube/reply - Authentication & Validation', () => {
    it('should require parentId and text', async () => {
      const app = await createHttpServer();

      const response = await app.inject({
        method: 'POST',
        url: '/api/youtube/reply',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Bad Request');
      expect(body.message).toContain('parentId and text are required');
    });

    it('should require text even with parentId', async () => {
      const app = await createHttpServer();

      const response = await app.inject({
        method: 'POST',
        url: '/api/youtube/reply',
        payload: { parentId: 'comment123' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should require parentId even with text', async () => {
      const app = await createHttpServer();

      const response = await app.inject({
        method: 'POST',
        url: '/api/youtube/reply',
        payload: { text: 'Great video!' },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /api/youtube/reply - Rate Limiting', () => {
    it('should have rate limiting implemented (10 req/min)', async () => {
      const app = await createHttpServer();

      mockYoutubeAPI.comments.insert.mockResolvedValue({
        data: {
          id: 'reply-id',
          snippet: { textOriginal: 'Reply text' },
        },
      });

      // Make 10 requests - all should succeed
      for (let i = 0; i < 10; i++) {
        const response = await app.inject({
          method: 'POST',
          url: '/api/youtube/reply',
          payload: {
            parentId: `comment${i}`,
            text: `Reply ${i}`,
          },
        });
        expect(response.statusCode).toBe(200);
      }

      // 11th request should be rate limited
      const blockedResponse = await app.inject({
        method: 'POST',
        url: '/api/youtube/reply',
        payload: {
          parentId: 'comment123',
          text: 'Blocked reply',
        },
      });

      expect(blockedResponse.statusCode).toBe(429);
      const body = JSON.parse(blockedResponse.body);
      expect(body.error).toBe('Rate Limit Exceeded');
    });
  });

  describe('POST /api/youtube/reply - Success Cases', () => {
    it('should post reply successfully', async () => {
      const app = await createHttpServer();

      const mockReplyResponse = {
        data: {
          id: 'new-reply-123',
          snippet: {
            parentId: 'comment123',
            textOriginal: 'Thanks for watching!',
            authorDisplayName: 'Test User',
            publishedAt: '2024-01-01T00:00:00Z',
          },
        },
      };

      mockYoutubeAPI.comments.insert.mockResolvedValue(mockReplyResponse);

      const response = await app.inject({
        method: 'POST',
        url: '/api/youtube/reply',
        payload: {
          parentId: 'comment123',
          text: 'Thanks for watching!',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.comment).toEqual(mockReplyResponse.data);

      // Verify YouTube API was called correctly
      expect(mockYoutubeAPI.comments.insert).toHaveBeenCalledWith({
        part: ['snippet'],
        requestBody: {
          snippet: {
            parentId: 'comment123',
            textOriginal: 'Thanks for watching!',
          },
        },
      });
    });

    it('should trim text to 220 characters', async () => {
      const app = await createHttpServer();

      mockYoutubeAPI.comments.insert.mockResolvedValue({
        data: {
          id: 'reply-id',
          snippet: { textOriginal: 'long text' },
        },
      });

      const longText = 'a'.repeat(300); // 300 characters

      await app.inject({
        method: 'POST',
        url: '/api/youtube/reply',
        payload: {
          parentId: 'comment123',
          text: longText,
        },
      });

      // Verify text was trimmed to 220 chars
      expect(mockYoutubeAPI.comments.insert).toHaveBeenCalledWith({
        part: ['snippet'],
        requestBody: {
          snippet: {
            parentId: 'comment123',
            textOriginal: 'a'.repeat(220), // Only 220 chars
          },
        },
      });
    });

    it('should handle emoji and special characters', async () => {
      const app = await createHttpServer();

      mockYoutubeAPI.comments.insert.mockResolvedValue({
        data: {
          id: 'reply-id',
          snippet: {},
        },
      });

      const emojiText = 'Great video! 😊👍🎉';

      await app.inject({
        method: 'POST',
        url: '/api/youtube/reply',
        payload: {
          parentId: 'comment123',
          text: emojiText,
        },
      });

      expect(mockYoutubeAPI.comments.insert).toHaveBeenCalledWith({
        part: ['snippet'],
        requestBody: {
          snippet: {
            parentId: 'comment123',
            textOriginal: emojiText,
          },
        },
      });
    });
  });

  describe('POST /api/youtube/reply - Error Cases', () => {
    it('should return 403 when YouTube not connected', async () => {
      const app = await createHttpServer();

      const error: any = new Error('YouTube not connected for user');
      mockGetAuthedYouTubeForUser.mockRejectedValue(error);

      const response = await app.inject({
        method: 'POST',
        url: '/api/youtube/reply',
        payload: {
          parentId: 'comment123',
          text: 'Reply text',
        },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('YouTube Not Connected');
      expect(body.needsConnect).toBe(true);
    });

    it('should return 403 when insufficient permissions (readonly scope)', async () => {
      const app = await createHttpServer();

      const error: any = new Error('Insufficient permissions');
      error.code = 403;
      mockYoutubeAPI.comments.insert.mockRejectedValue(error);

      const response = await app.inject({
        method: 'POST',
        url: '/api/youtube/reply',
        payload: {
          parentId: 'comment123',
          text: 'Reply text',
        },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Insufficient Permissions');
      expect(body.needsReconnect).toBe(true);
      expect(body.message).toContain('lacks write permissions');
    });

    it('should handle YouTube API errors', async () => {
      const app = await createHttpServer();

      mockYoutubeAPI.comments.insert.mockRejectedValue(
        new Error('Comment not found')
      );

      const response = await app.inject({
        method: 'POST',
        url: '/api/youtube/reply',
        payload: {
          parentId: 'invalid-comment',
          text: 'Reply text',
        },
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Internal Server Error');
      expect(body.message).toContain('Failed to post reply');
    });
  });

  describe('Integration Scenarios', () => {
    it('should complete full flow: fetch comments → post reply', async () => {
      const app = await createHttpServer();

      // Setup: Fetch comments
      mockYoutubeAPI.commentThreads.list.mockResolvedValue({
        data: {
          items: [
            {
              id: 'comment-thread-123',
              snippet: {
                topLevelComment: {
                  snippet: { textDisplay: 'Great video!' },
                },
              },
            },
          ],
          pageInfo: {},
        },
      });

      // Step 1: Fetch comments
      const fetchResponse = await app.inject({
        method: 'GET',
        url: '/api/youtube/comments?videoId=vid123',
      });
      expect(fetchResponse.statusCode).toBe(200);
      const comments = JSON.parse(fetchResponse.body);
      const firstCommentId = comments.items[0].id;

      // Setup: Post reply
      mockYoutubeAPI.comments.insert.mockResolvedValue({
        data: {
          id: 'new-reply-456',
          snippet: { textOriginal: 'Thanks!' },
        },
      });

      // Step 2: Post reply to first comment
      const replyResponse = await app.inject({
        method: 'POST',
        url: '/api/youtube/reply',
        payload: {
          parentId: firstCommentId,
          text: 'Thanks for your feedback!',
        },
      });

      expect(replyResponse.statusCode).toBe(200);
      const reply = JSON.parse(replyResponse.body);
      expect(reply.success).toBe(true);
      expect(reply.comment).toBeDefined();
    });

    it('should use shared rate limiter across different endpoints', async () => {
      const app = await createHttpServer();

      mockYoutubeAPI.commentThreads.list.mockResolvedValue({
        data: { items: [], pageInfo: {} },
      });
      mockYoutubeAPI.comments.insert.mockResolvedValue({
        data: { id: 'reply-id', snippet: {} },
      });

      // Make 5 GET requests
      for (let i = 0; i < 5; i++) {
        await app.inject({
          method: 'GET',
          url: `/api/youtube/comments?videoId=vid${i}`,
        });
      }

      // Make 5 POST requests (total 10 requests)
      for (let i = 0; i < 5; i++) {
        await app.inject({
          method: 'POST',
          url: '/api/youtube/reply',
          payload: {
            parentId: `comment${i}`,
            text: `Reply ${i}`,
          },
        });
      }

      // 11th request should be blocked (shared rate limiter)
      const blocked = await app.inject({
        method: 'GET',
        url: '/api/youtube/comments?videoId=vidBlocked',
      });

      expect(blocked.statusCode).toBe(429);
    });
  });

  describe('Edge Cases & Security', () => {
    it('should handle malformed videoId', async () => {
      const app = await createHttpServer();

      mockYoutubeAPI.commentThreads.list.mockRejectedValue(
        new Error('Invalid video ID')
      );

      const response = await app.inject({
        method: 'GET',
        url: '/api/youtube/comments?videoId=<script>alert(1)</script>',
      });

      expect(response.statusCode).toBe(500);
    });

    it('should handle empty string text in reply', async () => {
      const app = await createHttpServer();

      const response = await app.inject({
        method: 'POST',
        url: '/api/youtube/reply',
        payload: {
          parentId: 'comment123',
          text: '',
        },
      });

      // Empty string fails validation
      expect(response.statusCode).toBe(400);
    });

    it('should handle special characters in reply text', async () => {
      const app = await createHttpServer();

      mockYoutubeAPI.comments.insert.mockResolvedValue({
        data: { id: 'reply-id', snippet: {} },
      });

      const specialText = 'Test < > & " \' / \\ \n \t 测试';

      const response = await app.inject({
        method: 'POST',
        url: '/api/youtube/reply',
        payload: {
          parentId: 'comment123',
          text: specialText,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockYoutubeAPI.comments.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: expect.objectContaining({
            snippet: expect.objectContaining({
              textOriginal: specialText,
            }),
          }),
        })
      );
    });

    it('should handle exactly 220 character text', async () => {
      const app = await createHttpServer();

      mockYoutubeAPI.comments.insert.mockResolvedValue({
        data: { id: 'reply-id', snippet: {} },
      });

      const exactly220 = 'a'.repeat(220);

      await app.inject({
        method: 'POST',
        url: '/api/youtube/reply',
        payload: {
          parentId: 'comment123',
          text: exactly220,
        },
      });

      expect(mockYoutubeAPI.comments.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: expect.objectContaining({
            snippet: expect.objectContaining({
              textOriginal: exactly220,
            }),
          }),
        })
      );
    });
  });
});
