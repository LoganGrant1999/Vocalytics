import { FastifyInstance } from 'fastify';
import { createClient } from '@supabase/supabase-js';
import { fetchCreatorReplies } from '../../lib/google.js';
import { analyzeTone } from '../../services/toneAnalysis.js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function toneRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/tone/learn
   * Learn user's tone from their past YouTube replies
   * Pro users only
   */
  fastify.post('/tone/learn', async (request: any, reply) => {
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
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('tier, youtube_access_token')
        .eq('id', userId)
        .single();

      if (profileError || !profile) {
        return reply.code(404).send({
          code: 'NOT_FOUND',
          message: 'User profile not found'
        });
      }

      if (profile.tier !== 'pro') {
        return reply.code(403).send({
          code: 'FORBIDDEN',
          message: 'Tone learning is a Pro feature'
        });
      }

      if (!profile.youtube_access_token) {
        return reply.code(400).send({
          code: 'BAD_REQUEST',
          message: 'YouTube account not connected'
        });
      }

      // Fetch creator's past replies from YouTube
      const replies = await fetchCreatorReplies(profile.youtube_access_token, 50);

      if (replies.length === 0) {
        return reply.code(400).send({
          code: 'INSUFFICIENT_DATA',
          message: 'No past replies found. You need to have replied to at least one comment on your videos.'
        });
      }

      // Analyze tone using GPT-4o
      const toneProfile = await analyzeTone(replies.map(r => r.text));

      // Store in database
      const { data: savedProfile, error: saveError } = await supabase
        .from('tone_profiles')
        .upsert({
          user_id: userId,
          tone: toneProfile.tone,
          formality_level: toneProfile.formality_level,
          emoji_usage: toneProfile.emoji_usage,
          common_emojis: toneProfile.common_emojis,
          avg_reply_length: toneProfile.avg_reply_length,
          common_phrases: toneProfile.common_phrases,
          uses_name: toneProfile.uses_name,
          asks_questions: toneProfile.asks_questions,
          uses_commenter_name: toneProfile.uses_commenter_name,
          example_replies: replies.slice(0, 10).map(r => r.text), // Store first 10 as examples
          learned_from_count: replies.length,
          learned_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' })
        .select()
        .single();

      if (saveError) {
        console.error('[tone.ts] Failed to save tone profile:', saveError);
        return reply.code(500).send({
          code: 'INTERNAL_ERROR',
          message: 'Failed to save tone profile'
        });
      }

      return reply.send({
        success: true,
        profile: savedProfile,
        analyzed_replies: replies.length
      });
    } catch (error: any) {
      console.error('[tone.ts] Error learning tone:', error);
      return reply.code(500).send({
        code: 'INTERNAL_ERROR',
        message: error.message || 'Failed to learn tone'
      });
    }
  });

  /**
   * GET /api/tone/profile
   * Get user's current tone profile
   */
  fastify.get('/tone/profile', async (request: any, reply) => {
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

      const { data: profile, error } = await supabase
        .from('tone_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error || !profile) {
        return reply.code(404).send({
          code: 'NOT_FOUND',
          message: 'No tone profile found. Run tone learning first.'
        });
      }

      return reply.send(profile);
    } catch (error: any) {
      console.error('[tone.ts] Error fetching tone profile:', error);
      return reply.code(500).send({
        code: 'INTERNAL_ERROR',
        message: error.message || 'Failed to fetch tone profile'
      });
    }
  });

  /**
   * DELETE /api/tone/profile
   * Delete user's tone profile
   */
  fastify.delete('/tone/profile', async (request: any, reply) => {
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

      const { error } = await supabase
        .from('tone_profiles')
        .delete()
        .eq('user_id', userId);

      if (error) {
        console.error('[tone.ts] Failed to delete tone profile:', error);
        return reply.code(500).send({
          code: 'INTERNAL_ERROR',
          message: 'Failed to delete tone profile'
        });
      }

      return reply.send({ success: true });
    } catch (error: any) {
      console.error('[tone.ts] Error deleting tone profile:', error);
      return reply.code(500).send({
        code: 'INTERNAL_ERROR',
        message: error.message || 'Failed to delete tone profile'
      });
    }
  });
}
