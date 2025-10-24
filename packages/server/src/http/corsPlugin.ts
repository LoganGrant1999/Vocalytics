import fp from 'fastify-plugin';
import cors from '@fastify/cors';
import type { FastifyPluginCallback } from 'fastify';

const corsPlugin: FastifyPluginCallback = async (app) => {
  // Default: allow both localhost (dev) and production domains
  const defaultOrigins = 'localhost:5173,localhost:3000,localhost:5174,vocalytics-alpha.vercel.app,vercel.app';

  const ALLOWLIST = (process.env.CORS_ORIGINS || defaultOrigins)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  console.log('[CORS] Allowlist:', ALLOWLIST);

  await app.register(cors, {
    origin: (origin, cb) => {
      console.log('[CORS] Checking origin:', origin);

      // Allow same-origin requests (no origin header)
      if (!origin) {
        console.log('[CORS] Allowed: no origin header');
        return cb(null, true);
      }

      // Remove protocol from origin for comparison
      const originHost = origin.replace(/^https?:\/\//, '');

      // Check if origin matches any allowed domain
      const ok = ALLOWLIST.some((d) => {
        const matches = originHost === d || originHost.endsWith('.' + d);
        if (matches) console.log(`[CORS] Match: ${originHost} matches ${d}`);
        return matches;
      });

      if (!ok) {
        console.error(`[CORS] BLOCKED: origin="${origin}", originHost="${originHost}", allowlist=[${ALLOWLIST.join(', ')}]`);
      } else {
        console.log('[CORS] Allowed:', origin);
      }

      cb(ok ? null : new Error('CORS not allowed'), ok);
    },
    credentials: true,
  });
};

export default fp(corsPlugin, { name: 'cors-plugin' });
