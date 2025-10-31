/**
 * Vercel Cron Job: Reset Counters
 * Rolls usage counters forward, resetting monthly/daily when boundaries crossed
 *
 * Vercel Cron: 10 8 * * * (00:10 PT = 08:10 UTC)
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { rollUsageCounters } from '../../src/db/rateLimits.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify cron secret to prevent unauthorized access
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('[cron/reset-counters] Starting counter reset...');

  try {
    await rollUsageCounters();

    console.log('[cron/reset-counters] Counters reset successfully');
    return res.status(200).json({
      success: true,
      message: 'Counters reset successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[cron/reset-counters] Error resetting counters:', error);

    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}
