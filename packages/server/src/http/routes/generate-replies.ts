import { FastifyInstance } from 'fastify';
import { generateReplies } from '../../tools.js';
import { enforceReply } from '../paywall.js';

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

      // Process the request
      const result = await generateReplies(comment, tones || ['friendly']);

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
