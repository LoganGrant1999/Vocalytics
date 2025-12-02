// packages/server/src/db/comment-sentiments.ts
//
// Database layer for incremental comment sentiment caching.
// Stores and retrieves individual comment sentiment results for reuse.

import { supabase } from './client.js';
import { createHash } from 'crypto';

// ============================================================================
// Type Definitions
// ============================================================================

type SentimentScore = {
  positive: number;
  neutral: number;
  negative: number;
};

type Category = "positive" | "neutral" | "constructive" | "negative" | "spam";

/** Database row structure for comment_sentiments table */
export type CommentSentimentRow = {
  id: string;
  user_id: string;
  video_id: string;
  comment_id: string;
  text_hash: string;
  sentiment: SentimentScore;
  category: Category;
  topics: string[];
  intent: string;
  toxicity: number;
  created_at: string;
};

/** Sentiment data structure returned from cache */
export type StoredSentiment = {
  commentId: string;
  textHash: string;
  sentiment: SentimentScore;
  category: Category;
  topics: string[];
  intent: string;
  toxicity: number;
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate SHA256 hash of comment text for change detection.
 * Text is normalized (trimmed and lowercased) before hashing.
 *
 * @param text - Comment text to hash
 * @returns SHA256 hash as hex string
 */
export function generateTextHash(text: string): string {
  return createHash('sha256').update(text.trim().toLowerCase()).digest('hex');
}

// ============================================================================
// Database Operations
// ============================================================================

/**
 * Fetch cached sentiment results for multiple comments.
 * Only returns results where text hash matches (comment hasn't changed).
 *
 * @param userId - User ID for ownership
 * @param videoId - Video ID for scope
 * @param comments - Array of comments with id and text
 * @returns Map of commentId to sentiment data
 */
export async function getCachedSentiments(
  userId: string,
  videoId: string,
  comments: Array<{ id: string; text: string }>
): Promise<Map<string, StoredSentiment>> {
  if (comments.length === 0) {
    return new Map();
  }

  const commentIds = comments.map(c => c.id);

  try {
    const { data, error } = await supabase
      .from('comment_sentiments')
      .select('*')
      .eq('user_id', userId)
      .eq('video_id', videoId)
      .in('comment_id', commentIds);

    if (error) {
      console.error('[getCachedSentiments] Error fetching cached sentiments:', error);
      return new Map();
    }

    const resultMap = new Map<string, StoredSentiment>();

    // Build hash map of current comment texts
    const commentTextHashes = new Map<string, string>();
    for (const comment of comments) {
      commentTextHashes.set(comment.id, generateTextHash(comment.text));
    }

    // Only include cached results if text hash matches (comment hasn't changed)
    for (const row of data || []) {
      const currentHash = commentTextHashes.get(row.comment_id);
      if (currentHash && currentHash === row.text_hash) {
        resultMap.set(row.comment_id, {
          commentId: row.comment_id,
          textHash: row.text_hash,
          sentiment: row.sentiment as SentimentScore,
          category: row.category as Category,
          topics: row.topics || [],
          intent: row.intent || 'other',
          toxicity: Number(row.toxicity) || 0,
        });
      }
    }

    console.log(`[getCachedSentiments] Found ${resultMap.size}/${comments.length} cached sentiments`);
    return resultMap;
  } catch (err) {
    console.error('[getCachedSentiments] Unexpected error:', err);
    return new Map();
  }
}

/**
 * Store or update sentiment results for multiple comments.
 * Uses upsert to handle both new and existing records.
 *
 * @param userId - User ID for ownership
 * @param videoId - Video ID for scope
 * @param sentiments - Array of sentiment results to store
 */
export async function storeSentiments(
  userId: string,
  videoId: string,
  sentiments: Array<{
    commentId: string;
    text: string;
    sentiment: SentimentScore;
    category: Category;
    topics: string[];
    intent: string;
    toxicity: number;
  }>
): Promise<void> {
  if (sentiments.length === 0) {
    return;
  }

  try {
    const rows = sentiments.map(s => ({
      user_id: userId,
      video_id: videoId,
      comment_id: s.commentId,
      text_hash: generateTextHash(s.text),
      sentiment: s.sentiment,
      category: s.category,
      topics: s.topics,
      intent: s.intent,
      toxicity: s.toxicity,
    }));

    const { error } = await supabase
      .from('comment_sentiments')
      .upsert(rows, {
        onConflict: 'user_id,video_id,comment_id',
        ignoreDuplicates: false, // Update if exists
      });

    if (error) {
      console.error('[storeSentiments] Error storing sentiments:', error);
    } else {
      console.log(`[storeSentiments] Stored ${sentiments.length} sentiment results`);
    }
  } catch (err) {
    console.error('[storeSentiments] Unexpected error:', err);
  }
}

/**
 * Delete all cached sentiments for a specific video.
 * Useful for forcing re-analysis or cleanup.
 *
 * @param userId - User ID for ownership
 * @param videoId - Video ID to clear cache for
 */
export async function deleteCachedSentiments(
  userId: string,
  videoId: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from('comment_sentiments')
      .delete()
      .eq('user_id', userId)
      .eq('video_id', videoId);

    if (error) {
      console.error('[deleteCachedSentiments] Error deleting cached sentiments:', error);
    } else {
      console.log(`[deleteCachedSentiments] Deleted cached sentiments for video ${videoId}`);
    }
  } catch (err) {
    console.error('[deleteCachedSentiments] Unexpected error:', err);
  }
}
