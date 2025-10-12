import { FastifyInstance } from 'fastify';
import { summarizeSentiment } from '../../tools.js';

const SummarizeSentimentBodySchema = {
  type: 'object',
  required: ['analysis'],
  properties: {
    analysis: {
      type: 'array'
    }
  },
  additionalProperties: true
} as const;

export async function summarizeSentimentRoute(fastify: FastifyInstance) {
  fastify.post('/summarize-sentiment', {
    schema: {
      body: SummarizeSentimentBodySchema
    }
  }, async (request: any, reply) => {
    const { analysis } = request.body || {};

    try {
      // No paywall for summarization (it operates on already-analyzed data)
      const result = await summarizeSentiment(analysis);

      return reply.send(result);
    } catch (error: any) {
      console.error('Error summarizing sentiment:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  });
}
