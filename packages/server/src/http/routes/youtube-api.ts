import { FastifyInstance, FastifyReply } from 'fastify';
import { getAuthedYouTubeForUser } from '../../lib/google.js';
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';
import { isPro } from '../paywall.js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Simple in-memory rate limiter (serverless-safe with short TTL)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const RATE_LIMIT_MAX = 10; // 10 requests per minute per user

function checkRateLimit(userId: string): boolean {
  // Skip rate limiting in development
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV !== 'production') {
    return true;
  }

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
      }) as any;

      const items = response?.data?.items || [];
      const nextPageToken = response?.data?.nextPageToken;
      const pageInfo = response?.data?.pageInfo;

      // Strip replies if includeReplies is false
      const processedItems = (includeReplies !== 'true' && includeReplies !== true)
        ? items.map((item: any) => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { replies, ...rest } = item;
            return rest;
          })
        : items;

      return reply.send({
        items: processedItems,
        nextPageToken,
        pageInfo,
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

    // Check if user is pro - only pro users can post replies
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, tier, subscription_status, subscribed_until')
      .eq('id', userId)
      .single();

    console.log('[youtube-api.ts] POST /youtube/reply - User ID:', userId);
    console.log('[youtube-api.ts] Profile data:', profile);
    console.log('[youtube-api.ts] Profile error:', profileError);

    if (profileError || !profile) {
      console.log('[youtube-api.ts] Failed to fetch profile, returning 500');
      return reply.code(500).send({ error: 'Failed to fetch user profile' });
    }

    const isUserPro = isPro(profile);
    console.log('[youtube-api.ts] isPro() result:', isUserPro);

    if (!isUserPro) {
      console.log('[youtube-api.ts] User is not pro, returning 402');
      return reply.code(402).send({
        error: 'Pro Subscription Required',
        message: 'Only Pro users can post replies. Please upgrade to continue.',
        upgradeUrl: '/app/billing',
      });
    }

    console.log('[youtube-api.ts] User is pro, proceeding with reply post');

    // Rate limit check
    if (!checkRateLimit(userId)) {
      return reply.code(429).send({
        error: 'Rate Limit Exceeded',
        message: 'Too many requests. Please wait a minute.',
      });
    }

    const { parentId, text, videoId } = request.body as any;

    if (!parentId || !text) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'parentId and text are required',
      });
    }

    // Extract the top-level comment thread ID (before the dot if it exists)
    // YouTube comment IDs: "Ugw..." (thread) or "Ugw....xxxxx" (reply)
    // When replying, we always need just the thread ID
    const threadId = parentId.includes('.') ? parentId.split('.')[0] : parentId;

    console.log('[youtube-api.ts] Reply posting:', {
      originalParentId: parentId,
      extractedThreadId: threadId,
      replyText: text.slice(0, 50) + '...',
    });

    // Enforce 220 character limit (YouTube comment max)
    const trimmedText = text.slice(0, 220);

    try {
      const youtube = await getAuthedYouTubeForUser(userId);

      console.log('[youtube-api.ts] Calling YouTube API with:', {
        parentId: threadId,
        textLength: trimmedText.length,
      });

      const response = await youtube.comments.insert({
        part: ['snippet'],
        requestBody: {
          snippet: {
            parentId: threadId,
            textOriginal: trimmedText,
          },
        },
      }) as any;

      console.log('[youtube-api.ts] YouTube API response:', {
        success: true,
        commentId: response?.data?.id,
      });

      // Track this reply in the database
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      if (videoId) {
        await supabase.from('posted_replies').upsert({
          user_id: userId,
          comment_id: parentId,
          video_id: videoId,
          reply_text: trimmedText,
        }, {
          onConflict: 'user_id,comment_id'
        });
      }

      return reply.send({
        success: true,
        comment: response?.data,
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

  /**
   * GET /api/youtube/public-comments
   * Public endpoint - uses YouTube Data API with API key
   *
   * Fetches comments from any public YouTube video without requiring OAuth.
   * This endpoint is for analyzing arbitrary videos by URL/ID.
   */
  fastify.get('/youtube/public-comments', async (request: any, reply: FastifyReply) => {
    const { videoId, maxResults, order } = request.query as any;

    if (!videoId) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'videoId is required',
      });
    }

    const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
    if (!YOUTUBE_API_KEY) {
      console.error('[youtube-api.ts] YOUTUBE_API_KEY not configured');
      return reply.code(500).send({
        error: 'Configuration Error',
        message: 'YouTube API key not configured',
      });
    }

    try {
      const youtube = google.youtube({
        version: 'v3',
        auth: YOUTUBE_API_KEY,
      });

      const response = await youtube.commentThreads.list({
        part: ['id', 'snippet'],
        videoId,
        order: order || 'relevance',
        maxResults: Math.min(parseInt(maxResults) || 50, 100),
        textFormat: 'plainText',
      }) as any;

      const items = response?.data?.items || [];
      const nextPageToken = response?.data?.nextPageToken;
      const pageInfo = response?.data?.pageInfo;

      return reply.send({
        items,
        nextPageToken,
        pageInfo,
      });
    } catch (err: any) {
      console.error('[youtube-api.ts] Error fetching public comments:', err);

      // Handle common YouTube API errors
      if (err.code === 403) {
        return reply.code(403).send({
          error: 'Access Forbidden',
          message: 'Unable to access video comments. The video may be private or comments may be disabled.',
        });
      }

      if (err.code === 404) {
        return reply.code(404).send({
          error: 'Video Not Found',
          message: 'The specified video does not exist or is not available.',
        });
      }

      return reply.code(500).send({
        error: 'Internal Server Error',
        message: `Failed to fetch comments: ${err.message}`,
      });
    }
  });
}
