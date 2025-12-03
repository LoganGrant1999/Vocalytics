import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createClient } from '@supabase/supabase-js';
import { createOAuth2Client, getAuthedYouTubeForUser } from '../../lib/google.js';
import { generateToken } from '../../lib/jwt.js';
import { isPro } from '../paywall.js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// YouTube OAuth scopes + OpenID for profile info
const YOUTUBE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/youtube.force-ssl',
];

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

export async function youtubeRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/youtube/connect
   * No auth required - YouTube OAuth IS the authentication method
   *
   * Initiates YouTube OAuth flow with Authorization Code grant.
   * Redirects user to Google consent screen.
   *
   * GOTCHA: Use access_type=offline and prompt=consent to ensure refresh_token
   * is returned. "Desktop" OAuth client types won't deliver refresh tokens to
   * web callbacks—ensure you're using a "Web application" type in Google Console.
   */
  fastify.get('/youtube/connect', async (request: any, reply: FastifyReply) => {
    const oauth2Client = createOAuth2Client();

    // Generate a random state token for CSRF protection
    const state = Math.random().toString(36).substring(2, 15);

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline', // Request refresh token
      prompt: 'consent', // Force consent screen (ensures refresh_token)
      scope: YOUTUBE_SCOPES,
      state, // CSRF protection token
    });

    // Redirect user to Google consent screen
    return reply.redirect(authUrl);
  });

  /**
   * GET /api/youtube/callback
   * No auth required - creates/updates user based on Google profile
   *
   * Handles OAuth callback from Google.
   * Exchanges authorization code for access + refresh tokens.
   * Fetches Google profile to identify/create user.
   * Stores tokens in user's DB row.
   * Redirects to /app?yt=connected
   *
   * GOTCHA: Google often only returns refresh_token on first consent.
   * If user previously consented and we already have a refresh_token in DB,
   * keep the existing one (don't overwrite with null/undefined).
   */
  fastify.get('/youtube/callback', async (request: FastifyRequest, reply: FastifyReply) => {
    const { code, state, error: oauthError } = request.query as any;

    if (oauthError) {
      return reply.code(400).send({
        error: 'OAuth Error',
        message: `Google OAuth error: ${oauthError}`,
      });
    }

    if (!code || !state) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'Missing code or state parameter',
      });
    }

    const oauth2Client = createOAuth2Client();
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    try {
      // Exchange authorization code for tokens
      const { tokens } = await oauth2Client.getToken(code);

      if (!tokens.access_token) {
        return reply.code(500).send({
          error: 'OAuth Error',
          message: 'No access token received from Google',
        });
      }

      // Decode ID token to get user profile (no extra API call needed)
      if (!tokens.id_token) {
        return reply.code(500).send({
          error: 'OAuth Error',
          message: 'No ID token received from Google',
        });
      }

      // Parse ID token (JWT) to get user info
      const ticket = await oauth2Client.verifyIdToken({
        idToken: tokens.id_token,
        audience: process.env.GOOGLE_CLIENT_ID!,
      });

      const profile = ticket.getPayload();

      if (!profile || !profile.sub || !profile.email) {
        return reply.code(500).send({
          error: 'OAuth Error',
          message: 'Failed to extract user profile from ID token',
        });
      }

      // Find or create user by Google ID (sub = Google user ID)
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('*')
        .eq('google_id', profile.sub)
        .single();

      let userId: string;

      if (existingUser) {
        userId = existingUser.id;
      } else {
        // Create new user
        const { data: newUser, error: createError } = await supabase
          .from('profiles')
          .insert({
            google_id: profile.sub,
            email: profile.email,
            name: profile.name || profile.email,
            avatar_url: profile.picture,
            tier: 'free',
          })
          .select()
          .single();

        if (createError || !newUser) {
          console.error('[youtube.ts] Failed to create user:', createError);
          return reply.code(500).send({
            error: 'Database Error',
            message: 'Failed to create user profile',
          });
        }

        userId = newUser.id;
      }

      // GOTCHA: Preserve existing refresh_token if Google didn't return a new one
      const refreshToken = tokens.refresh_token || existingUser?.youtube_refresh_token;

      // Store tokens in DB
      const updates: any = {
        youtube_access_token: tokens.access_token,
        youtube_token_type: tokens.token_type || 'Bearer',
        youtube_scope: tokens.scope || YOUTUBE_SCOPES.join(' '),
      };

      if (refreshToken) {
        updates.youtube_refresh_token = refreshToken;
      }

      if (tokens.expiry_date) {
        updates.youtube_token_expiry = new Date(tokens.expiry_date).toISOString();
      }

      await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId);

      console.log('[youtube.ts] OAuth callback success, tokens stored for user:', userId);

      // Generate JWT token for session
      const jwtToken = generateToken({
        userId,
        email: profile.email!,
        tier: existingUser?.tier || 'free',
      });

      // Set JWT as HTTP-only cookie
      reply.setCookie('vocalytics_token', jwtToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 30 * 24 * 60 * 60, // 30 days
      });

      // Redirect to web app with success indicator
      // Use APP_URL env var if set, otherwise fall back to NODE_ENV check
      const baseUrl = process.env.APP_URL
        ? `${process.env.APP_URL}/app`
        : process.env.NODE_ENV === 'production'
        ? '/app'
        : 'http://localhost:5173/app';

      const redirectUrl = `${baseUrl}?yt=connected`;

      return reply.redirect(redirectUrl);
    } catch (err: any) {
      console.error('[youtube.ts] OAuth callback error:', err);
      return reply.code(500).send({
        error: 'OAuth Error',
        message: `Failed to complete OAuth flow: ${err.message}`,
      });
    }
  });

  /**
   * GET /api/youtube/comments
   * Protected by JWT middleware
   *
   * Fetches comments from a YouTube video using authenticated user's tokens.
   *
   * Query params:
   * - videoId (required): YouTube video ID
   * - pageToken (optional): Pagination token from previous response
   * - includeReplies (optional, default false): Include reply threads
   * - order (optional, default "time"): Sort order ("time" | "relevance")
   *
   * GOTCHA: Use the comment thread ID (items[].id) as parentId for replies,
   * not the snippet ID. The thread ID is the top-level comment ID.
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
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { replies, ...rest } = item;
          return rest;
        });
      }

      return reply.send({
        items,
        nextPageToken: response.data.nextPageToken,
        pageInfo: response.data.pageInfo,
      });
    } catch (err: any) {
      console.error('[youtube.ts] Error fetching comments:', err);

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
   *
   * Posts a reply to a YouTube comment using authenticated user's tokens.
   *
   * Body:
   * - parentId (required): Comment thread ID to reply to
   * - text (required): Reply text (max 220 chars enforced)
   *
   * GOTCHA: If user only granted youtube.readonly scope, posting will fail
   * with 403. We surface needsReconnect: true so UI can prompt re-auth with
   * write scope (youtube.force-ssl).
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

    console.log('[youtube.ts] POST /youtube/reply - User ID:', userId);
    console.log('[youtube.ts] Profile data:', profile);
    console.log('[youtube.ts] Profile error:', profileError);

    if (profileError || !profile) {
      console.log('[youtube.ts] Failed to fetch profile, returning 500');
      return reply.code(500).send({ error: 'Failed to fetch user profile' });
    }

    const isUserPro = isPro(profile);
    console.log('[youtube.ts] isPro() result:', isUserPro);

    if (!isUserPro) {
      console.log('[youtube.ts] User is not pro, returning 402');
      return reply.code(402).send({
        error: 'Pro Subscription Required',
        message: 'Only Pro users can post replies. Please upgrade to continue.',
        upgradeUrl: '/app/billing',
      });
    }

    console.log('[youtube.ts] User is pro, proceeding with reply post');

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

    // Enforce 220 character limit (YouTube comment max)
    const trimmedText = text.slice(0, 220);

    try {
      const youtube = await getAuthedYouTubeForUser(userId);

      const response = await youtube.comments.insert({
        part: ['snippet'],
        requestBody: {
          snippet: {
            parentId: threadId,
            textOriginal: trimmedText,
          },
        },
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
        comment: response.data,
      });
    } catch (err: any) {
      console.error('[youtube.ts] Error posting reply:', err);

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
