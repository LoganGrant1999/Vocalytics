/**
 * Catch-all API handler for Vercel
 * Routes to cron functions or returns 404
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const path = req.url || '';

  console.log(`[API Catch-all] ${req.method} ${path}`);

  // Route to cron queue-worker
  if (path.includes('/queue-worker')) {
    const { default: queueHandler } = await import('./cron/queue-worker');
    return queueHandler(req, res);
  }

  // Route to cron reset-counters
  if (path.includes('/reset-counters')) {
    const { default: resetHandler } = await import('./cron/reset-counters');
    return resetHandler(req, res);
  }

  // Default 404
  return res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method}:${path} not found`,
    note: 'Cron endpoints: /api/cron/queue-worker, /api/cron/reset-counters'
  });
}
