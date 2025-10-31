/**
 * Reset Counters Worker
 *
 * Rolls usage counters forward, resetting monthly/daily counters when boundaries crossed.
 * Runs nightly at 00:10 PT via cron job.
 */

import { rollUsageCounters } from '../db/rateLimits.js';

async function main(): Promise<void> {
  console.log('[resetCounters] Starting counter reset...');

  try {
    await rollUsageCounters();
    console.log('[resetCounters] Counters reset successfully');
    process.exit(0);
  } catch (error: any) {
    console.error('[resetCounters] Error resetting counters:', error);
    process.exit(1);
  }
}

// Run if invoked directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main as resetCounters };
