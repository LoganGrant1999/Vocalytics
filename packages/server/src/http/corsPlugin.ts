import fp from 'fastify-plugin';
import cors from '@fastify/cors';
import type { FastifyPluginCallback } from 'fastify';

const corsPlugin: FastifyPluginCallback = async (app) => {
  const ALLOWLIST = (process.env.CORS_ORIGINS || process.env.CORS_ALLOWLIST || 'localhost:5173,localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  await app.register(cors, {
    origin: (origin, cb) => {
      // Allow same-origin requests (no origin header)
      if (!origin) return cb(null, true);

      // Check if origin ends with any allowed domain
      const ok = ALLOWLIST.some((d) => origin.endsWith(d));
      cb(ok ? null : new Error('CORS not allowed'), ok);
    },
    credentials: true,
  });
};

export default fp(corsPlugin, { name: 'cors-plugin' });
