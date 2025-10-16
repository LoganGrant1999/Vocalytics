import { htmlToText } from './types.js';
import { chatReply, moderateText, analyzeSentiment } from './llm.js';
// ---------------- Local helpers ----------------
const byPublishedDesc = (a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt);
const byLikesDesc = (a, b) => (b.likeCount ?? 0) - (a.likeCount ?? 0);
// Very small keyword heuristics to diversify categories for fixtures
function classifyCategory(text) {
    const t = text.toLowerCase();
    // spam-like
    if (/\bfree\b/.test(t) || /https?:\/\//.test(t))
        return "spam";
    // constructive / suggestion-y
    if (t.includes("constructive") || t.includes("compressor") || t.includes("could you") || t.includes("suggest")) {
        return "constructive";
    }
    // negative-ish (check before positive to catch "hate")
    if (t.includes("meh") || t.includes("didn't") || t.includes("didnt") || t.includes("bad") || t.includes("terrible") || t.includes("awful") || t.includes("worst"))
        return "negative";
    // positive-ish (expanded list with more common positive expressions)
    if (t.includes("love") ||
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
        /👍|😊|😍|🎉|💯/.test(t)) {
        return "positive";
    }
    return "neutral";
}
/**
 * Maps a YouTube API item (thread or reply) to our canonical TWComment shape.
 */
function mapYouTubeItemToTWComment(item, parentId) {
    // Handles both thread items and reply items
    const top = item.snippet?.topLevelComment?.snippet ?? item.snippet ?? {};
    const id = item.id || item.snippet?.topLevelComment?.id || top.id || "";
    const videoId = top.videoId || item.snippet?.videoId || "";
    const author = top.authorDisplayName ??
        item.snippet?.authorDisplayName ??
        "Unknown";
    const rawText = top.textOriginal ??
        top.textDisplay ??
        item.snippet?.textOriginal ??
        item.snippet?.textDisplay ??
        "";
    const text = htmlToText(rawText).trim();
    const publishedAt = top.publishedAt ??
        item.snippet?.publishedAt ??
        new Date().toISOString();
    const likeCount = typeof top.likeCount === "number"
        ? top.likeCount
        : typeof item.snippet?.likeCount === "number"
            ? item.snippet.likeCount
            : 0;
    const replyCount = typeof item.snippet?.totalReplyCount === "number"
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
// ---------------- Core tool implementations ----------------
export async function fetchComments(videoId, channelId, max = 50, pageToken, includeReplies = false, order = "time") {
    if (!videoId && !channelId)
        throw new Error("Provide videoId or channelId");
    const accessToken = process.env.GOOGLE_ACCESS_TOKEN;
    // ---- MOCK (no token) ----
    if (!accessToken) {
        const all = [];
        for (let i = 1; i <= 120; i++) {
            const id = `mock_${i}`;
            const author = i % 5 === 0 ? "Casey" : i % 3 === 0 ? "Bob" : "Alice";
            const base = {
                id,
                videoId: videoId ?? "mock_video_id",
                author,
                text: i % 10 === 0
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
    // ---- REAL API (token present) ----
    const base = "https://www.googleapis.com/youtube/v3/commentThreads";
    const params = {
        part: includeReplies ? "snippet,replies" : "snippet",
        textFormat: "plainText",
        order,
        maxResults: String(Math.min(100, Math.max(1, max)))
    };
    if (videoId)
        params.videoId = videoId;
    if (channelId)
        params.channelId = channelId;
    if (pageToken)
        params.pageToken = pageToken;
    const url = `${base}?${new URLSearchParams(params).toString()}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) {
        const body = await res.text();
        throw new Error(`YouTube API error ${res.status}: ${body}`);
    }
    const json = await res.json();
    const comments = [];
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
    }
    else {
        comments.sort(byLikesDesc);
    }
    return {
        comments,
        nextPageToken: json.nextPageToken
    };
}
export async function analyzeComments(comments) {
    const results = [];
    for (const comment of comments) {
        const baseText = comment.text ?? "";
        // Try AI-based sentiment analysis first
        console.log('[analyzeComments] Analyzing comment:', baseText.substring(0, 100));
        const aiAnalysis = await analyzeSentiment(baseText);
        console.log('[analyzeComments] AI analysis result:', aiAnalysis);
        if (aiAnalysis) {
            // Use AI analysis results
            let { category, sentiment, topics, intent } = aiAnalysis;
            // Calculate toxicity based on category and sentiment
            let toxicity = category === "spam" ? 0.7 :
                category === "negative" ? Math.max(0.4, sentiment.negative) :
                    category === "constructive" ? 0.15 :
                        sentiment.negative * 0.6;
            // First-pass moderation (best-effort) - override if needed
            const mod = await moderateText(baseText);
            if (mod.flagged) {
                if (mod.category === "hate" || mod.category === "violence" || mod.category === "harassment") {
                    category = "negative";
                    toxicity = Math.max(toxicity, 0.6);
                }
                else if (mod.category === "sexual" || mod.category === "self-harm") {
                    category = "negative";
                    toxicity = Math.max(toxicity, 0.7);
                }
            }
            // URL heuristic → spam override
            if (/\bhttps?:\/\//.test(baseText)) {
                category = "spam";
                toxicity = Math.max(toxicity, 0.7);
            }
            results.push({
                commentId: comment.id,
                sentiment,
                topics: topics.length > 0 ? topics : ["general"],
                intent,
                toxicity,
                category
            });
        }
        else {
            // Fallback to keyword-based classification if AI fails
            let category = classifyCategory(baseText);
            let toxicity = category === "spam" ? 0.7 :
                category === "negative" ? 0.4 :
                    category === "constructive" ? 0.15 : 0.05;
            // First-pass moderation (best-effort)
            const mod = await moderateText(baseText);
            if (mod.flagged) {
                if (mod.category === "hate" || mod.category === "violence" || mod.category === "harassment") {
                    category = "negative";
                    toxicity = Math.max(toxicity, 0.6);
                }
                else if (mod.category === "sexual" || mod.category === "self-harm") {
                    category = "negative";
                    toxicity = Math.max(toxicity, 0.7);
                }
            }
            // URL heuristic → spam
            if (/\bhttps?:\/\//.test(baseText) || /\bfree\b/i.test(baseText)) {
                category = "spam";
                toxicity = Math.max(toxicity, 0.7);
            }
            const sentiment = (() => {
                switch (category) {
                    case "positive": return { positive: 0.85, neutral: 0.1, negative: 0.05 };
                    case "constructive": return { positive: 0.45, neutral: 0.35, negative: 0.2 };
                    case "negative": return { positive: 0.1, neutral: 0.2, negative: 0.7 };
                    case "spam": return { positive: 0.05, neutral: 0.15, negative: 0.8 };
                    default: return { positive: 0.2, neutral: 0.7, negative: 0.1 };
                }
            })();
            const topics = (() => {
                const t = [];
                const low = baseText.toLowerCase();
                if (low.includes("audio"))
                    t.push("audio");
                if (low.includes("compressor"))
                    t.push("post-processing");
                if (low.includes("timestamp"))
                    t.push("timestamps");
                if (t.length === 0)
                    t.push("general");
                return t;
            })();
            const intent = category === "constructive" ? "suggestion" :
                category === "negative" ? "critique" :
                    category === "spam" ? "promotion" :
                        "appreciation";
            results.push({
                commentId: comment.id,
                sentiment,
                topics,
                intent,
                toxicity,
                category
            });
        }
    }
    return results;
}
export async function generateReplies(comment, tones) {
    const templates = {
        friendly: `Thanks so much for watching! 😊 I'm really glad you found it helpful!`,
        concise: `Thanks for watching!`,
        enthusiastic: `WOW! Thank you so much!! 🎉 Your support means the world to me!`,
    };
    const out = [];
    for (const tone of tones) {
        const sys = `You are Vocalytics, generating ultra-brief, channel-safe YouTube comment replies in the author's voice.
- Respect the requested TONE exactly (${tone}).
- Keep it under 220 characters.
- No hashtags, no links.
- Be kind, assume good faith.`;
        const prompt = `Original comment:\n"${comment?.text ?? ""}"\n\nWrite a single ${tone} reply.`;
        const llm = await chatReply(sys, prompt);
        out.push({
            tone,
            reply: (llm && llm.length <= 280 ? llm : (templates[tone] ?? templates.friendly)).trim(),
        });
    }
    return out;
}
export async function summarizeSentiment(analysis) {
    const totalComments = analysis.length;
    const avg = analysis.reduce((acc, a) => ({
        positive: acc.positive + a.sentiment.positive,
        negative: acc.negative + a.sentiment.negative,
        neutral: acc.neutral + a.sentiment.neutral
    }), { positive: 0, negative: 0, neutral: 0 });
    avg.positive /= totalComments || 1;
    avg.negative /= totalComments || 1;
    avg.neutral /= totalComments || 1;
    const counts = {
        positive: 0, neutral: 0, constructive: 0, negative: 0, spam: 0
    };
    for (const a of analysis)
        counts[a.category] = (counts[a.category] ?? 0) + 1;
    const overallSentiment = avg.positive > 0.5
        ? "positive"
        : avg.negative > 0.5
            ? "negative"
            : avg.positive > avg.negative
                ? "mixed"
                : "neutral";
    const topicsMap = new Map();
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
    const toxicityLevel = avgToxicity > 0.5 || spamOrNeg > 0.5 ? "high" :
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
// ---------------- Snake_case aliases (if other parts of code expect them) ----------------
export const fetch_comments = fetchComments;
export async function analyze_comments(input) {
    const arr = Array.isArray(input) ? input : input?.comments ?? [];
    return analyzeComments(arr);
}
export async function summarize_sentiment(input) {
    const arr = Array.isArray(input) ? input : input?.analysis ?? [];
    return summarizeSentiment(arr);
}
export async function generate_replies(input) {
    const payload = input?.input ?? input;
    const { comment, tones } = payload ?? {};
    const out = await generateReplies(comment, tones ?? []);
    // Many callers expect { fullData: [...] }
    return { fullData: out };
}
// ---------------- Friendly *Tool adapters (Option B) ----------------
export async function analyzeCommentsTool(input) {
    const arr = Array.isArray(input) ? input :
        input?.comments ?? input?.items ?? input?.data ?? JSON.parse(input?.commentsJson ?? "[]");
    return analyze_comments({ comments: arr });
}
export async function summarizeSentimentTool(input) {
    const arr = Array.isArray(input) ? input :
        input?.analysis ?? input?.items ?? input?.data ?? input?.payload ?? [];
    return summarize_sentiment({ analysis: arr });
}
export async function fetchCommentsTool(args) {
    return fetch_comments(args);
}
export async function generateRepliesTool(input) {
    const payload = input?.input ?? input?.data ?? input;
    return generate_replies(payload);
}
