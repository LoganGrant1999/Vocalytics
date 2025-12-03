import { FastifyInstance } from 'fastify';
import { generateReplies } from '../../tools.js';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const GenerateRepliesBodySchema = {
  type: 'object',
  required: ['videoId', 'commentIds'],
  properties: {
    videoId: { type: 'string', minLength: 1 },
    commentIds: {
      type: 'array',
      items: { type: 'string' },
      minItems: 1
    },
    tone: { type: 'string' }
  },
  additionalProperties: false
} as const;

export async function generateRepliesRoute(fastify: FastifyInstance) {
  fastify.post('/generate-replies', {
    schema: {
      body: GenerateRepliesBodySchema
    }
  }, async (request: any, reply) => {
    const { videoId, commentIds, tone } = request.body || {};
    const auth = request.auth;

    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

      // Fetch comments from comment_scores table
      const { data: comments, error: fetchError } = await supabase
        .from('comment_scores')
        .select('comment_id, comment_text, author_name')
        .eq('user_id', auth.userDbId)
        .eq('video_id', videoId)
        .in('comment_id', commentIds);

      if (fetchError || !comments || comments.length === 0) {
        return reply.code(404).send({
          error: 'NOT_FOUND',
          message: 'Comments not found'
        });
      }

      // Fetch user's tone profile
      let toneProfile = null;
      try {
        const { data } = await supabase
          .from('tone_profiles')
          .select('tone, formality_level, emoji_usage, common_emojis, avg_reply_length, common_phrases, uses_name, asks_questions, uses_commenter_name')
          .eq('user_id', auth.userDbId)
          .single();

        if (data) {
          toneProfile = data;
        }
      } catch (err) {
        console.log('[generate-replies] No tone profile found for user');
      }

      // Generate replies for each comment (no paywall - all users can generate)
      const replies = [];
      for (const comment of comments) {
        const result = await generateReplies(
          { id: comment.comment_id, text: comment.comment_text },
          [tone || 'friendly'],
          toneProfile
        );

        const suggestedReply = result[0]?.reply || '';

        // Save the generated reply to the database
        await supabase
          .from('comment_scores')
          .update({
            suggested_reply: suggestedReply,
            reply_generated_at: new Date().toISOString()
          })
          .eq('user_id', auth.userDbId)
          .eq('comment_id', comment.comment_id);

        replies.push({
          commentId: comment.comment_id,
          originalComment: comment.comment_text,
          suggestedReply
        });
      }

      return reply.send({ replies });
    } catch (error: any) {
      console.error('Error generating replies:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  });
}
