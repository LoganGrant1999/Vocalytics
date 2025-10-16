import fp from 'fastify-plugin';
import type { FastifyPluginCallback } from 'fastify';

const headersPlugin: FastifyPluginCallback = async (app) => {
  app.addHook('onSend', async (_req, reply, _payload) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'no-referrer');
    reply.header(
      'Content-Security-Policy',
      "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self'"
    );
  });
};

export default fp(headersPlugin, { name: 'headers-plugin' });
