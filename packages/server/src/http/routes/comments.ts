import { FastifyInstance } from 'fastify';
import { createClient } from '@supabase/supabase-js';
import { scoreComments, getReplySettings, ReplySettings } from '../../services/commentScoring.js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function commentsRoutes(fastify: FastifyInstance) {

  /**
   * GET /api/comments/settings - Get current priority settings
   */
  fastify.get('/comments/settings', async (request: any, reply) => {
    const auth = request.auth;
    const userId = auth?.userId || auth?.userDbId;

    if (!userId) {
      return reply.code(401).send({
        code: 'UNAUTHORIZED',
        message: 'Missing auth'
      });
    }

    try {
      const settings = await getReplySettings(userId);
      return reply.send({ settings });
    } catch (error: any) {
      console.error('[comments.ts] Error fetching settings:', error);
      return reply.code(500).send({
        code: 'INTERNAL_ERROR',
        message: error.message || 'Failed to fetch settings'
      });
    }
  });

  /**
   * PUT /api/comments/settings - Update reply priority settings (Pro only)
   */
  fastify.put('/comments/settings', async (request: any, reply) => {
    const auth = request.auth;
    const userId = auth?.userId || auth?.userDbId;

    if (!userId) {
      return reply.code(401).send({
        code: 'UNAUTHORIZED',
        message: 'Missing auth'
      });
    }

    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

      // Check if user is Pro
      const { data: profile } = await supabase
        .from('profiles')
        .select('tier')
        .eq('id', userId)
        .single();

      if (!profile || profile.tier !== 'pro') {
        return reply.code(403).send({
          code: 'FORBIDDEN',
          message: 'Priority settings are a Pro feature'
        });
      }

      const settings = request.body as Partial<ReplySettings>;

      await supabase
        .from('reply_settings')
        .upsert({
          user_id: userId,
          ...settings,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      return reply.send({ success: true });
    } catch (error: any) {
      console.error('[comments.ts] Error updating settings:', error);
      return reply.code(500).send({
        code: 'INTERNAL_ERROR',
        message: error.message || 'Failed to update settings'
      });
    }
  });

  /**
   * POST /api/comments/:videoId/score - Score comments for a video (Pro only)
   * Request body: { comments: Comment[] }
   */
  fastify.post('/comments/:videoId/score', async (request: any, reply) => {
    const auth = request.auth;
    const userId = auth?.userId || auth?.userDbId;
    const { videoId } = request.params;
    const { comments } = request.body;

    if (!userId) {
      return reply.code(401).send({
        code: 'UNAUTHORIZED',
        message: 'Missing auth'
      });
    }

    if (!comments || !Array.isArray(comments)) {
      return reply.code(400).send({
        code: 'BAD_REQUEST',
        message: 'Comments array required'
      });
    }

    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

      // Check if user is Pro
      const { data: profile } = await supabase
        .from('profiles')
        .select('tier')
        .eq('id', userId)
        .single();

      if (!profile || profile.tier !== 'pro') {
        return reply.code(403).send({
          code: 'FORBIDDEN',
          message: 'Comment scoring is a Pro feature'
        });
      }

      // Get user's reply settings
      const settings = await getReplySettings(userId);

      // Get video metadata (we need the title for keyword matching)
      // Try to get from database first, fallback to request body
      let videoTitle = request.body.videoTitle || 'Unknown Video';

      try {
        const { data: analysisData } = await supabase
          .from('analysis')
          .select('video_title')
          .eq('user_id', userId)
          .eq('video_id', videoId)
          .single();

        if (analysisData?.video_title) {
          videoTitle = analysisData.video_title;
        }
      } catch (err) {
        // Video not analyzed yet, use fallback
        console.log('[comments.ts] No analysis found for video, using fallback title');
      }

      // Score comments
      const scores = await scoreComments(
        comments,
        { title: videoTitle },
        settings,
        userId
      );

      // Merge scores with comments for convenience
      const scoredComments = comments.map((comment: any) => {
        const score = scores.find(s => s.commentId === comment.id);
        return {
          ...comment,
          priorityScore: score?.priorityScore || 0,
          reasons: score?.reasons || [],
          shouldAutoReply: score?.shouldAutoReply || false,
          sentiment: score?.sentiment || 'neutral',
          isQuestion: score?.isQuestion || false,
          isSpam: score?.isSpam || false
        };
      });

      return reply.send({
        comments: scoredComments,
        scoringEnabled: true,
        totalScored: scores.length
      });

    } catch (error: any) {
      console.error('[comments.ts] Error scoring comments:', error);
      return reply.code(500).send({
        code: 'INTERNAL_ERROR',
        message: error.message || 'Failed to score comments'
      });
    }
  });

  /**
   * GET /api/comments/:videoId/scores - Get cached scores for a video
   */
  fastify.get('/comments/:videoId/scores', async (request: any, reply) => {
    const auth = request.auth;
    const userId = auth?.userId || auth?.userDbId;
    const { videoId } = request.params;

    if (!userId) {
      return reply.code(401).send({
        code: 'UNAUTHORIZED',
        message: 'Missing auth'
      });
    }

    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

      const { data: scores, error } = await supabase
        .from('comment_scores')
        .select('*')
        .eq('user_id', userId)
        .eq('video_id', videoId)
        .order('priority_score', { ascending: false });

      if (error) {
        throw error;
      }

      return reply.send({
        scores: scores || [],
        count: scores?.length || 0
      });

    } catch (error: any) {
      console.error('[comments.ts] Error fetching scores:', error);
      return reply.code(500).send({
        code: 'INTERNAL_ERROR',
        message: error.message || 'Failed to fetch scores'
      });
    }
  });

  /**
   * GET /api/comments/inbox - Unified inbox across all videos
   * Query params: filter (optional) = 'high-priority' | 'unanswered' | 'negative' | 'all'
   */
  fastify.get('/comments/inbox', async (request: any, reply) => {
    const auth = request.auth;
    const userId = auth?.userId || auth?.userDbId;
    const { filter } = request.query as { filter?: string };

    if (!userId) {
      return reply.code(401).send({
        code: 'UNAUTHORIZED',
        message: 'Missing auth'
      });
    }

    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

      // Check user tier
      const { data: profile } = await supabase
        .from('profiles')
        .select('tier')
        .eq('id', userId)
        .single();

      const isPro = profile?.tier === 'pro';

      // For Pro users: fetch from comment_scores table with filters
      if (isPro) {
        let query = supabase
          .from('comment_scores')
          .select('*')
          .eq('user_id', userId);

        // Apply filters
        if (filter === 'high-priority') {
          query = query.gte('priority_score', 40);
        } else if (filter === 'negative') {
          query = query.eq('sentiment', 'negative');
        } else if (filter === 'unanswered') {
          // Comments without AI replies (assume we'll track this later)
          // For now, just return all
        }

        const { data: scores, error } = await query
          .order('priority_score', { ascending: false })
          .limit(100);

        if (error) throw error;

        // Transform to frontend format
        const comments = (scores || []).map((score: any) => ({
          id: score.comment_id,
          text: score.comment_text,
          authorDisplayName: score.author_name,
          likeCount: score.like_count,
          publishedAt: score.published_at,
          videoId: score.video_id,
          videoTitle: '', // Will be populated from analysis table
          priorityScore: score.priority_score,
          reasons: score.reasons,
          shouldAutoReply: score.should_auto_reply,
          sentiment: score.sentiment
        }));

        // Fetch video titles for context
        const videoIds = [...new Set(comments.map(c => c.videoId))];
        const { data: analyses } = await supabase
          .from('analysis')
          .select('video_id, video_title')
          .eq('user_id', userId)
          .in('video_id', videoIds);

        const videoTitles = new Map((analyses || []).map((a: any) => [a.video_id, a.video_title]));
        comments.forEach(c => {
          c.videoTitle = videoTitles.get(c.videoId) || 'Unknown Video';
        });

        return reply.send({ comments });
      } else {
        // Free users: return empty for now (would need YouTube API integration)
        return reply.send({ comments: [] });
      }

    } catch (error: any) {
      console.error('[comments.ts] Error fetching inbox:', error);
      return reply.code(500).send({
        code: 'INTERNAL_ERROR',
        message: error.message || 'Failed to fetch inbox'
      });
    }
  });

  /**
   * POST /api/comments/generate-bulk - Generate replies for multiple comments
   * Request body: { commentIds: string[] }
   */
  fastify.post('/comments/generate-bulk', async (request: any, reply) => {
    const auth = request.auth;
    const userId = auth?.userId || auth?.userDbId;
    const { commentIds } = request.body;

    if (!userId) {
      return reply.code(401).send({
        code: 'UNAUTHORIZED',
        message: 'Missing auth'
      });
    }

    if (!commentIds || !Array.isArray(commentIds) || commentIds.length === 0) {
      return reply.code(400).send({
        code: 'BAD_REQUEST',
        message: 'commentIds array required'
      });
    }

    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

      // Fetch tone profile if user is Pro
      let toneProfile = null;
      try {
        const { data } = await supabase
          .from('tone_profiles')
          .select('tone, formality_level, emoji_usage, common_emojis, avg_reply_length, common_phrases, uses_name, asks_questions, uses_commenter_name')
          .eq('user_id', userId)
          .single();

        if (data) {
          toneProfile = data;
        }
      } catch (err) {
        console.log('[comments.ts] No tone profile found for user');
      }

      // Fetch comment details
      const { data: scores } = await supabase
        .from('comment_scores')
        .select('*')
        .eq('user_id', userId)
        .in('comment_id', commentIds);

      if (!scores || scores.length === 0) {
        return reply.code(404).send({
          code: 'NOT_FOUND',
          message: 'Comments not found'
        });
      }

      // Generate replies for each comment
      const { generateReplies } = await import('../../tools.js');
      const results = await Promise.all(
        scores.map(async (score: any) => {
          try {
            const replies = await generateReplies(
              {
                id: score.comment_id,
                text: score.comment_text,
                author: score.author_name
              },
              ['friendly'],
              toneProfile
            );

            return {
              commentId: score.comment_id,
              reply: replies[0]?.reply || '',
              success: true
            };
          } catch (error: any) {
            return {
              commentId: score.comment_id,
              error: error.message,
              success: false
            };
          }
        })
      );

      return reply.send({
        results,
        total: results.length,
        successful: results.filter(r => r.success).length
      });

    } catch (error: any) {
      console.error('[comments.ts] Error generating bulk replies:', error);
      return reply.code(500).send({
        code: 'INTERNAL_ERROR',
        message: error.message || 'Failed to generate bulk replies'
      });
    }
  });

  /**
   * POST /api/comments/:commentId/generate-reply - Generate reply for a single comment
   */
  fastify.post('/comments/:commentId/generate-reply', async (request: any, reply) => {
    const auth = request.auth;
    const userId = auth?.userId || auth?.userDbId;
    const { commentId } = request.params;

    if (!userId) {
      return reply.code(401).send({
        code: 'UNAUTHORIZED',
        message: 'Missing auth'
      });
    }

    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

      // Fetch tone profile if user is Pro
      let toneProfile = null;
      try {
        const { data } = await supabase
          .from('tone_profiles')
          .select('tone, formality_level, emoji_usage, common_emojis, avg_reply_length, common_phrases, uses_name, asks_questions, uses_commenter_name')
          .eq('user_id', userId)
          .single();

        if (data) {
          toneProfile = data;
        }
      } catch (err) {
        console.log('[comments.ts] No tone profile found for user');
      }

      // Fetch comment details
      const { data: score } = await supabase
        .from('comment_scores')
        .select('*')
        .eq('user_id', userId)
        .eq('comment_id', commentId)
        .single();

      if (!score) {
        return reply.code(404).send({
          code: 'NOT_FOUND',
          message: 'Comment not found'
        });
      }

      // Generate reply
      const { generateReplies } = await import('../../tools.js');
      const replies = await generateReplies(
        {
          id: score.comment_id,
          text: score.comment_text,
          author: score.author_name
        },
        ['friendly'],
        toneProfile
      );

      return reply.send({
        reply: replies[0]?.reply || '',
        commentId: score.comment_id
      });

    } catch (error: any) {
      console.error('[comments.ts] Error generating reply:', error);
      return reply.code(500).send({
        code: 'INTERNAL_ERROR',
        message: error.message || 'Failed to generate reply'
      });
    }
  });

  /**
   * POST /api/comments/:commentId/post-reply - Post reply to YouTube
   */
  fastify.post('/comments/:commentId/post-reply', async (request: any, reply) => {
    const auth = request.auth;
    const userId = auth?.userId || auth?.userDbId;
    const { commentId } = request.params;
    const { text } = request.body;

    if (!userId) {
      return reply.code(401).send({
        code: 'UNAUTHORIZED',
        message: 'Missing auth'
      });
    }

    if (!text || typeof text !== 'string') {
      return reply.code(400).send({
        code: 'BAD_REQUEST',
        message: 'Reply text required'
      });
    }

    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

      // Get user's YouTube access token
      const { data: profile } = await supabase
        .from('profiles')
        .select('youtube_access_token')
        .eq('id', userId)
        .single();

      if (!profile?.youtube_access_token) {
        return reply.code(403).send({
          code: 'FORBIDDEN',
          message: 'YouTube not connected'
        });
      }

      // Post reply to YouTube
      const { postCommentReply } = await import('../../lib/google.js');
      await postCommentReply(profile.youtube_access_token, commentId, text);

      return reply.send({ success: true });

    } catch (error: any) {
      console.error('[comments.ts] Error posting reply:', error);
      return reply.code(500).send({
        code: 'INTERNAL_ERROR',
        message: error.message || 'Failed to post reply'
      });
    }
  });
}
