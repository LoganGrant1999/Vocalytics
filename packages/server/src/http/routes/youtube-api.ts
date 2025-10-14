import { FastifyInstance, FastifyReply } from 'fastify';
import { getAuthedYouTubeForUser } from '../../lib/google.js';

// Simple in-memory rate limiter (serverless-safe with short TTL)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const RATE_LIMIT_MAX = 10; // 10 requests per minute per user

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const existing = rateLimitMap.get(userId);

  if (!existing || now > existing.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (existing.count >= RATE_LIMIT_MAX) {
    return false;
  }

  existing.count++;
  return true;
}

export async function youtubeApiRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/youtube/comments
   * Protected by JWT middleware
   */
  fastify.get('/youtube/comments', async (request: any, reply: FastifyReply) => {
    const userId = request.auth?.userId || request.auth?.userDbId;

    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    // Rate limit check
    if (!checkRateLimit(userId)) {
      return reply.code(429).send({
        error: 'Rate Limit Exceeded',
        message: 'Too many requests. Please wait a minute.',
      });
    }

    const { videoId, pageToken, includeReplies, order } = request.query as any;

    if (!videoId) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'videoId is required',
      });
    }

    try {
      const youtube = await getAuthedYouTubeForUser(userId);

      const response = await youtube.commentThreads.list({
        part: ['id', 'snippet', 'replies'],
        videoId,
        order: order || 'time',
        maxResults: 50,
        pageToken: pageToken || undefined,
        textFormat: 'plainText',
      });

      let items = response.data.items || [];

      // Strip replies if includeReplies is false
      if (includeReplies !== 'true' && includeReplies !== true) {
        items = items.map((item) => {
          const { replies: _replies, ...rest } = item;
          return rest;
        });
      }

      return reply.send({
        items,
        nextPageToken: response.data.nextPageToken,
        pageInfo: response.data.pageInfo,
      });
    } catch (err: any) {
      console.error('[youtube-api.ts] Error fetching comments:', err);

      if (err.message?.includes('YouTube not connected')) {
        return reply.code(403).send({
          error: 'YouTube Not Connected',
          message: err.message,
          needsConnect: true,
        });
      }

      return reply.code(500).send({
        error: 'Internal Server Error',
        message: `Failed to fetch comments: ${err.message}`,
      });
    }
  });

  /**
   * POST /api/youtube/reply
   * Protected by JWT middleware
   */
  fastify.post('/youtube/reply', async (request: any, reply: FastifyReply) => {
    const userId = request.auth?.userId || request.auth?.userDbId;

    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    // Rate limit check
    if (!checkRateLimit(userId)) {
      return reply.code(429).send({
        error: 'Rate Limit Exceeded',
        message: 'Too many requests. Please wait a minute.',
      });
    }

    const { parentId, text } = request.body as any;

    if (!parentId || !text) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'parentId and text are required',
      });
    }

    // Enforce 220 character limit (YouTube comment max)
    const trimmedText = text.slice(0, 220);

    try {
      const youtube = await getAuthedYouTubeForUser(userId);

      const response = await youtube.comments.insert({
        part: ['snippet'],
        requestBody: {
          snippet: {
            parentId,
            textOriginal: trimmedText,
          },
        },
      });

      return reply.send({
        success: true,
        comment: response.data,
      });
    } catch (err: any) {
      console.error('[youtube-api.ts] Error posting reply:', err);

      // Check for insufficient scope (user only granted readonly)
      if (err.code === 403 || err.message?.includes('insufficient')) {
        return reply.code(403).send({
          error: 'Insufficient Permissions',
          message: 'Your YouTube connection lacks write permissions. Please reconnect to enable posting.',
          needsReconnect: true,
        });
      }

      if (err.message?.includes('YouTube not connected')) {
        return reply.code(403).send({
          error: 'YouTube Not Connected',
          message: err.message,
          needsConnect: true,
        });
      }

      return reply.code(500).send({
        error: 'Internal Server Error',
        message: `Failed to post reply: ${err.message}`,
      });
    }
  });
}
