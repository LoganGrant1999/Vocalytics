import fp from 'fastify-plugin';
import cors from '@fastify/cors';
import type { FastifyPluginCallback } from 'fastify';

const corsPlugin: FastifyPluginCallback = async (app) => {
  const isProd = process.env.NODE_ENV === 'production';

  // Production: allow specific domains
  // Development: allow localhost variants
  const defaultOrigins = isProd
    ? 'vocalytics-alpha.vercel.app,vercel.app'
    : 'localhost:5173,localhost:3000,localhost:5174';

  const ALLOWLIST = (process.env.CORS_ORIGINS || process.env.CORS_ALLOWLIST || defaultOrigins)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  await app.register(cors, {
    origin: (origin, cb) => {
      // Allow same-origin requests (no origin header)
      if (!origin) return cb(null, true);

      // Remove protocol from origin for comparison
      const originHost = origin.replace(/^https?:\/\//, '');

      // Check if origin matches any allowed domain
      const ok = ALLOWLIST.some((d) => originHost === d || originHost.endsWith('.' + d) || originHost.endsWith(d));

      if (!ok) {
        console.warn(`[CORS] Blocked origin: ${origin}, allowlist: ${ALLOWLIST.join(', ')}`);
      }

      cb(ok ? null : new Error('CORS not allowed'), ok);
    },
    credentials: true,
  });
};

export default fp(corsPlugin, { name: 'cors-plugin' });
