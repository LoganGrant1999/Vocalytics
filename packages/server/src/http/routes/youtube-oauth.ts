import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createClient } from '@supabase/supabase-js';
import { createOAuth2Client } from '../../lib/google.js';
import { generateToken } from '../../lib/jwt.js';

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

export async function youtubeOAuthRoutes(fastify: FastifyInstance) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  /**
   * GET /api/youtube/connect
   * No auth required - YouTube OAuth IS the authentication method
   */
  fastify.get('/youtube/connect', async (_request: any, reply: FastifyReply) => {
    const oauth2Client = createOAuth2Client();

    // Generate a random state token for CSRF protection
    const state = Math.random().toString(36).substring(2, 15);

    // Generate OAuth authorization URL
    // Always request offline access to get refresh token
    const authUrl = oauth2Client.generateAuthUrl({
      scope: YOUTUBE_SCOPES,
      state, // CSRF protection token
      access_type: 'offline', // Request refresh token
      prompt: 'consent', // Force consent screen to ensure we get refresh_token
    });

    // Redirect user to Google consent screen
    return reply.redirect(authUrl);
  });

  /**
   * GET /api/youtube/callback
   * No auth required - creates/updates user based on Google profile
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

      // Decode ID token to get user profile
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

      // Find or create user by Google ID
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
          console.error('[youtube-oauth.ts] Failed to create user:', createError);
          return reply.code(500).send({
            error: 'Database Error',
            message: 'Failed to create user profile',
          });
        }

        userId = newUser.id;
      }

      // Preserve existing refresh_token if Google didn't return a new one
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

      const { error: updateError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId);

      if (updateError) {
        console.error('[youtube-oauth.ts] Failed to store tokens:', updateError);
        return reply.code(500).send({
          error: 'Database Error',
          message: 'Failed to store YouTube tokens',
        });
      }

      console.log('[youtube-oauth.ts] OAuth callback success', {
        userId,
        hasRefreshToken: !!refreshToken,
        isNewUser: !existingUser,
        scopes: tokens.scope,
      });

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

      // IMPORTANT: In development, redirect to the FRONTEND URL (localhost:5173)
      // so the cookie gets sent with the redirect. The frontend proxies /api to :3000
      // In production, both frontend and backend are on same domain, so use relative path
      // Use APP_URL env var if set, otherwise fall back to NODE_ENV check
      const baseUrl = process.env.APP_URL
        ? `${process.env.APP_URL}/app`
        : process.env.NODE_ENV === 'production'
        ? '/app'
        : 'http://localhost:5173/app';

      const redirectUrl = `${baseUrl}?yt=connected`;

      return reply.redirect(redirectUrl);
    } catch (err: any) {
      console.error('[youtube-oauth.ts] OAuth callback error:', err);
      return reply.code(500).send({
        error: 'OAuth Error',
        message: `Failed to complete OAuth flow: ${err.message}`,
      });
    }
  });
}
