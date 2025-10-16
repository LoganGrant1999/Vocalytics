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
    app.log.info({
      reqId: req.id,
      method: req.method,
      url: req.url,
      status: reply.statusCode,
      ms: Math.round(ms),
      userId: (req as any).user?.id ?? (req as any).auth?.userId ?? null,
    });
  });
};

export default fp(loggingPlugin, { name: 'logging-plugin' });
