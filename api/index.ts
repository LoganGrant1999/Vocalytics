/**
 * Simple API router for Vercel
 * Routes /api/cron/* to standalone handlers, everything else returns 404
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = req.url || '';

  console.log(`[API Router] ${req.method} ${url}`);

  // Route to cron handlers
  if (url === '/api/cron/queue-worker' || url === '/cron/queue-worker') {
    const queueHandler = (await import('./cron/queue-worker.js')).default;
    return queueHandler(req, res);
  }

  if (url === '/api/cron/reset-counters' || url === '/cron/reset-counters') {
    const resetHandler = (await import('./cron/reset-counters.js')).default;
    return resetHandler(req, res);
  }

  // All other routes return 404
  return res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method}:${url} not found`,
    note: 'API routes have been temporarily simplified for cron functionality'
  });
}
