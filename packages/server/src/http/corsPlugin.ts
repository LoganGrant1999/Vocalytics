import fp from 'fastify-plugin';
import cors from '@fastify/cors';
import type { FastifyPluginCallback } from 'fastify';

const corsPlugin: FastifyPluginCallback = async (app) => {
  await app.register(cors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (same-origin, curl, etc)
      if (!origin) {
        return cb(null, true);
      }

      // Allow localhost (development)
      if (origin.includes('localhost:')) {
        return cb(null, true);
      }

      // Allow all vercel.app deployments (production + previews)
      if (origin.includes('.vercel.app')) {
        return cb(null, true);
      }

      console.error(`[CORS] Blocked origin: ${origin}`);
      cb(new Error('CORS not allowed'), false);
    },
    credentials: true,
  });
};

export default fp(corsPlugin, { name: 'cors-plugin' });
