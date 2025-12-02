// packages/server/src/llm.ts
//
// OpenAI API integration with batching, rate limiting, and hierarchical summarization.
// Handles sentiment analysis, moderation, and comment summarization.

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

// ============================================================================
// Environment Configuration
// ============================================================================

const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";
const CHAT_MODEL = process.env.REPLIES_MODEL ?? "gpt-4o-mini";
const MODERATION_MODEL = process.env.MODERATION_MODEL ?? "omni-moderation-latest";

// Optional debug logging (enable with LOG_LLM=1)
const LOG_LLM = process.env.LOG_LLM === "1";
function logLLM(msg: string, meta?: Record<string, unknown>) {
  if (!LOG_LLM) return;
  try {
    console.error(`[llm] ${msg}`, meta ? JSON.stringify(meta) : "");
  } catch { /* ignore */ }
}

// ============================================================================
// Concurrency Control
// ============================================================================

// Configurable batch and concurrency settings
export const DEFAULT_BATCH_SIZE = Number(process.env.BATCH_SIZE ?? 25);
export const DEFAULT_MAX_PARALLEL = Number(process.env.OPENAI_MAX_PARALLEL ?? 4);
export const PRO_MAX_PARALLEL = Number(process.env.PRO_OPENAI_MAX_PARALLEL ?? 8);

// Active request tracking for rate limiting
let inFlight = 0;
let maxParallel = DEFAULT_MAX_PARALLEL;

/**
 * Set max parallel requests based on user tier.
 * Pro users get 2x concurrency for faster analysis.
 */
export function setMaxParallel(isPro: boolean): void {
  maxParallel = isPro ? PRO_MAX_PARALLEL : DEFAULT_MAX_PARALLEL;
  logLLM(`Max parallel set to ${maxParallel} (isPro: ${isPro})`);
}

/**
 * Get current max parallel setting.
 */
export function getMaxParallel(): number {
  return maxParallel;
}

// ============================================================================
// Utility Functions
// ============================================================================

/** Sleep helper for delays and retries */
async function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Concurrency gate to limit parallel OpenAI requests.
 * Prevents rate limit errors by queuing requests when at capacity.
 */
async function withGate<T>(fn: () => Promise<T>): Promise<T> {
  while (inFlight >= maxParallel) {
    await sleep(25);
  }
  inFlight++;
  try {
    return await fn();
  } finally {
    inFlight--;
  }
}

/**
 * Add random jitter delay to prevent thundering herd problem.
 * Spreads request starts over time to avoid rate-limit spikes.
 */
async function jitterDelay(baseMs: number = 50, varianceMs: number = 100): Promise<void> {
  const delay = baseMs + Math.floor(Math.random() * varianceMs);
  await sleep(delay);
}

/**
 * Safe fetch with retry logic, timeout, and concurrency control.
 * All OpenAI API calls should use this function.
 *
 * Features:
 * - Automatic retry on 429 (rate limit) and 5xx errors
 * - Configurable timeout (default 12s)
 * - Concurrency limiting via withGate
 * - Exponential backoff with jitter
 */
async function safeFetch(url: string, init: RequestInit, timeoutMs = 12000): Promise<Response> {
  return withGate(async () => {
    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), timeoutMs);
    const maxAttempts = 2; // Initial try + 1 retry
    let lastErr: any;

    try {
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const res = await fetch(url, { ...init, signal: ac.signal });

          // Retry on rate limits or server errors
          if (res.status >= 500 || res.status === 429) {
            if (attempt < maxAttempts) {
              logLLM("retrying openai", { url, status: res.status, attempt });
              const jitter = 100 + Math.floor(Math.random() * 200);
              await sleep(jitter);
              continue;
            }
          } else if (!res.ok) {
            logLLM("openai non-ok", { url, status: res.status });
          }

          return res;
        } catch (e) {
          lastErr = e;
          if (attempt < maxAttempts) {
            logLLM("retrying openai after error", { url, attempt });
            const jitter = 100 + Math.floor(Math.random() * 200);
            await sleep(jitter);
            continue;
          }
          throw e;
        }
      }
      throw lastErr ?? new Error("safeFetch: unknown error");
    } finally {
      clearTimeout(timeout);
    }
  });
}

// ============================================================================
// Moderation API
// ============================================================================

/**
 * Uses OpenAI moderation endpoint to flag inappropriate content.
 */
export async function moderateText(text: string): Promise<{
  flagged: boolean;
  category?: "spam" | "negative" | "harassment" | "self-harm" | "sexual" | "violence" | "hate";
  score?: number;
}> {
  if (!OPENAI_API_KEY) return { flagged: false };

  try {
    const res = await safeFetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODERATION_MODEL,
        input: text,
      }),
    });

    if (!res.ok) {
      console.error("moderateText status:", res.status, await res.text());
      return { flagged: false };
    }

    const json: any = await res.json();
    const r = json?.results?.[0];
    if (!r) return { flagged: false };

    const scores = r.category_scores ?? {};
    const pick = Object.entries(scores).sort((a: any, b: any) => b[1] - a[1])[0];
    const topCat = (pick?.[0] ?? "") as string;

    const map: Record<string, any> = {
      "harassment": "harassment",
      "harassment/threats": "harassment",
      "hate": "hate",
      "hate/threats": "hate",
      "self-harm": "self-harm",
      "sexual/minors": "sexual",
      "sexual": "sexual",
      "violence": "violence",
      "violence/graphic": "violence",
      "self-harm/intent": "self-harm",
      "self-harm/instructions": "self-harm",
      "sexual/violent": "sexual",
      "spam": "spam", // not standard, but caught elsewhere
    };

    return {
      flagged: !!r.flagged,
      category: map[topCat] ?? undefined,
      score: typeof pick?.[1] === "number" ? pick[1] : undefined,
    };
  } catch (err) {
    console.error("moderateText error:", err);
    return { flagged: false };
  }
}

// ============================================================================
// Chat Completions
// ============================================================================

/**
 * Generate a contextual reply using OpenAI chat completions.
 * Used for AI-powered comment replies.
 */
export async function chatReply(system: string, user: string): Promise<string | null> {
  if (!OPENAI_API_KEY) {
    console.warn("chatReply: OPENAI_API_KEY not set, returning null");
    return null;
  }

  try {
    const res = await safeFetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ] as ChatMessage[],
        temperature: 0.7,
        max_tokens: 180,
      }),
    });

    if (!res.ok) {
      console.error("chatReply status:", res.status, await res.text());
      return null;
    }

    const json: any = await res.json();
    const text: string | undefined = json?.choices?.[0]?.message?.content;
    if (typeof text === "string" && text.trim()) {
      return text.trim();
    }

    console.warn("chatReply: empty response from OpenAI");
    return null;
  } catch (err) {
    console.error("chatReply error:", err);
    return null;
  }
}

// ============================================================================
// Comment Summary Generation
// ============================================================================

/**
 * Generates a comprehensive AI summary of video comments.
 * Uses sampling for speed - analyzes up to 30 representative comments.
 * Optimized for <5 second response time regardless of total comment count.
 */
export async function generateCommentSummary(
  comments: Array<{ text: string }>,
  sentiment: { pos: number; neu: number; neg: number }
): Promise<string | null> {
  if (!OPENAI_API_KEY || comments.length === 0) {
    return null;
  }

  try {
    // OPTIMIZED: Sample representative comments for speed (single API call)
    // Instead of processing all comments or using hierarchical summarization,
    // we sample the most representative comments from each sentiment category
    console.log(`[generateCommentSummary] Sampling representative comments from ${comments.length} total`);

    // Sample up to 30 representative comments (mix of different lengths and sentiments)
    const maxSamples = 30;
    let sampleComments: Array<{ text: string }> = [];

    if (comments.length <= maxSamples) {
      // Use all comments if we have fewer than maxSamples
      sampleComments = comments;
    } else {
      // Sample evenly across the dataset
      const step = Math.floor(comments.length / maxSamples);
      for (let i = 0; i < comments.length && sampleComments.length < maxSamples; i += step) {
        sampleComments.push(comments[i]);
      }

      // Add a few random comments for variety
      const randomIndices = new Set<number>();
      while (randomIndices.size < Math.min(5, comments.length - sampleComments.length)) {
        randomIndices.add(Math.floor(Math.random() * comments.length));
      }
      randomIndices.forEach(idx => {
        if (sampleComments.length < maxSamples) {
          sampleComments.push(comments[idx]);
        }
      });
    }

    console.log(`[generateCommentSummary] Using ${sampleComments.length} sample comments out of ${comments.length} total`);

    const commentText = sampleComments
      .map((c) => c.text)
      .join('\n---\n');

    const system = `You are an expert at analyzing YouTube comment sentiment and themes. Generate a concise 2-3 sentence summary of the overall comment sentiment and key themes. Focus on what viewers are saying, common feedback patterns, and notable reactions. Be specific and actionable.

CRITICAL RULE: NEVER include any percentages, numbers, or statistics in your response. Use ONLY qualitative descriptive terms like "overwhelmingly", "mostly", "many", "some", "a few", "mixed", "predominantly", etc.`;

    const user = `Analyze these ${comments.length} YouTube comments (${sampleComments.length} representative samples shown) and provide a brief summary:

Sample Comments:
${commentText}

Provide a 2-3 sentence summary of the key themes and overall sentiment. Do NOT include any numbers or percentages - only use descriptive words.`;

    const res = await safeFetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ] as ChatMessage[],
        temperature: 0.7,
        max_tokens: 150, // Reduced from 300 for faster response
      }),
    });

    if (!res.ok) {
      console.error("generateCommentSummary status:", res.status, await res.text());
      return null;
    }

    const json: any = await res.json();
    const text: string | undefined = json?.choices?.[0]?.message?.content;

    if (typeof text === "string" && text.trim()) {
      return text.trim();
    }

    console.warn("generateCommentSummary: empty response from OpenAI");
    return null;
  } catch (err) {
    console.error("generateCommentSummary error:", err);
    return null;
  }
}

// ============================================================================
// Batch Sentiment Analysis
// ============================================================================

/**
 * Batch analyze multiple comments in a single OpenAI call.
 * Processes up to 50 comments per batch for optimal performance.
 *
 * @param items - Array of comments with id and text
 * @returns Array of sentiment results (null for failed analyses)
 */
export async function classifyCommentsBatch(
  items: Array<{ id: string; text: string }>
): Promise<Array<{
  id: string;
  category: "positive" | "neutral" | "constructive" | "negative" | "spam";
  sentiment: { positive: number; neutral: number; negative: number };
  topics: string[];
  intent: string;
} | null>> {
  if (!OPENAI_API_KEY || items.length === 0) {
    return items.map(() => null);
  }

  try {
    // Build batch input as numbered list
    const batchInput = items
      .map((item, idx) => `[${idx}] ID: ${item.id}\nText: ${item.text}`)
      .join('\n\n');

    const system = `You are a sentiment analysis expert for YouTube comments. Analyze ALL comments in the batch and respond with ONLY a valid JSON array (no markdown, no extra text).

For each comment, provide an object with this structure:
{
  "id": "comment_id_from_input",
  "category": "positive" | "neutral" | "constructive" | "negative" | "spam",
  "sentiment": { "positive": 0-1, "neutral": 0-1, "negative": 0-1 },
  "topics": ["topic1", "topic2"],
  "intent": "appreciation" | "suggestion" | "critique" | "promotion" | "question" | "other"
}

Categories:
- positive: supportive, appreciative, enthusiastic, loving
- constructive: helpful suggestions, constructive feedback
- negative: complaints, harsh criticism, hate
- spam: promotional links, off-topic ads
- neutral: general observations, questions

Be generous with positive sentiment - phrases like "I love my mom!" should be clearly positive (0.85+).
Sentiment scores should sum to 1.0.

Return a JSON array with one object per comment, in the same order as input.`;

    const res = await safeFetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: batchInput },
        ] as ChatMessage[],
        temperature: 0.3,
        max_tokens: items.length * 100, // ~100 tokens per comment result
      }),
    }, 10000); // 10 second timeout for batch processing (fallback to heuristics after)

    if (!res.ok) {
      console.error("classifyCommentsBatch status:", res.status, await res.text());
      return items.map(() => null);
    }

    const json: any = await res.json();
    const responseText: string | undefined = json?.choices?.[0]?.message?.content;

    if (!responseText) {
      console.warn("classifyCommentsBatch: empty response from OpenAI");
      return items.map(() => null);
    }

    // Parse JSON array response
    const parsed = JSON.parse(responseText.trim());

    if (!Array.isArray(parsed)) {
      console.error("classifyCommentsBatch: response is not an array");
      return items.map(() => null);
    }

    // Normalize and validate each result
    const results = items.map((item) => {
      const match = parsed.find((p: any) => p.id === item.id);
      if (!match) return null;

      // Normalize sentiment scores to sum to 1.0
      const total = match.sentiment.positive + match.sentiment.neutral + match.sentiment.negative;
      if (total > 0) {
        match.sentiment.positive /= total;
        match.sentiment.neutral /= total;
        match.sentiment.negative /= total;
      }

      return {
        id: match.id,
        category: match.category,
        sentiment: match.sentiment,
        topics: Array.isArray(match.topics) ? match.topics : ["general"],
        intent: match.intent || "other",
      };
    });

    return results;
  } catch (err) {
    console.error("classifyCommentsBatch error:", err);
    return items.map(() => null);
  }
}

/**
 * Uses OpenAI to analyze sentiment and categorize a comment.
 * Returns category and sentiment scores based on AI analysis.
 * @deprecated Use classifyCommentsBatch for better performance
 */
export async function analyzeSentiment(text: string): Promise<{
  category: "positive" | "neutral" | "constructive" | "negative" | "spam";
  sentiment: { positive: number; neutral: number; negative: number };
  topics: string[];
  intent: string;
} | null> {
  if (!OPENAI_API_KEY) {
    return null;
  }

  try {
    const system = `You are a sentiment analysis expert for YouTube comments. Analyze the comment and respond with ONLY a valid JSON object (no markdown, no extra text) with this exact structure:
{
  "category": "positive" | "neutral" | "constructive" | "negative" | "spam",
  "sentiment": { "positive": 0-1, "neutral": 0-1, "negative": 0-1 },
  "topics": ["topic1", "topic2"],
  "intent": "appreciation" | "suggestion" | "critique" | "promotion" | "question" | "other"
}

Categories:
- positive: supportive, appreciative, enthusiastic, loving
- constructive: helpful suggestions, constructive feedback
- negative: complaints, harsh criticism, hate
- spam: promotional links, off-topic ads
- neutral: general observations, questions

Be generous with positive sentiment - phrases like "I love my mom!" should be clearly positive (0.85+).
Sentiment scores should sum to 1.0.`;

    const res = await safeFetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: text },
        ] as ChatMessage[],
        temperature: 0.3,
        max_tokens: 200,
      }),
    });

    if (!res.ok) {
      console.error("analyzeSentiment status:", res.status, await res.text());
      return null;
    }

    const json: any = await res.json();
    const responseText: string | undefined = json?.choices?.[0]?.message?.content;

    if (!responseText) {
      console.warn("analyzeSentiment: empty response from OpenAI");
      return null;
    }

    // Parse JSON response
    const parsed = JSON.parse(responseText.trim());

    // Validate and normalize sentiment scores
    const total = parsed.sentiment.positive + parsed.sentiment.neutral + parsed.sentiment.negative;
    if (total > 0) {
      parsed.sentiment.positive /= total;
      parsed.sentiment.neutral /= total;
      parsed.sentiment.negative /= total;
    }

    return parsed;
  } catch (err) {
    console.error("analyzeSentiment error:", err);
    return null;
  }
}
