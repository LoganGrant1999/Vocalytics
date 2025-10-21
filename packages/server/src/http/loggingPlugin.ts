import fp from 'fastify-plugin';
import { randomUUID } from 'crypto';
import type { FastifyPluginCallback } from 'fastify';

const loggingPlugin: FastifyPluginCallback = async (app) => {
  // Ensure request ID is set
  app.addHook('onRequest', async (req, _reply) => {
    req.id = req.id || randomUUID();
  });

  // Log response completion
  app.addHook('onResponse', async (req, reply) => {
    const ms = reply.elapsedTime ?? reply.getResponseTime?.() ?? 0;
    const logData = {
      reqId: req.id,
      method: req.method,
      url: req.url,
      status: reply.statusCode,
      ms: Math.round(ms),
      userId: (req as any).user?.id ?? (req as any).auth?.userId ?? null,
    };

    // Use generic log method that works with all loggers
    if (typeof app.log.info === 'function') {
      app.log.info(logData);
    } else {
      console.log('[LOG]', logData);
    }
  });
};

export default fp(loggingPlugin, { name: 'logging-plugin' });
