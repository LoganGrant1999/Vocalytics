import { OAuth2Client } from 'google-auth-library';
import { google, youtube_v3 } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set');
}

/**
 * Get redirect URI based on APP_ENV
 */
export function getRedirectUri(): string {
  const env = process.env.APP_ENV || 'local';
  if (env === 'production') {
    return process.env.GOOGLE_REDIRECT_URI_PROD!;
  }
  return process.env.GOOGLE_REDIRECT_URI_LOCAL!;
}

/**
 * Creates and returns an authenticated YouTube API client for a specific user.
 *
 * Flow:
 * 1. Fetches user's stored YouTube OAuth tokens from Supabase
 * 2. Creates OAuth2 client with stored credentials
 * 3. Proactively refreshes token if expiring within 60 seconds
 * 4. Listens for token refresh events and persists new tokens back to DB
 * 5. Returns configured youtube_v3.Youtube client
 *
 * @param userId - Supabase auth user ID (auth.uid())
 * @returns Authenticated YouTube API client
 * @throws Error if user has no tokens (needs to connect YouTube first)
 */
export async function getAuthedYouTubeForUser(
  userId: string
): Promise<youtube_v3.Youtube> {
  // Create Supabase admin client (bypasses RLS)
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Fetch user's YouTube tokens from DB
  const { data: user, error } = await supabase
    .from('users')
    .select('youtube_access_token, youtube_refresh_token, youtube_token_expiry, youtube_scope, youtube_token_type, app_user_id')
    .or(`id.eq.${userId},app_user_id.eq.${userId}`)
    .single();

  if (error || !user) {
    throw new Error('YouTube not connected - user not found');
  }

  const {
    youtube_access_token: accessToken,
    youtube_refresh_token: refreshToken,
    youtube_token_expiry: tokenExpiry,
    youtube_scope: scope,
    youtube_token_type: tokenType,
  } = user;

  if (!accessToken) {
    throw new Error('YouTube not connected - no access token found. Please connect your YouTube account via /api/youtube/connect');
  }

  // Create OAuth2 client with proper redirect URI
  const oauth2 = new OAuth2Client({
    clientId: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    redirectUri: getRedirectUri(),
  });

  // Set stored credentials
  // GOTCHA: Google often only returns refresh_token on first consent.
  // We store it and reuse it for subsequent refreshes.
  oauth2.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken || undefined,
    scope: scope || undefined,
    token_type: tokenType || 'Bearer',
    expiry_date: tokenExpiry ? new Date(tokenExpiry).getTime() : undefined,
  });

  // Listen for token refresh events and persist to DB
  // This fires automatically when googleapis refreshes the token
  oauth2.on('tokens', async (tokens) => {
    console.log('[google.ts] Token refresh detected, persisting to DB');

    const updates: any = {};

    if (tokens.access_token) {
      updates.youtube_access_token = tokens.access_token;
    }

    // GOTCHA: Google may not return refresh_token on subsequent refreshes
    // Only update if present; otherwise keep the existing one
    if (tokens.refresh_token) {
      updates.youtube_refresh_token = tokens.refresh_token;
    }

    if (tokens.expiry_date) {
      updates.youtube_token_expiry = new Date(tokens.expiry_date).toISOString();
    }

    if (tokens.scope) {
      updates.youtube_scope = tokens.scope;
    }

    if (tokens.token_type) {
      updates.youtube_token_type = tokens.token_type;
    }

    if (Object.keys(updates).length > 0) {
      await supabase
        .from('users')
        .update(updates)
        .or(`id.eq.${userId},app_user_id.eq.${userId}`);
    }
  });

  // Proactively refresh if token expires within 60 seconds
  const expiryMs = tokenExpiry ? new Date(tokenExpiry).getTime() : 0;
  const now = Date.now();
  const willExpireSoon = expiryMs > 0 && (expiryMs - now) < 60_000;

  if (willExpireSoon) {
    console.log('[google.ts] Token expires soon, proactively refreshing');
    try {
      await oauth2.getAccessToken(); // This triggers token refresh and fires 'tokens' event
    } catch (err) {
      console.error('[google.ts] Failed to refresh token:', err);
      throw new Error('Failed to refresh YouTube token. Please reconnect your YouTube account.');
    }
  }

  // Return authenticated YouTube API client
  return google.youtube({ version: 'v3', auth: oauth2 });
}

/**
 * Creates a new OAuth2 client for initiating the auth flow
 */
export function createOAuth2Client(): OAuth2Client {
  return new OAuth2Client({
    clientId: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    redirectUri: getRedirectUri(),
  });
}
