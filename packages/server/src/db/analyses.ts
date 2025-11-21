import { supabase, type VideoAnalysisRow } from './client.js';
import type { AnalysisResult, Sentiment } from '../schemas.js';

export async function insertAnalysis(
  userId: string,
  videoId: string,
  payload: {
    sentiment: Sentiment;
    score: number;
    topPositive?: any[];
    topNegative?: any[];
    summary?: string;
    raw?: any;
  }
): Promise<VideoAnalysisRow> {
  const row: Omit<VideoAnalysisRow, 'analyzed_at'> = {
    user_id: userId,
    video_id: videoId,
    sentiment: payload.sentiment,
    score: payload.score,
    top_positive: payload.topPositive ?? null,
    top_negative: payload.topNegative ?? null,
    summary: payload.summary ?? null,
    raw: payload.raw ?? null,
  };

  const { data, error } = await supabase
    .from('video_analyses')
    .insert(row)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to insert analysis: ${error.message}`);
  }

  return data;
}

export async function getLatestAnalysis(
  userId: string,
  videoId: string
): Promise<VideoAnalysisRow | null> {
  const { data, error } = await supabase
    .from('video_analyses')
    .select('*')
    .eq('user_id', userId)
    .eq('video_id', videoId)
    .order('analyzed_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Not found
      return null;
    }
    throw new Error(`Failed to get latest analysis: ${error.message}`);
  }

  return data;
}

export async function listLatestAnalysesPerVideo(
  userId: string
): Promise<AnalysisResult[]> {
  console.log('[listLatestAnalysesPerVideo] Fetching analyses for userId:', userId);

  // Get the latest analysis for each video
  const { data, error } = await supabase.rpc('get_latest_analyses_per_video', {
    p_user_id: userId,
  });

  if (error) {
    // Fallback if function doesn't exist: do it manually
    const { data: allData, error: fallbackError } = await supabase
      .from('video_analyses')
      .select('*')
      .eq('user_id', userId)
      .order('analyzed_at', { ascending: false });

    if (fallbackError) {
      throw new Error(`Failed to list analyses: ${fallbackError.message}`);
    }

    console.log('[listLatestAnalysesPerVideo] Fallback: Found', allData?.length || 0, 'analyses for userId:', userId);

    // Group by video_id and take first (latest) of each
    const byVideo = new Map<string, VideoAnalysisRow>();
    for (const row of allData || []) {
      if (!byVideo.has(row.video_id)) {
        byVideo.set(row.video_id, row);
      }
    }

    const results = Array.from(byVideo.values()).map(rowToAnalysisResult);
    console.log('[listLatestAnalysesPerVideo] Returning', results.length, 'unique videos');
    return results;
  }

  console.log('[listLatestAnalysesPerVideo] Found', data?.length || 0, 'analyses for userId:', userId);
  return (data || []).map(rowToAnalysisResult);
}

export async function getTrends(
  userId: string,
  options: { days?: number } = {}
): Promise<{ date: string; avgScore: number }[]> {
  const days = options.days ?? 90;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const { data, error } = await supabase
    .from('video_analyses')
    .select('analyzed_at, score')
    .eq('user_id', userId)
    .gte('analyzed_at', cutoffDate.toISOString())
    .order('analyzed_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to get trends: ${error.message}`);
  }

  // Group by date and calculate average score
  const byDate = new Map<string, number[]>();
  for (const row of data || []) {
    const date = row.analyzed_at.split('T')[0]; // YYYY-MM-DD
    if (!byDate.has(date)) {
      byDate.set(date, []);
    }
    byDate.get(date)!.push(row.score);
  }

  return Array.from(byDate.entries())
    .map(([date, scores]) => ({
      date: `${date}T00:00:00.000Z`,
      avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function rowToAnalysisResult(row: VideoAnalysisRow): AnalysisResult {
  // Calculate categoryCounts if not present (for older analyses)
  let categoryCounts = row.raw?.categoryCounts;
  if (!categoryCounts && row.raw?.analysis) {
    categoryCounts = { pos: 0, neu: 0, neg: 0 };
    for (const a of row.raw.analysis) {
      if (a.category === 'positive') categoryCounts.pos++;
      else if (a.category === 'negative') categoryCounts.neg++;
      else categoryCounts.neu++;
    }
  }

  return {
    videoId: row.video_id,
    analyzedAt: row.analyzed_at,
    sentiment: row.sentiment as Sentiment,
    score: row.score,
    topPositive: row.top_positive ?? undefined,
    topNegative: row.top_negative ?? undefined,
    summary: row.summary ?? undefined,
    categoryCounts,
    totalComments: row.raw?.totalComments || row.raw?.analysis?.length,
  };
}
