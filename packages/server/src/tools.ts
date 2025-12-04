// packages/server/src/tools.ts
//
// Core comment analysis and processing tools.
// Provides sentiment analysis, reply generation, and comment fetching.

import type { TWComment } from './types.js';
import { htmlToText } from './types.js';
import { chatReply, moderateText, analyzeSentiment, classifyCommentsBatch, DEFAULT_BATCH_SIZE, setMaxParallel } from './llm.js';

// ============================================================================
// Type Definitions
// ============================================================================

type SentimentScore = {
  positive: number;
  negative: number;
  neutral: number;
};

type Category = "positive" | "neutral" | "constructive" | "negative" | "spam";

type Analysis = {
  commentId: string;
  sentiment: SentimentScore;
  topics: string[];
  intent: string;
  toxicity: number;
  category: Category;
};

type GeneratedReply = {
  tone: string;
  reply: string;
};

type SentimentSummary = {
  overallSentiment: string;
  averageScores: SentimentScore;
  totalComments: number;
  topTopics: Array<{ topic: string; count: number }>;
  toxicityLevel: string;
  counts: Record<Category, number>;
};

// ============================================================================
// Utility Functions
// ============================================================================

/** Sort comments by publish date (newest first) */
const byPublishedDesc = (a: TWComment, b: TWComment): number =>
  Date.parse(b.publishedAt) - Date.parse(a.publishedAt);

/** Sort comments by like count (most liked first) */
const byLikesDesc = (a: TWComment, b: TWComment): number =>
  (b.likeCount ?? 0) - (a.likeCount ?? 0);

/** Sleep helper for jitter delays */
async function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Add random jitter delay to spread requests over time.
 * Helps prevent rate-limit spikes when processing in parallel.
 */
async function jitterDelay(baseMs: number = 50, varianceMs: number = 100): Promise<void> {
  const delay = baseMs + Math.floor(Math.random() * varianceMs);
  await sleep(delay);
}

// ============================================================================
// Heuristic Classification
// ============================================================================

/**
 * Fast heuristic classifier for obvious sentiment cases.
 *
 * Confidently classifies:
 * - Clear spam (URLs, promotions)
 * - Simple positive praise (short, with strong signals)
 * - Clear negative hate/criticism (strong negative words)
 *
 * Returns "uncertain" for:
 * - Long/nuanced comments
 * - Mixed sentiment
 * - Questions or constructive feedback
 *
 * @returns Confident classification or uncertain marker
 */
export function heuristicClassify(text: string):
  | { type: "confident"; category: Category; sentiment: SentimentScore }
  | { type: "uncertain" } {

  const t = text.toLowerCase();
  const len = text.length;

  // === SPAM ===
  if (/https?:\/\//.test(text)) {
    return { type: "confident", category: "spam", sentiment: { positive: 0.05, neutral: 0.15, negative: 0.8 } };
  }
  if (/(check out|subscribe to|visit|follow) (my|our) (channel|page|instagram|twitter|tiktok)/i.test(text)) {
    return { type: "confident", category: "spam", sentiment: { positive: 0.05, neutral: 0.15, negative: 0.8 } };
  }
  if (/\bfree\b/i.test(t) && /(click|download|win|prize|offer|gift)/i.test(t)) {
    return { type: "confident", category: "spam", sentiment: { positive: 0.05, neutral: 0.15, negative: 0.8 } };
  }

  // === SENTIMENT INDICATORS ===
  // Positive words/phrases
  const positiveWords = /\b(love|adore|amazing|awesome|excellent|fantastic|brilliant|perfect|great|wonderful|beautiful|best|favorite|favourite|incredible|outstanding|phenomenal|masterpiece|legend|goat|fire)\b/i;
  const positiveSlang = /\b(lit|dope|sick|banger|bussin|slaps|vibes|based|chad|gigachad|W|king|queen)\b/i;
  const positiveEmoji = /❤️?|😊|😍|🎉|💯|👍|🔥|✨|⭐|🙌|😎|🤩|😄|😁|🥰|💪|👏|🏆|💕|💖/;
  const thankYou = /\b(thank|thanks|thx|ty|appreciate|grateful|appreciate it|bless)\b/i;
  const supportive = /\b(keep it up|keep going|you got this|well done|good job|nice work|proud|respect|salute)\b/i;

  // Negative words/phrases
  const negativeWords = /\b(hate|terrible|awful|worst|horrible|trash|garbage|suck|boring|lame|cringe|crappy|pathetic)\b/i;
  const disappointment = /\b(disappointed|letdown|let down|underwhelming|meh|overrated|overhyped)\b/i;
  const negativeEmoji = /😠|😡|👎|💩|😢|😭|😤|🤮|😒|🙄|😑/;
  const profanity = /\b(f+u+c+k|sh+i+t|d+a+m+n|hell|crap|piss|ass|bitch|wtf)\b/i;

  // Constructive indicators
  const questions = /\?$/;
  const suggestions = /\b(could|should|would|might|perhaps|maybe|consider|suggest|recommend|idea|what if|how about)\b/i;
  const feedback = /\b(but|however|although|though|except|improvement|improve|better|fix|issue|problem)\b/i;

  // Count indicators
  const positiveCount = [positiveWords.test(text), positiveSlang.test(text), positiveEmoji.test(text), thankYou.test(text), supportive.test(text)].filter(Boolean).length;
  const negativeCount = [negativeWords.test(text), disappointment.test(text), negativeEmoji.test(text), profanity.test(text)].filter(Boolean).length;
  const constructiveCount = [suggestions.test(text), feedback.test(text)].filter(Boolean).length;

  // === POSITIVE CLASSIFICATION ===
  // Strong positive (2+ positive indicators, no negative)
  if (positiveCount >= 2 && negativeCount === 0) {
    return { type: "confident", category: "positive", sentiment: { positive: 0.85, neutral: 0.1, negative: 0.05 } };
  }
  // Medium positive (1 positive indicator, no negative, short)
  if (positiveCount >= 1 && negativeCount === 0 && len < 150) {
    return { type: "confident", category: "positive", sentiment: { positive: 0.75, neutral: 0.2, negative: 0.05 } };
  }
  // Pure emoji positive (2+ emojis, minimal text)
  const positiveEmojiCount = (text.match(positiveEmoji) || []).length;
  if (positiveEmojiCount >= 2 && len < 80 && negativeCount === 0) {
    return { type: "confident", category: "positive", sentiment: { positive: 0.9, neutral: 0.05, negative: 0.05 } };
  }

  // === NEGATIVE CLASSIFICATION ===
  // Strong negative (2+ negative indicators)
  if (negativeCount >= 2) {
    return { type: "confident", category: "negative", sentiment: { positive: 0.05, neutral: 0.15, negative: 0.8 } };
  }
  // Medium negative (1 negative indicator, no positive)
  if (negativeCount >= 1 && positiveCount === 0) {
    return { type: "confident", category: "negative", sentiment: { positive: 0.1, neutral: 0.2, negative: 0.7 } };
  }

  // === CONSTRUCTIVE CLASSIFICATION ===
  // Question
  if (questions.test(text) && negativeCount <= 1 && positiveCount <= 1) {
    return { type: "confident", category: "constructive", sentiment: { positive: 0.4, neutral: 0.45, negative: 0.15 } };
  }
  // Suggestion/feedback with mixed sentiment
  if (constructiveCount >= 1 && (positiveCount > 0 || negativeCount > 0)) {
    return { type: "confident", category: "constructive", sentiment: { positive: 0.35, neutral: 0.45, negative: 0.2 } };
  }

  // === NEUTRAL CLASSIFICATION (default for most) ===
  // Factual statements, simple observations, announcements
  // Any comment that doesn't strongly lean positive/negative
  if (positiveCount === 0 && negativeCount === 0) {
    return refineNeutralClassification(text, { positive: 0.15, neutral: 0.75, negative: 0.1 });
  }

  // Mixed sentiment (1 positive + 1 negative) → neutral
  if (positiveCount >= 1 && negativeCount >= 1) {
    return refineNeutralClassification(text, { positive: 0.3, neutral: 0.5, negative: 0.2 });
  }

  // === UNCERTAIN (truly ambiguous, < 5% of comments) ===
  // Only send complex nuanced comments to GPT
  if (len > 300 || (constructiveCount >= 2 && positiveCount >= 2 && negativeCount >= 1)) {
    return { type: "uncertain" };
  }

  // Final fallback: neutral
  return refineNeutralClassification(text, { positive: 0.2, neutral: 0.65, negative: 0.15 });
}

/**
 * Post-processing helper to reduce "lazy neutral" classifications.
 * Performs a second-pass token check on comments initially classified as neutral
 * to catch sentiment signals that were too weak for the main classifier but
 * should still avoid the neutral bucket.
 */
function refineNeutralClassification(
  text: string,
  defaultSentiment: SentimentScore
): { type: "confident"; category: Category; sentiment: SentimentScore } {
  const t = text.toLowerCase();

  // Token lists for second-pass detection
  const positiveTokens = ["love", "amazing", "awesome", "great", "fantastic", "so good", "fire", "🔥", "❤️", "😂", "lol", "lmao", "best", "incredible", "haha", "nice", "cool", "good"];
  const negativeTokens = ["hate", "terrible", "awful", "trash", "cringe", "worst", "boring", "disappointing", "bad", "stupid", "dumb", "🤮", "👎", "💩", "sucks", "suck"];
  const questionSuggestionPatterns = [
    "you should", "could you", "can you", "why don't you", "why dont you",
    "idk if", "i think you should", "maybe try", "?", "what if", "how about"
  ];

  // Check for tokens
  const hasPositive = positiveTokens.some(token => t.includes(token));
  const hasNegative = negativeTokens.some(token => t.includes(token));
  const hasQuestionOrSuggestion = questionSuggestionPatterns.some(pattern => t.includes(pattern));

  // Reclassify based on detected signals
  // a) Positive signal only → positive
  if (hasPositive && !hasNegative) {
    return {
      type: "confident",
      category: "positive",
      sentiment: { positive: 0.65, neutral: 0.25, negative: 0.1 }
    };
  }

  // b) Negative signal only → negative
  if (hasNegative && !hasPositive) {
    return {
      type: "confident",
      category: "negative",
      sentiment: { positive: 0.1, neutral: 0.25, negative: 0.65 }
    };
  }

  // c) Mixed signals OR question/suggestion → constructive
  if ((hasPositive && hasNegative) || hasQuestionOrSuggestion) {
    return {
      type: "confident",
      category: "constructive",
      sentiment: { positive: 0.35, neutral: 0.4, negative: 0.25 }
    };
  }

  // d) No signals detected → truly neutral (timestamps, bland factual comments)
  return {
    type: "confident",
    category: "neutral",
    sentiment: defaultSentiment
  };
}

// Very small keyword heuristics to diversify categories for fixtures
function classifyCategory(text: string): Category {
  const t = text.toLowerCase();

  // spam-like
  if (/\bfree\b/.test(t) || /https?:\/\//.test(t)) return "spam";

  // constructive / suggestion-y
  if (t.includes("constructive") || t.includes("compressor") || t.includes("could you") || t.includes("suggest")) {
    return "constructive";
  }

  // negative-ish (check before positive to catch "hate")
  if (t.includes("meh") || t.includes("didn't") || t.includes("didnt") || t.includes("bad") || t.includes("terrible") || t.includes("awful") || t.includes("worst")) return "negative";

  // positive-ish (expanded list with more common positive expressions)
  if (
    t.includes("love") ||
    t.includes("❤") ||
    t.includes("helpful") ||
    t.includes("great") ||
    t.includes("amazing") ||
    t.includes("awesome") ||
    t.includes("excellent") ||
    t.includes("wonderful") ||
    t.includes("fantastic") ||
    t.includes("best") ||
    t.includes("thank") ||
    t.includes("thanks") ||
    t.includes("appreciate") ||
    t.includes("congrat") ||
    t.includes("well done") ||
    t.includes("good job") ||
    t.includes("nice") ||
    t.includes("beautiful") ||
    t.includes("perfect") ||
    t.includes("brilliant") ||
    /\b(good|better)\b/.test(t) ||
    /👍|😊|😍|🎉|💯/.test(t)
  ) {
    return "positive";
  }

  return "neutral";
}

/**
 * Maps a YouTube API item (thread or reply) to our canonical TWComment shape.
 */
function mapYouTubeItemToTWComment(item: any, parentId?: string): TWComment {
  // Handles both thread items and reply items
  const top = item.snippet?.topLevelComment?.snippet ?? item.snippet ?? {};
  const id = item.id || item.snippet?.topLevelComment?.id || top.id || "";

  const videoId = top.videoId || item.snippet?.videoId || "";
  const author =
    top.authorDisplayName ??
    item.snippet?.authorDisplayName ??
    "Unknown";

  const rawText =
    top.textOriginal ??
    top.textDisplay ??
    item.snippet?.textOriginal ??
    item.snippet?.textDisplay ??
    "";
  const text = htmlToText(rawText).trim();

  const publishedAt =
    top.publishedAt ??
    item.snippet?.publishedAt ??
    new Date().toISOString();

  const likeCount =
    typeof top.likeCount === "number"
      ? top.likeCount
      : typeof item.snippet?.likeCount === "number"
      ? item.snippet.likeCount
      : 0;

  const replyCount =
    typeof item.snippet?.totalReplyCount === "number"
      ? item.snippet.totalReplyCount
      : 0;

  return {
    id,
    videoId,
    author,
    text,
    publishedAt,
    likeCount,
    replyCount,
    isReply: Boolean(parentId),
    parentId
  };
}

// ============================================================================
// Comment Fetching
// ============================================================================

/**
 * Fetch comments from YouTube or return mock data.
 *
 * Tries in order:
 * 1. Authenticated YouTube API (if userId provided)
 * 2. Public YouTube Data API (if API key available)
 * 3. Mock data (for testing/development)
 *
 * @param videoId - Video ID to fetch comments for
 * @param channelId - Channel ID to fetch comments for
 * @param max - Maximum comments per page (1-100)
 * @param pageToken - Pagination token for next page
 * @param includeReplies - Include comment replies
 * @param order - Sort order (time or relevance)
 * @param userId - User ID for authenticated access
 * @returns Comments array and next page token
 */
export async function fetchComments(
  videoId?: string,
  channelId?: string,
  max: number = 50,
  pageToken?: string,
  includeReplies: boolean = false,
  order: "time" | "relevance" = "time",
  userId?: string
): Promise<{ comments: TWComment[]; nextPageToken?: string }> {
  if (!videoId && !channelId) throw new Error("Provide videoId or channelId");

  // ---- Use authenticated YouTube client if userId provided ----
  if (userId) {
    try {
      const { getAuthedYouTubeForUser } = await import('./lib/google.js');
      const yt = await getAuthedYouTubeForUser(userId);

      const params: any = {
        part: includeReplies ? ['snippet', 'replies'] : ['snippet'],
        order,
        maxResults: Math.min(100, Math.max(1, max))
      };
      if (videoId) params.videoId = videoId;
      if (channelId) params.channelId = channelId;
      if (pageToken) params.pageToken = pageToken;

      const res = await yt.commentThreads.list(params) as any;

      const comments: TWComment[] = [];
      for (const th of res?.data?.items ?? []) {
        // Add top-level comment
        comments.push(mapYouTubeItemToTWComment(th));
        // Add replies if requested
        if (includeReplies && th.replies?.comments?.length) {
          const topId = th.snippet?.topLevelComment?.id || th.id;
          for (const reply of th.replies.comments) {
            comments.push(mapYouTubeItemToTWComment(reply, topId));
          }
        }
      }

      if (includeReplies || order === "time") {
        comments.sort(byPublishedDesc);
      } else {
        comments.sort(byLikesDesc);
      }

      return {
        comments,
        nextPageToken: res?.data?.nextPageToken
      };
    } catch (error: any) {
      console.error('[fetchComments] Error fetching from YouTube API:', error);
      // If YouTube not connected or error, fall through to mock data
      if (error.code !== 'YOUTUBE_NOT_CONNECTED') {
        throw error;
      }
    }
  }

  // Try to use YouTube Data API key for public video comments
  const youtubeApiKey = process.env.YOUTUBE_API_KEY || process.env.GOOGLE_API_KEY;

  console.log('[fetchComments] YouTube API key available:', !!youtubeApiKey);
  console.log('[fetchComments] API key prefix:', youtubeApiKey?.substring(0, 10));

  // ---- MOCK (no API key available) ----
  if (!youtubeApiKey) {
    const all: TWComment[] = [];
    for (let i = 1; i <= 120; i++) {
      const id = `mock_${i}`;
      const author = i % 5 === 0 ? "Casey" : i % 3 === 0 ? "Bob" : "Alice";
      const base: TWComment = {
        id,
        videoId: videoId ?? "mock_video_id",
        author,
        text:
          i % 10 === 0
            ? "Check this out http://spam.example"
            : i % 4 === 0
            ? "Not sure—could you clarify?"
            : "Great video! Really helpful content.",
        likeCount: (i * 3) % 50,
        publishedAt: new Date(Date.now() - i * 60000).toISOString(),
        replyCount: 0,
        isReply: false
      };
      all.push(base);

      if (includeReplies && i % 6 === 0) {
        all.push({
          id: `${id}_r1`,
          videoId: videoId ?? "mock_video_id",
          author: "ReplyBot",
          text: "Thanks for the details!",
          publishedAt: new Date(Date.now() - i * 60000 + 1000).toISOString(),
          likeCount: 0,
          replyCount: 0,
          isReply: true,
          parentId: id
        });
      }
    }

    if (order === "relevance") {
      for (let i = 0; i < all.length; i += 5) {
        all.splice(i, 5, ...all.slice(i, i + 5).reverse());
      }
    }

    const perPage = Math.min(100, Math.max(1, max));
    const pageIdx = pageToken ? Math.max(1, parseInt(String(pageToken).replace(/[^\d]/g, "") || "1", 10)) : 1;
    const start = (pageIdx - 1) * perPage;
    const slice = all.slice(start, start + perPage);
    const nextPageToken = start + perPage < all.length ? `p${pageIdx + 1}` : undefined;

    return { comments: slice, nextPageToken };
  }

  // ---- REAL API (use API key for public data) ----
  const base = "https://www.googleapis.com/youtube/v3/commentThreads";
  const params: Record<string, string> = {
    part: includeReplies ? "snippet,replies" : "snippet",
    textFormat: "plainText",
    order,
    maxResults: String(Math.min(100, Math.max(1, max))),
    key: youtubeApiKey // API key as query param, not Bearer token
  };
  if (videoId) params.videoId = videoId;
  if (channelId) params.channelId = channelId;
  if (pageToken) params.pageToken = pageToken;

  const url = `${base}?${new URLSearchParams(params).toString()}`;
  console.log('[fetchComments] Calling YouTube API:', url.substring(0, 100) + '...');
  const res = await fetch(url); // No auth header needed with API key in URL
  if (!res.ok) {
    const body = await res.text();
    console.error('[fetchComments] YouTube API error:', res.status, body);
    throw new Error(`YouTube API error ${res.status}: ${body}`);
  }
  const json = await res.json();

  const comments: TWComment[] = [];
  for (const th of json.items ?? []) {
    // Add top-level
    comments.push(mapYouTubeItemToTWComment(th));
    // Add replies if requested
    if (includeReplies && th.replies?.comments?.length) {
      const topId = th.snippet?.topLevelComment?.id || th.id;
      for (const reply of th.replies.comments) {
        comments.push(mapYouTubeItemToTWComment(reply, topId));
      }
    }
  }

  if (includeReplies || order === "time") {
    comments.sort(byPublishedDesc);
  } else {
    comments.sort(byLikesDesc);
  }

  return {
    comments,
    nextPageToken: json.nextPageToken
  };
}

// ============================================================================
// Comment Analysis Helpers
// ============================================================================

/**
 * Extract topics from comment text using keyword matching.
 */
function extractTopics(text: string): string[] {
  const topics: string[] = [];
  const lower = text.toLowerCase();

  if (lower.includes("audio")) topics.push("audio");
  if (lower.includes("compressor")) topics.push("post-processing");
  if (lower.includes("timestamp")) topics.push("timestamps");

  return topics.length > 0 ? topics : ["general"];
}

/**
 * Calculate toxicity score based on category and sentiment.
 */
function calculateToxicity(category: Category, sentiment: SentimentScore): number {
  switch (category) {
    case "spam":
      return 0.7;
    case "negative":
      return Math.max(0.4, sentiment.negative);
    case "constructive":
      return 0.15;
    default:
      return sentiment.negative * 0.6;
  }
}

/**
 * Determine intent from category.
 */
function determineIntent(category: Category): string {
  switch (category) {
    case "spam":
      return "promotion";
    case "negative":
      return "critique";
    case "constructive":
      return "suggestion";
    default:
      return "appreciation";
  }
}

/**
 * Apply moderation overrides to category and toxicity.
 * Returns updated values if moderation flags content.
 *
 * OPTIMIZED: Disabled OpenAI moderation API calls to avoid rate limiting.
 * Only applies heuristic-based overrides (e.g., URL detection for spam).
 */
async function applyModerationOverrides(
  text: string,
  category: Category,
  toxicity: number
): Promise<{ category: Category; toxicity: number }> {
  // DISABLED: Moderation API causes rate limiting (429) when analyzing 600+ comments
  // const mod = await moderateText(text);
  //
  // if (mod.flagged) {
  //   if (mod.category === "hate" || mod.category === "violence" || mod.category === "harassment") {
  //     return { category: "negative", toxicity: Math.max(toxicity, 0.6) };
  //   }
  //   if (mod.category === "sexual" || mod.category === "self-harm") {
  //     return { category: "negative", toxicity: Math.max(toxicity, 0.7) };
  //   }
  // }

  // URL heuristic → spam override
  if (/\bhttps?:\/\//.test(text)) {
    return { category: "spam", toxicity: Math.max(toxicity, 0.7) };
  }

  return { category, toxicity };
}

/**
 * Build fallback sentiment scores based on category.
 */
function getFallbackSentiment(category: Category): SentimentScore {
  switch (category) {
    case "positive":
      return { positive: 0.85, neutral: 0.1, negative: 0.05 };
    case "constructive":
      return { positive: 0.45, neutral: 0.35, negative: 0.2 };
    case "negative":
      return { positive: 0.1, neutral: 0.2, negative: 0.7 };
    case "spam":
      return { positive: 0.05, neutral: 0.15, negative: 0.8 };
    default:
      return { positive: 0.2, neutral: 0.7, negative: 0.1 };
  }
}

// ============================================================================
// Main Analysis Function
// ============================================================================

/**
 * Analyze sentiment for a batch of comments.
 *
 * Features:
 * - Incremental caching (reuses previous results)
 * - Heuristic pre-filtering (avoids GPT for obvious cases)
 * - Batch GPT classification (50 comments per batch)
 * - Pro user concurrency boost (2x parallel requests)
 * - Automatic result storage for future reuse
 *
 * @param comments - Comments to analyze
 * @param options - Configuration options
 * @returns Array of sentiment analysis results
 */
export async function analyzeComments(
  comments: Partial<TWComment>[],
  options?: {
    userId?: string;
    videoId?: string;
    userTier?: string;
    batchSize?: number;
  }
): Promise<Analysis[]> {
  // Configure concurrency based on user tier
  const isPro = options?.userTier === 'pro';
  setMaxParallel(isPro);

  const BATCH_SIZE = options?.batchSize || DEFAULT_BATCH_SIZE;
  console.log(`[analyzeComments] Batch size: ${BATCH_SIZE}, Pro user: ${isPro}`);

  // Step 0: Check for cached sentiments (if userId and videoId provided)
  const cachedSentiments = new Map<string, any>();
  let cacheHits = 0;

  if (options?.userId && options?.videoId) {
    try {
      const { getCachedSentiments } = await import('./db/comment-sentiments.js');
      const commentsWithText = comments
        .filter(c => c.id && c.text)
        .map(c => ({ id: c.id!, text: c.text! }));

      const cached = await getCachedSentiments(
        options.userId,
        options.videoId,
        commentsWithText
      );

      for (const [commentId, sentiment] of cached.entries()) {
        cachedSentiments.set(commentId, sentiment);
      }

      cacheHits = cachedSentiments.size;
      console.log(`[analyzeComments] Cache: ${cacheHits}/${comments.length} sentiments found`);
    } catch (err) {
      console.error('[analyzeComments] Error loading cached sentiments:', err);
      // Continue without cache on error
    }
  }

  // Step 1: Run heuristic classifier on all comments (excluding cached)
  const commentsToAnalyze = comments.filter(c => !cachedSentiments.has(c.id || ''));
  console.log(`[analyzeComments] Running heuristic classifier on ${commentsToAnalyze.length} comments (${cacheHits} cached)`);

  const heuristicResults = new Map<number, { category: Category; sentiment: SentimentScore }>();
  const uncertainComments: Array<{ id: string; text: string; originalIndex: number }> = [];

  // Only run heuristics on comments that aren't cached
  for (let i = 0; i < comments.length; i++) {
    const comment = comments[i];

    // Skip if we have cached sentiment for this comment
    if (cachedSentiments.has(comment.id || '')) {
      continue;
    }

    const text = comment.text ?? "";
    const heuristic = heuristicClassify(text);

    if (heuristic.type === "confident") {
      heuristicResults.set(i, {
        category: heuristic.category,
        sentiment: heuristic.sentiment,
      });
    } else {
      uncertainComments.push({
        id: comment.id ?? `unknown_${i}`,
        text,
        originalIndex: i,
      });
    }
  }

  console.log(`[analyzeComments] Heuristics: ${heuristicResults.size} confident, ${uncertainComments.length} uncertain (need GPT)`);

  // Step 2: Send only uncertain comments to GPT in batches
  const aiAnalysisMap = new Map<number, { category: Category; sentiment: SentimentScore; topics: string[]; intent: string }>();

  if (uncertainComments.length > 0) {
    const batches: Array<{ id: string; text: string; originalIndex: number }[]> = [];
    for (let i = 0; i < uncertainComments.length; i += BATCH_SIZE) {
      batches.push(uncertainComments.slice(i, i + BATCH_SIZE));
    }

    console.log(`[analyzeComments] Processing ${uncertainComments.length} uncertain comments in ${batches.length} GPT batches of ${BATCH_SIZE}`);

    // Process batches in parallel with jitter (limited by withGate in llm.ts)
    const batchResults = await Promise.all(
      batches.map(async (batch, idx) => {
        // Add small jitter delay between batch starts to avoid rate-limit spikes
        if (idx > 0) {
          await jitterDelay(30, 70); // 30-100ms jitter
        }
        console.log(`[analyzeComments] Processing GPT batch ${idx + 1}/${batches.length} (${batch.length} comments)`);
        return await classifyCommentsBatch(batch);
      })
    );

    // Flatten batch results
    batchResults.forEach((batchResult) => {
      batchResult.forEach((result) => {
        if (result) {
          // Find original index from the batch
          const batchItem = uncertainComments.find(item => item.id === result.id);
          if (batchItem) {
            aiAnalysisMap.set(batchItem.originalIndex, {
              category: result.category,
              sentiment: result.sentiment,
              topics: result.topics,
              intent: result.intent,
            });
          }
        }
      });
    });

    console.log(`[analyzeComments] GPT analysis succeeded for ${aiAnalysisMap.size}/${uncertainComments.length} uncertain comments`);
  }

  // Step 3: Build final results, merging cached, heuristic, and GPT results
  const results: Analysis[] = [];
  const newSentimentsToStore: Array<{
    commentId: string;
    text: string;
    sentiment: SentimentScore;
    category: Category;
    topics: string[];
    intent: string;
    toxicity: number;
  }> = [];

  for (let i = 0; i < comments.length; i++) {
    const comment = comments[i];
    const baseText = comment.text ?? "";

    // Check cached sentiment first
    const cached = cachedSentiments.get(comment.id || '');
    if (cached) {
      // Use cached sentiment result
      results.push({
        commentId: comment.id ?? 'unknown',
        sentiment: cached.sentiment,
        topics: cached.topics,
        intent: cached.intent,
        toxicity: cached.toxicity,
        category: cached.category,
      });
      continue;
    }

    // Check heuristic results, then GPT results
    const heuristicResult = heuristicResults.get(i);
    const aiAnalysis = aiAnalysisMap.get(i);

    if (heuristicResult) {
      // Use heuristic classification (confident, no GPT needed)
      let { category, sentiment } = heuristicResult;

      const topics = extractTopics(baseText);
      const intent = determineIntent(category);
      let toxicity = calculateToxicity(category, sentiment);

      // Apply moderation overrides
      const moderated = await applyModerationOverrides(baseText, category, toxicity);
      category = moderated.category;
      toxicity = moderated.toxicity;

      results.push({
        commentId: comment.id ?? 'unknown',
        sentiment,
        topics,
        intent,
        toxicity,
        category
      });

      // Collect for storage
      if (comment.id && comment.text) {
        newSentimentsToStore.push({
          commentId: comment.id,
          text: comment.text,
          sentiment,
          category,
          topics,
          intent,
          toxicity,
        });
      }
    } else if (aiAnalysis) {
      // Use GPT analysis results (uncertain comments needed AI)
      let { category, sentiment, topics, intent } = aiAnalysis;

      let toxicity = calculateToxicity(category, sentiment);

      // Apply moderation overrides
      const moderated = await applyModerationOverrides(baseText, category, toxicity);
      category = moderated.category;
      toxicity = moderated.toxicity;

      results.push({
        commentId: comment.id ?? 'unknown',
        sentiment,
        topics: topics.length > 0 ? topics : ["general"],
        intent,
        toxicity,
        category
      });

      // Collect for storage
      if (comment.id && comment.text) {
        newSentimentsToStore.push({
          commentId: comment.id,
          text: comment.text,
          sentiment,
          category,
          topics: topics.length > 0 ? topics : ["general"],
          intent,
          toxicity,
        });
      }
    } else {
      // Fallback: All analysis methods failed, use keyword-based classification
      console.log(`[analyzeComments] Using fallback for comment ${i}`);
      let category = classifyCategory(baseText);
      const sentiment = getFallbackSentiment(category);
      let toxicity = calculateToxicity(category, sentiment);

      // Apply moderation overrides
      const moderated = await applyModerationOverrides(baseText, category, toxicity);
      category = moderated.category;
      toxicity = moderated.toxicity;

      const topics = extractTopics(baseText);
      const intent = determineIntent(category);

      results.push({
        commentId: comment.id ?? 'unknown',
        sentiment,
        topics,
        intent,
        toxicity,
        category
      });

      // Collect for storage
      if (comment.id && comment.text) {
        newSentimentsToStore.push({
          commentId: comment.id,
          text: comment.text,
          sentiment,
          category,
          topics,
          intent,
          toxicity,
        });
      }
    }
  }

  // Step 4: Store new sentiment results for future reuse
  if (options?.userId && options?.videoId && newSentimentsToStore.length > 0) {
    try {
      const { storeSentiments } = await import('./db/comment-sentiments.js');
      await storeSentiments(options.userId, options.videoId, newSentimentsToStore);
      console.log(`[analyzeComments] Stored ${newSentimentsToStore.length} new sentiment results for future reuse`);
    } catch (err) {
      console.error('[analyzeComments] Error storing sentiment results:', err);
      // Don't fail the analysis if storage fails
    }
  }

  return results;
}

// ============================================================================
// Reply Generation
// ============================================================================

/**
 * Generate AI-powered replies in multiple tones.
 *
 * Features:
 * - Multiple tone options (friendly, concise, enthusiastic)
 * - Optional tone profile matching (for Pro users)
 * - Fallback templates if AI fails
 * - Channel-safe content (no links, hashtags)
 *
 * @param comment - Comment to reply to
 * @param tones - Array of tone styles to generate
 * @param toneProfile - Optional learned tone profile for personalization
 * @returns Array of generated replies with tone labels
 */
export async function generateReplies(
  comment: Partial<TWComment>,
  tones: string[],
  toneProfile?: {
    tone: string;
    formality_level: string;
    emoji_usage: string;
    common_emojis?: string[];
    avg_reply_length: string;
    common_phrases?: string[];
    uses_name?: boolean;
    asks_questions?: boolean;
    uses_commenter_name?: boolean;
  }
): Promise<GeneratedReply[]> {
  const templates: Record<string, string> = {
    friendly: `Thanks so much for watching! 😊 I'm really glad you found it helpful!`,
    concise: `Thanks for watching!`,
    enthusiastic: `WOW! Thank you so much!! 🎉 Your support means the world to me!`,
  };

  const out: GeneratedReply[] = [];
  for (const tone of tones) {
    let sys = `You are Vocalytics, generating ultra-brief, channel-safe YouTube comment replies in the author's voice.
- Respect the requested TONE exactly (${tone}).
- Keep it under 220 characters.
- No hashtags, no links.
- Be kind, assume good faith.`;

    let prompt = `Original comment:\n"${comment?.text ?? ""}"\n\nWrite a single ${tone} reply.`;

    // If user has a tone profile (Pro users only), customize the prompt
    if (toneProfile) {
      sys = `You are generating a YouTube comment reply in the creator's authentic voice.

CREATOR'S WRITING STYLE:
- Overall tone: ${toneProfile.tone}
- Formality: ${toneProfile.formality_level}
- Emoji usage: ${toneProfile.emoji_usage}${toneProfile.common_emojis && toneProfile.common_emojis.length > 0 ? `\n- Favorite emojis: ${toneProfile.common_emojis.join(', ')}` : ''}
- Reply length: ${toneProfile.avg_reply_length}${toneProfile.common_phrases && toneProfile.common_phrases.length > 0 ? `\n- Common phrases: ${toneProfile.common_phrases.slice(0, 3).join(', ')}` : ''}
- ${toneProfile.uses_name ? 'Often signs with their name' : 'Does not sign with name'}
- ${toneProfile.asks_questions ? 'Often asks follow-up questions' : 'Rarely asks questions'}
- ${toneProfile.uses_commenter_name ? 'Addresses commenters by name' : 'Does not use commenter names'}

INSTRUCTIONS:
- Match the creator's tone and style exactly
- Use the same formality level, emoji frequency, and reply length
- Incorporate their common phrases naturally if relevant
- Keep it authentic to how they actually write
- No hashtags, no links
- Be kind, assume good faith`;

      prompt = `Comment author: ${comment.author}
Comment text: "${comment?.text ?? ""}"

Write a reply in the creator's authentic voice${tone !== 'auto' ? ` with a ${tone} tone` : ''}.`;
    }

    const llm = await chatReply(sys, prompt);

    out.push({
      tone,
      reply: (llm && llm.length <= 280 ? llm : (templates[tone] ?? templates.friendly ?? '')).trim(),
    });
  }
  return out;
}

export async function summarizeSentiment(analysis: Analysis[]): Promise<SentimentSummary> {
  const totalComments = analysis.length;

  const avg = analysis.reduce(
    (acc, a) => ({
      positive: acc.positive + a.sentiment.positive,
      negative: acc.negative + a.sentiment.negative,
      neutral: acc.neutral + a.sentiment.neutral
    }),
    { positive: 0, negative: 0, neutral: 0 }
  );
  avg.positive /= totalComments || 1;
  avg.negative /= totalComments || 1;
  avg.neutral  /= totalComments || 1;

  const counts: Record<Category, number> = {
    positive: 0, neutral: 0, constructive: 0, negative: 0, spam: 0
  };
  for (const a of analysis) counts[a.category] = (counts[a.category] ?? 0) + 1;

  const overallSentiment =
    avg.positive > 0.5
      ? "positive"
      : avg.negative > 0.5
      ? "negative"
      : avg.positive > avg.negative
      ? "mixed"
      : "neutral";

  const topicsMap = new Map<string, number>();
  for (const a of analysis) {
    for (const t of a.topics) {
      topicsMap.set(t, (topicsMap.get(t) || 0) + 1);
    }
  }
  const topTopics = Array.from(topicsMap.entries())
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const spamOrNeg = (counts.spam + counts.negative) / (totalComments || 1);
  const avgToxicity = analysis.reduce((s, a) => s + a.toxicity, 0) / (totalComments || 1);
  const toxicityLevel =
    avgToxicity > 0.5 || spamOrNeg > 0.5 ? "high" :
    avgToxicity > 0.2 || spamOrNeg > 0.25 ? "moderate" : "low";

  return {
    overallSentiment,
    averageScores: avg,
    totalComments,
    topTopics,
    toxicityLevel,
    counts
  };
}

// ============================================================================
// Legacy Aliases (Snake Case)
// ============================================================================
// These maintain backward compatibility with older parts of the codebase

export const fetch_comments = fetchComments;

export async function analyze_comments(input: { comments: TWComment[] } | TWComment[]): Promise<Analysis[]> {
  const arr = Array.isArray(input) ? input : input?.comments ?? [];
  return analyzeComments(arr);
}

export async function summarize_sentiment(input: { analysis: Analysis[] } | Analysis[]): Promise<SentimentSummary> {
  const arr = Array.isArray(input) ? input : input?.analysis ?? [];
  return summarizeSentiment(arr);
}

export async function generate_replies(input: { comment: TWComment; tones: string[] } | any): Promise<GeneratedReply[] | { fullData: GeneratedReply[] }> {
  const payload = input?.input ?? input;
  const { comment, tones } = payload ?? {};
  const out = await generateReplies(comment, tones ?? []);
  // Many callers expect { fullData: [...] }
  return { fullData: out };
}

// ---------------- Friendly *Tool adapters (Option B) ----------------
export async function analyzeCommentsTool(input: any) {
  const arr =
    Array.isArray(input) ? input :
    input?.comments ?? input?.items ?? input?.data ?? JSON.parse(input?.commentsJson ?? "[]");
  return analyze_comments({ comments: arr });
}

export async function summarizeSentimentTool(input: any) {
  const arr =
    Array.isArray(input) ? input :
    input?.analysis ?? input?.items ?? input?.data ?? input?.payload ?? [];
  return summarize_sentiment({ analysis: arr });
}

export async function fetchCommentsTool(args: any) {
  return fetch_comments(args);
}

export async function generateRepliesTool(input: any) {
  const payload = input?.input ?? input?.data ?? input;
  return generate_replies(payload);
}
 
