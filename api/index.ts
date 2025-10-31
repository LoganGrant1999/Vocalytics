/**
 * Vercel API Router
 * Routes /api/cron/* to cron handlers
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = req.url || '';

  console.log(`[API Router] ${req.method} ${url}`);

  // Route /api/cron/queue-worker
  if (url.includes('queue-worker')) {
    const { default: queueWorker } = await import('./cron/queue-worker.js');
    return queueWorker(req, res);
  }

  // Route /api/cron/reset-counters
  if (url.includes('reset-counters')) {
    const { default: resetCounters } = await import('./cron/reset-counters.js');
    return resetCounters(req, res);
  }

  // 404 for everything else
  return res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method}:${url} not found`,
    availableEndpoints: [
      'POST /api/cron/queue-worker',
      'POST /api/cron/reset-counters'
    ]
  });
}
