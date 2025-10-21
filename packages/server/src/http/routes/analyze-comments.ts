import { FastifyInstance } from 'fastify';
import { analyzeComments } from '../../tools.js';
import { enforceAnalyze } from '../paywall.js';

const AnalyzeCommentsBodySchema = {
  type: 'object',
  required: ['comments'],
  properties: {
    comments: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['id', 'text'],
        properties: {
          id: { type: 'string', minLength: 1 },
          text: { type: 'string', minLength: 1, maxLength: 10000 }
        },
        additionalProperties: false
      }
    }
  },
  additionalProperties: false
} as const;

export async function analyzeCommentsRoute(fastify: FastifyInstance) {
  fastify.post('/analyze-comments', {
    schema: {
      body: AnalyzeCommentsBodySchema
    }
  }, async (request: any, reply) => {
    const { comments } = request.body || {};
    const auth = request.auth;

    try {
      // Enforce paywall (increment by 1 per request, not per comment)
      const userId = auth.userId || auth.userDbId;
      const enforcement = await enforceAnalyze({
        userDbId: userId,
        incrementBy: 1
      });

      if (!enforcement.allowed) {
        return reply.code(402).send('error' in enforcement ? enforcement.error : { error: 'Payment required' });
      }

      // Process the request
      const analysis = await analyzeComments(comments);

      // Transform the response to match what the frontend expects
      const result = analysis.map((a) => ({
        commentId: a.commentId,
        sentiment: {
          label: a.category === 'constructive' || a.category === 'spam'
            ? 'neutral'
            : a.category as 'positive' | 'neutral' | 'negative',
          positive: a.sentiment.positive,
          neutral: a.sentiment.neutral,
          negative: a.sentiment.negative
        },
        topics: a.topics,
        intent: a.intent,
        toxicity: a.toxicity,
        category: a.category
      }));

      return reply.send(result);
    } catch (error: any) {
      console.error('Error analyzing comments:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  });
}
