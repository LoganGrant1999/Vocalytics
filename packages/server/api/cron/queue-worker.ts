/**
 * Vercel Cron Job: Queue Worker
 * Processes pending queued replies every 5 minutes
 *
 * Vercel Cron: */5 * * * * (every 5 minutes)
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { processQueue } from '../../src/workers/queueWorker.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify cron secret to prevent unauthorized access
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('[cron/queue-worker] Starting queue processing...');

  try {
    await processQueue();

    console.log('[cron/queue-worker] Queue processing completed successfully');
    return res.status(200).json({
      success: true,
      message: 'Queue processed successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[cron/queue-worker] Error processing queue:', error);

    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}
