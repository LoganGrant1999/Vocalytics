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
      // Enforce paywall
      const enforcement = await enforceAnalyze({
        userDbId: auth.userDbId,
        incrementBy: comments.length
      });

      if (!enforcement.allowed) {
        return reply.code(402).send(enforcement.error);
      }

      // Process the request
      const result = await analyzeComments(comments);

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
