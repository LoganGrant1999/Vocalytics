import { FastifyInstance } from 'fastify';
import { getUserById } from '../../db/users.js';
import { getCaps } from '../../config/env.js';

export async function meRoutes(fastify: FastifyInstance) {
  // Get subscription status
  fastify.get('/me/subscription', async (request: any, reply) => {
    const auth = request.auth;

    try {
      const user = await getUserById(auth.userDbId);

      if (!user) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'User not found'
        });
      }

      return reply.send({
        tier: user.tier,
        subscription_status: user.subscription_status,
        subscribed_until: user.subscribed_until,
        stripe_customer_id: user.stripe_customer_id,
        stripe_subscription_id: user.stripe_subscription_id
      });
    } catch (error: any) {
      console.error('Error fetching subscription:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  });

  // Get usage stats
  fastify.get('/me/usage', async (request: any, reply) => {
    const auth = request.auth;

    if (!auth?.userDbId) {
      return reply.code(401).send({
        code: 'UNAUTHORIZED',
        message: 'Missing auth'
      });
    }

    try {
      const user = await getUserById(auth.userDbId);

      if (!user) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'User not found'
        });
      }

      const { weeklyAnalyze, dailyReply } = getCaps();

      return reply.send({
        commentsAnalyzed: user.comments_analyzed_count ?? 0,
        repliesGenerated: user.replies_generated_count ?? 0,
        limits: {
          weeklyAnalyze,
          dailyReply
        },
        resetDate: user.reset_date
      });
    } catch (error: any) {
      console.error('Error fetching usage:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  });
}
