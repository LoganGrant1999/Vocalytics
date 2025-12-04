/**
 * Vercel Serverless Function - Catch-all API handler
 * Routes all /api/* requests to the Fastify HTTP server
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// Cache the Fastify server instance across invocations
let cachedServer: any = null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Initialize Fastify server once and reuse
    if (!cachedServer) {
      const { createHttpServer } = await import('../packages/server/src/http/index.js');
      cachedServer = await createHttpServer();
      await cachedServer.ready();
    }

    // Forward the request to Fastify
    cachedServer.routing(req, res);
  } catch (error: any) {
    console.error('[Vercel Handler Error]:', error);

    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message,
      });
    }
  }
}
