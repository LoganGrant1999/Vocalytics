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
 * 1. Fetches user's stored YouTube OAuth tokens from Supabase profiles table
 * 2. Creates OAuth2 client with stored credentials
 * 3. Proactively refreshes token if expiring within 60 seconds
 * 4. Listens for token refresh events and persists new tokens back to DB
 * 5. Returns configured youtube_v3.Youtube client
 *
 * @param userId - Supabase user profile ID
 * @returns Authenticated YouTube API client
 * @throws Error with code 'YOUTUBE_NOT_CONNECTED' if user has no tokens
 */
export async function getAuthedYouTubeForUser(
  userId: string
): Promise<youtube_v3.Youtube> {
  // Create Supabase admin client (bypasses RLS)
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Fetch user's YouTube tokens from profiles table
  const { data: profile, error} = await supabase
    .from('profiles')
    .select('youtube_access_token, youtube_refresh_token, youtube_token_expiry, youtube_scope, youtube_token_type')
    .eq('id', userId)
    .single();

  if (error || !profile) {
    const err: any = new Error('YouTube not connected - profile not found');
    err.code = 'YOUTUBE_NOT_CONNECTED';
    throw err;
  }

  const {
    youtube_access_token: accessToken,
    youtube_refresh_token: refreshToken,
    youtube_token_expiry: tokenExpiry,
    youtube_scope: scope,
    youtube_token_type: tokenType,
  } = profile;

  // Check if user has connected YouTube (must have at least refresh_token or access_token)
  if (!accessToken && !refreshToken) {
    const err: any = new Error('YouTube not connected - no access token found. Please connect your YouTube account via /api/youtube/connect');
    err.code = 'YOUTUBE_NOT_CONNECTED';
    throw err;
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
    access_token: accessToken || undefined,
    refresh_token: refreshToken || undefined,
    scope: scope || undefined,
    token_type: tokenType || 'Bearer',
    expiry_date: tokenExpiry ? new Date(tokenExpiry).getTime() : undefined,
  });

  // Listen for token refresh events and persist to DB
  // This fires automatically when googleapis refreshes the token
  oauth2.on('tokens', async (tokens) => {
    console.log('[google.ts] Token refresh detected, persisting to DB for user:', userId);

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
      const { error: updateError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId);

      if (updateError) {
        console.error('[google.ts] Failed to persist refreshed tokens:', updateError);
      }
    }
  });

  // Proactively refresh if token expires within 60 seconds or if no valid access token
  const expiryMs = tokenExpiry ? new Date(tokenExpiry).getTime() : 0;
  const now = Date.now();
  const willExpireSoon = expiryMs > 0 && (expiryMs - now) < 60_000;
  const needsRefresh = !accessToken || willExpireSoon;

  if (needsRefresh) {
    console.log('[google.ts] Token missing or expires soon, proactively refreshing for user:', userId);
    try {
      await oauth2.getAccessToken(); // This triggers token refresh and fires 'tokens' event
    } catch (err: any) {
      console.error('[google.ts] Failed to refresh token:', err);
      const error: any = new Error('Failed to refresh YouTube token. Please reconnect your YouTube account.');
      error.code = 'YOUTUBE_NOT_CONNECTED';
      throw error;
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

/**
 * Resolves the user's channel metadata including uploads playlist ID.
 * Returns channel ID, title, and uploads playlist ID.
 *
 * @param userId - Supabase user profile ID
 * @returns Channel metadata
 */
export async function resolveChannelAndUploads(userId: string): Promise<{
  channelId: string | null;
  channelTitle: string | null;
  uploadsId: string | null;
}> {
  const yt = await getAuthedYouTubeForUser(userId);

  const res = await yt.channels.list({
    mine: true,
    part: ['snippet', 'contentDetails'],
    maxResults: 5,
  });

  const channel = res.data.items?.[0];

  return {
    channelId: channel?.id ?? null,
    channelTitle: channel?.snippet?.title ?? null,
    uploadsId: channel?.contentDetails?.relatedPlaylists?.uploads ?? null,
  };
}

/**
 * Gets the "uploads" playlist ID for the authenticated user's channel.
 * This is a special YouTube playlist that contains all uploads by the user.
 *
 * @param userId - Supabase user profile ID
 * @returns Uploads playlist ID (e.g., "UUxxx...")
 * @deprecated Use resolveChannelAndUploads instead
 */
export async function getUploadsPlaylistId(userId: string): Promise<string> {
  const { uploadsId } = await resolveChannelAndUploads(userId);

  if (!uploadsId) {
    throw new Error('Could not find uploads playlist for this channel');
  }

  return uploadsId;
}

export interface PlaylistVideo {
  videoId: string;
  title: string;
  thumbnailUrl?: string;
  publishedAt?: string;
}

/**
 * Lists videos from a playlist (typically the uploads playlist).
 * Uses authenticated YouTube client bound to the user.
 *
 * @param userId - Supabase user profile ID
 * @param playlistId - YouTube playlist ID (e.g., uploads playlist)
 * @param limit - Maximum number of videos to return
 * @returns Array of video metadata
 */
export async function listPlaylistVideosAuthed(
  userId: string,
  playlistId: string,
  limit = 20
): Promise<PlaylistVideo[]> {
  const yt = await getAuthedYouTubeForUser(userId);

  const res = await yt.playlistItems.list({
    playlistId,
    part: ['snippet'],
    maxResults: Math.min(limit, 50),
  });

  const items = res.data.items ?? [];
  return items
    .map((it) => {
      const sn = it.snippet;
      return sn && sn.resourceId?.videoId
        ? {
            videoId: sn.resourceId.videoId,
            title: sn.title ?? '(Untitled)',
            thumbnailUrl: sn.thumbnails?.medium?.url ?? sn.thumbnails?.default?.url,
            publishedAt: sn.publishedAt ?? undefined,
          }
        : null;
    })
    .filter(Boolean) as PlaylistVideo[];
}

/**
 * Lists videos from a playlist (typically the uploads playlist).
 *
 * @param userId - Supabase user profile ID
 * @param playlistId - YouTube playlist ID (e.g., uploads playlist)
 * @param limit - Maximum number of videos to return
 * @returns Array of video metadata
 * @deprecated Use listPlaylistVideosAuthed instead
 */
export async function listPlaylistVideos(
  userId: string,
  playlistId: string,
  limit = 20
): Promise<PlaylistVideo[]> {
  return listPlaylistVideosAuthed(userId, playlistId, limit);
}

export interface VideoStats {
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
}

export type VideoStatsMap = Record<string, VideoStats>;

/**
 * Fetches statistics for multiple videos.
 * Uses authenticated YouTube client bound to the user.
 *
 * @param userId - Supabase user profile ID
 * @param videoIds - Array of YouTube video IDs
 * @returns Map of videoId -> stats
 */
export async function getVideoStatsAuthed(
  userId: string,
  videoIds: string[]
): Promise<VideoStatsMap> {
  if (!videoIds.length) return {};

  const yt = await getAuthedYouTubeForUser(userId);

  const res = await yt.videos.list({
    id: videoIds,
    part: ['statistics'],
  });

  const out: VideoStatsMap = {};
  for (const v of res.data.items ?? []) {
    const id = v.id!;
    out[id] = {
      viewCount: v.statistics?.viewCount ? Number(v.statistics.viewCount) : undefined,
      likeCount: v.statistics?.likeCount ? Number(v.statistics.likeCount) : undefined,
      commentCount: v.statistics?.commentCount ? Number(v.statistics.commentCount) : undefined,
    };
  }

  return out;
}

/**
 * Fetches statistics for multiple videos.
 *
 * @param userId - Supabase user profile ID
 * @param videoIds - Array of YouTube video IDs
 * @returns Map of videoId -> stats
 * @deprecated Use getVideoStatsAuthed instead
 */
export async function getVideoStats(
  userId: string,
  videoIds: string[]
): Promise<VideoStatsMap> {
  return getVideoStatsAuthed(userId, videoIds);
}

/**
 * Fetch the creator's own past comment replies from their videos
 * Uses commentThreads.list with authorChannelId filter
 * @param accessToken - YouTube OAuth access token
 * @param maxResults - Maximum number of replies to fetch (default 50)
 * @returns Array of reply objects with text, videoId, and publishedAt
 */
export async function fetchCreatorReplies(
  accessToken: string,
  maxResults: number = 50
): Promise<Array<{ text: string; videoId: string; publishedAt: string }>> {
  const oauth2 = new OAuth2Client({
    clientId: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    redirectUri: getRedirectUri(),
  });
  oauth2.setCredentials({ access_token: accessToken });
  const youtube = google.youtube({ version: 'v3', auth: oauth2 });

  // First, get the channel ID of the authenticated user
  const channelsResponse = await youtube.channels.list({
    part: ['id'],
    mine: true
  });

  const channelId = channelsResponse.data.items?.[0]?.id;
  if (!channelId) {
    throw new Error('Could not determine channel ID');
  }

  // Fetch comment threads where the creator is the author
  // We'll fetch more than needed and filter for top-level comments by the channel owner
  const replies: Array<{ text: string; videoId: string; publishedAt: string }> = [];
  let pageToken: string | undefined;

  // YouTube API returns max 100 per page, we'll paginate until we have enough replies
  while (replies.length < maxResults) {
    const response = await youtube.commentThreads.list({
      part: ['snippet'],
      allThreadsRelatedToChannelId: channelId,
      maxResults: 100,
      pageToken,
      textFormat: 'plainText',
      moderationStatus: 'published'
    });

    const items = response.data.items ?? [];

    // Filter for comments authored by the channel owner (their replies)
    for (const item of items) {
      const snippet = item.snippet?.topLevelComment?.snippet;
      if (!snippet) continue;

      // Check if this comment is by the channel owner
      if (snippet.authorChannelId?.value === channelId) {
        replies.push({
          text: snippet.textDisplay ?? '',
          videoId: snippet.videoId ?? '',
          publishedAt: snippet.publishedAt ?? ''
        });

        if (replies.length >= maxResults) break;
      }
    }

    pageToken = response.data.nextPageToken ?? undefined;
    if (!pageToken) break; // No more pages
  }

  return replies.slice(0, maxResults);
}

/**
 * Post a reply to a YouTube comment
 */
export async function postCommentReply(
  accessToken: string,
  commentId: string,
  replyText: string
): Promise<void> {
  const oauth2 = new OAuth2Client({
    clientId: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    redirectUri: getRedirectUri(),
  });
  oauth2.setCredentials({ access_token: accessToken });
  const youtube = google.youtube({ version: 'v3', auth: oauth2 });

  await youtube.comments.insert({
    part: ['snippet'],
    requestBody: {
      snippet: {
        parentId: commentId,
        textOriginal: replyText
      }
    }
  });
}
