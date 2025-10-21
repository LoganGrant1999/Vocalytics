import { FastifyInstance } from 'fastify';
import { generateReplies } from '../../tools.js';
import { enforceReply } from '../paywall.js';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const GenerateRepliesBodySchema = {
  type: 'object',
  required: ['comment'],
  properties: {
    comment: {
      type: 'object',
      required: ['id', 'text'],
      properties: {
        id: { type: 'string', minLength: 1 },
        text: { type: 'string', minLength: 1, maxLength: 10000 }
      },
      additionalProperties: false
    },
    tones: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['friendly', 'concise', 'enthusiastic']
      }
    }
  },
  additionalProperties: false
} as const;

export async function generateRepliesRoute(fastify: FastifyInstance) {
  fastify.post('/generate-replies', {
    schema: {
      body: GenerateRepliesBodySchema
    }
  }, async (request: any, reply) => {
    const { comment, tones } = request.body || {};
    const auth = request.auth;

    try {
      // Enforce paywall (increment by number of tones/replies)
      const enforcement = await enforceReply({
        userDbId: auth.userDbId,
        incrementBy: tones?.length || 1
      });

      if (!enforcement.allowed) {
        return reply.code(402).send(enforcement.error);
      }

      // Check if user has a tone profile (Pro users only)
      let toneProfile = null;
      try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
        const { data } = await supabase
          .from('tone_profiles')
          .select('tone, formality_level, emoji_usage, common_emojis, avg_reply_length, common_phrases, uses_name, asks_questions, uses_commenter_name')
          .eq('user_id', auth.userDbId)
          .single();

        if (data) {
          toneProfile = data;
        }
      } catch (err) {
        // Tone profile not found or error - continue without it
        console.log('[generate-replies] No tone profile found for user');
      }

      // Process the request
      const result = await generateReplies(comment, tones || ['friendly'], toneProfile);

      return reply.send(result);
    } catch (error: any) {
      console.error('Error generating replies:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  });
}
