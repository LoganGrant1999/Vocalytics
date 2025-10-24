import { supabase, type UserVideoRow } from './client.js';
import type { UserVideo } from '../schemas.js';

export async function upsertUserVideos(
  userId: string,
  videos: UserVideo[]
): Promise<void> {
  if (videos.length === 0) return;

  const rows: Omit<UserVideoRow, 'fetched_at'>[] = videos.map((v) => ({
    user_id: userId,
    video_id: v.videoId,
    title: v.title,
    thumbnail_url: v.thumbnailUrl ?? null,
    published_at: v.publishedAt ?? null,
    stats: v.stats ?? {},
  }));

  const { error } = await supabase
    .from('user_videos')
    .upsert(rows, {
      onConflict: 'user_id,video_id',
      ignoreDuplicates: false,
    });

  if (error) {
    throw new Error(`Failed to upsert user videos: ${error.message}`);
  }
}

export async function getUserVideos(
  userId: string,
  limit = 50
): Promise<UserVideoRow[]> {
  console.log('[getUserVideos] Fetching videos for userId:', userId);

  const { data, error } = await supabase
    .from('user_videos')
    .select('*')
    .eq('user_id', userId)
    .order('fetched_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to get user videos: ${error.message}`);
  }

  console.log('[getUserVideos] Found', data?.length || 0, 'videos for userId:', userId);
  return data || [];
}

export async function getUserVideo(
  userId: string,
  videoId: string
): Promise<UserVideoRow | null> {
  const { data, error } = await supabase
    .from('user_videos')
    .select('*')
    .eq('user_id', userId)
    .eq('video_id', videoId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Not found
      return null;
    }
    throw new Error(`Failed to get user video: ${error.message}`);
  }

  return data;
}
