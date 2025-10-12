import { FastifyInstance } from 'fastify';
import { fetchComments } from '../../tools.js';

const FetchCommentsBodySchema = {
  type: 'object',
  properties: {
    videoId: { type: 'string', minLength: 1 },
    channelId: { type: 'string', minLength: 1 },
    max: { type: 'integer', minimum: 1, maximum: 50 },
    pageToken: { type: 'string' },
    includeReplies: { type: 'boolean' },
    order: { type: 'string', enum: ['time', 'relevance'] }
  },
  additionalProperties: false
} as const;

export async function fetchCommentsRoute(fastify: FastifyInstance) {
  fastify.post('/fetch-comments', {
    schema: {
      body: FetchCommentsBodySchema
    },
    preValidation: (request: any, reply, done) => {
      const body = request.body || {};
      if (!body.videoId && !body.channelId) {
        reply.code(400).send({
          code: 'BAD_REQUEST',
          message: 'Provide videoId or channelId'
        });
        return;
      }
      done();
    }
  }, async (request: any, reply) => {
    const {
      videoId,
      channelId,
      max = 50,
      pageToken,
      includeReplies = false,
      order = 'time'
    } = request.body || {};

    try {
      const result = await fetchComments(
        videoId,
        channelId,
        max,
        pageToken,
        includeReplies,
        order
      );

      return reply.send(result);
    } catch (error: any) {
      console.error('Error fetching comments:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  });
}
