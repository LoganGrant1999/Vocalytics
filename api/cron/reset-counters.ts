/**
 * Vercel Cron Job: Reset Counters
 * Rolls usage counters forward, resetting monthly/daily when boundaries crossed
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify cron secret
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('[cron/reset-counters] Starting counter reset...');

  try {
    // Dynamic import
    const { rollUsageCounters } = await import('../../../packages/server/src/db/rateLimits.js');
    await rollUsageCounters();

    console.log('[cron/reset-counters] Counters reset successfully');
    return res.status(200).json({
      success: true,
      message: 'Counters reset successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[cron/reset-counters] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}
