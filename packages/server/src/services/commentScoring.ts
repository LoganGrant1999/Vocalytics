import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

interface Comment {
  id: string;
  text: string;
  authorDisplayName: string;
  authorChannelId?: string;
  likeCount?: number;
  publishedAt: string;
  videoId: string;
}

interface VideoMetadata {
  title: string;
  description?: string;
  tags?: string[];
}

export interface ReplySettings {
  prioritize_subscribers: boolean;
  prioritize_questions: boolean;
  prioritize_title_keywords: boolean;
  prioritize_negative: boolean;
  prioritize_verified: boolean;
  prioritize_large_channels: boolean;
  prioritize_first_time: boolean;
  prioritize_popular: boolean;
  custom_keywords: string[];
  ignore_spam: boolean;
  ignore_generic_praise: boolean;
  ignore_links: boolean;
}

export interface CommentScore {
  commentId: string;
  priorityScore: number; // 0-100
  reasons: string[];
  shouldAutoReply: boolean;
  sentiment: 'positive' | 'neutral' | 'negative';
  isQuestion: boolean;
  isSpam: boolean;
}

/**
 * Batch analyze comments with AI (sentiment, questions, spam)
 * More efficient than one-by-one API calls
 */
async function batchAnalyzeComments(comments: Comment[]): Promise<Map<string, any>> {
  // Process in batches of 20 to avoid token limits
  const batchSize = 20;
  const resultMap = new Map();

  for (let i = 0; i < comments.length; i += batchSize) {
    const batch = comments.slice(i, i + batchSize);

    const prompt = `Analyze these YouTube comments and return JSON array with analysis for each:

${batch.map((c, idx) => `${idx}. "${c.text}"`).join('\n\n')}

For each comment, return:
{
  "index": 0,
  "sentiment": "positive" | "neutral" | "negative",
  "isQuestion": true/false,
  "isSpam": true/false,
  "containsKeywords": ["keyword1", "keyword2"]
}

Return ONLY a JSON object with an "analyses" array containing exactly ${batch.length} objects.`;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini', // Cheaper for bulk analysis
        messages: [
          {
            role: 'system',
            content: 'You are a comment analyzer. Return valid JSON only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      const analyses = result.analyses || [];

      // Map back to comment IDs
      analyses.forEach((analysis: any, index: number) => {
        if (batch[index]?.id) {
          resultMap.set(batch[index].id, analysis);
        }
      });
    } catch (error) {
      console.error('[commentScoring] Batch analysis failed:', error);
      // Fallback: mark all as neutral
      batch.forEach(comment => {
        resultMap.set(comment.id, {
          sentiment: 'neutral',
          isQuestion: false,
          isSpam: false,
          containsKeywords: []
        });
      });
    }
  }

  return resultMap;
}

/**
 * Check if comment text is generic praise
 */
function isGenericPraise(text: string): boolean {
  const generic = [
    /^(great|nice|good|cool|awesome|amazing) video!?$/i,
    /^love (it|this)!?$/i,
    /^❤️+$/,
    /^👍+$/,
    /^first!?$/i,
    /^thank you!?$/i,
  ];
  return generic.some(pattern => pattern.test(text.trim()));
}

/**
 * Check if comment contains video title keywords
 */
function containsTitleKeywords(
  commentText: string,
  videoTitle: string,
  customKeywords: string[]
): string[] {
  const allKeywords = [
    ...videoTitle.toLowerCase().split(' ').filter(w => w.length > 3),
    ...customKeywords.map(k => k.toLowerCase())
  ];

  const found: string[] = [];
  const lowerComment = commentText.toLowerCase();

  allKeywords.forEach(keyword => {
    if (lowerComment.includes(keyword)) {
      found.push(keyword);
    }
  });

  return found;
}

/**
 * Score a single comment based on user's priority settings
 */
export async function scoreComments(
  comments: Comment[],
  videoMetadata: VideoMetadata,
  settings: ReplySettings,
  userId: string
): Promise<CommentScore[]> {

  // 1. Batch analyze with AI
  const analyses = await batchAnalyzeComments(comments);

  // 2. Score each comment
  const scores: CommentScore[] = [];

  for (const comment of comments) {
    let score = 0;
    const reasons: string[] = [];
    const analysis = analyses.get(comment.id) || {
      sentiment: 'neutral',
      isQuestion: false,
      isSpam: false,
      containsKeywords: []
    };

    // AUTO-IGNORE RULES (override to 0)
    if (settings.ignore_spam && analysis.isSpam) {
      scores.push({
        commentId: comment.id,
        priorityScore: 0,
        reasons: ['Flagged as likely spam'],
        shouldAutoReply: false,
        sentiment: analysis.sentiment,
        isQuestion: analysis.isQuestion,
        isSpam: true
      });
      continue;
    }

    if (settings.ignore_generic_praise && isGenericPraise(comment.text)) {
      scores.push({
        commentId: comment.id,
        priorityScore: 0,
        reasons: ['Generic praise with no substance'],
        shouldAutoReply: false,
        sentiment: analysis.sentiment,
        isQuestion: analysis.isQuestion,
        isSpam: false
      });
      continue;
    }

    if (settings.ignore_links && comment.text.match(/https?:\/\//)) {
      scores.push({
        commentId: comment.id,
        priorityScore: 0,
        reasons: ['Contains link (often spam)'],
        shouldAutoReply: false,
        sentiment: analysis.sentiment,
        isQuestion: analysis.isQuestion,
        isSpam: false
      });
      continue;
    }

    // PRIORITY SCORING

    // Questions are high priority
    if (settings.prioritize_questions && analysis.isQuestion) {
      score += 25;
      reasons.push('Contains a question');
    }

    // Negative sentiment needs damage control
    if (settings.prioritize_negative && analysis.sentiment === 'negative') {
      score += 30;
      reasons.push('Negative sentiment - needs attention');
    }

    // Title keywords indicate relevance
    if (settings.prioritize_title_keywords) {
      const keywords = containsTitleKeywords(
        comment.text,
        videoMetadata.title,
        settings.custom_keywords || []
      );
      if (keywords.length > 0) {
        score += 15;
        reasons.push(`Mentions: ${keywords.join(', ')}`);
      }
    }

    // Popular comments (community engagement)
    if (settings.prioritize_popular && (comment.likeCount || 0) >= 5) {
      score += 10;
      reasons.push(`${comment.likeCount} likes from community`);
    }

    // TODO: Add these when YouTube API supports it:
    // - prioritize_subscribers (need to check if commenter is subscribed)
    // - prioritize_verified (check author channel)
    // - prioritize_large_channels (fetch author sub count)
    // - prioritize_first_time (check if first comment on channel)

    const shouldAutoReply = score >= 25; // Threshold for auto-suggestion

    scores.push({
      commentId: comment.id,
      priorityScore: score,
      reasons,
      shouldAutoReply,
      sentiment: analysis.sentiment,
      isQuestion: analysis.isQuestion,
      isSpam: false
    });
  }

  // 3. Save to database for caching
  await saveCommentScores(userId, scores, comments);

  return scores.sort((a, b) => b.priorityScore - a.priorityScore);
}

/**
 * Save scores to database
 */
async function saveCommentScores(
  userId: string,
  scores: CommentScore[],
  comments: Comment[]
): Promise<void> {
  const records = scores.map(score => {
    const comment = comments.find(c => c.id === score.commentId)!;
    return {
      user_id: userId,
      comment_id: score.commentId,
      video_id: comment.videoId,
      priority_score: score.priorityScore,
      reasons: score.reasons,
      should_auto_reply: score.shouldAutoReply,
      comment_text: comment.text,
      author_name: comment.authorDisplayName,
      author_channel_id: comment.authorChannelId,
      like_count: comment.likeCount || 0,
      published_at: comment.publishedAt,
      sentiment: score.sentiment,
      is_question: score.isQuestion,
      is_spam: score.isSpam,
      scored_at: new Date().toISOString()
    };
  });

  await supabase
    .from('comment_scores')
    .upsert(records, { onConflict: 'user_id,comment_id' });
}

/**
 * Get user's reply settings
 */
export async function getReplySettings(userId: string): Promise<ReplySettings> {
  const { data } = await supabase
    .from('reply_settings')
    .select('*')
    .eq('user_id', userId)
    .single();

  // Return defaults if not found
  return data || {
    prioritize_subscribers: true,
    prioritize_questions: true,
    prioritize_title_keywords: true,
    prioritize_negative: true,
    prioritize_verified: false,
    prioritize_large_channels: false,
    prioritize_first_time: false,
    prioritize_popular: false,
    custom_keywords: [],
    ignore_spam: true,
    ignore_generic_praise: false,
    ignore_links: true
  };
}
