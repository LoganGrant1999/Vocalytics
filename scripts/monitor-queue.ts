/**
 * Queue Monitoring Script
 *
 * Checks the health of the reply queue and provides insights on:
 * - Pending replies count
 * - Failed replies count
 * - Average retry attempts
 * - Queue age distribution
 *
 * Usage: tsx scripts/monitor-queue.ts
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface QueueStats {
  totalPending: number;
  totalFailed: number;
  totalPosted: number;
  avgAttempts: number;
  oldestPending: string | null;
  newestPending: string | null;
  byUser: Array<{
    userId: string;
    pending: number;
    failed: number;
  }>;
}

async function getQueueStats(): Promise<QueueStats> {
  // Get overall counts
  const { data: allReplies, error: allError } = await supabase
    .from('reply_queue')
    .select('user_id, status, attempts, created_at');

  if (allError) throw allError;

  const pending = allReplies?.filter(r => r.status === 'pending') || [];
  const failed = allReplies?.filter(r => r.status === 'failed') || [];
  const posted = allReplies?.filter(r => r.status === 'posted') || [];

  // Calculate average attempts for pending
  const avgAttempts = pending.length > 0
    ? pending.reduce((sum, r) => sum + r.attempts, 0) / pending.length
    : 0;

  // Get oldest and newest pending
  const sortedPending = [...pending].sort((a, b) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const oldestPending = sortedPending[0]?.created_at || null;
  const newestPending = sortedPending[sortedPending.length - 1]?.created_at || null;

  // Group by user
  const byUserMap = new Map<string, { pending: number; failed: number }>();

  for (const reply of allReplies || []) {
    if (!byUserMap.has(reply.user_id)) {
      byUserMap.set(reply.user_id, { pending: 0, failed: 0 });
    }

    const userStats = byUserMap.get(reply.user_id)!;
    if (reply.status === 'pending') userStats.pending++;
    if (reply.status === 'failed') userStats.failed++;
  }

  const byUser = Array.from(byUserMap.entries())
    .map(([userId, stats]) => ({ userId, ...stats }))
    .filter(u => u.pending > 0 || u.failed > 0)
    .sort((a, b) => (b.pending + b.failed) - (a.pending + a.failed));

  return {
    totalPending: pending.length,
    totalFailed: failed.length,
    totalPosted: posted.length,
    avgAttempts,
    oldestPending,
    newestPending,
    byUser,
  };
}

async function getUsageCountersHealth() {
  const { data: counters, error } = await supabase
    .from('usage_counters')
    .select('user_id, plan_id, replies_used_month, replies_posted_today, queued_replies, updated_at');

  if (error) throw error;

  const staleCounters = (counters || []).filter(c => {
    const lastUpdate = new Date(c.updated_at);
    const hoursSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60);
    return hoursSinceUpdate > 24 && (c.queued_replies > 0 || c.replies_posted_today > 0);
  });

  return {
    totalUsers: counters?.length || 0,
    staleCounters: staleCounters.length,
    staleDetails: staleCounters.map(c => ({
      userId: c.user_id,
      plan: c.plan_id,
      queued: c.queued_replies,
      lastUpdate: c.updated_at,
    })),
  };
}

async function main() {
  console.log('🔍 Queue Monitoring Report');
  console.log('=' .repeat(50));

  try {
    // Queue stats
    console.log('\n📊 Reply Queue Status:');
    const queueStats = await getQueueStats();

    console.log(`  Pending:  ${queueStats.totalPending}`);
    console.log(`  Failed:   ${queueStats.totalFailed}`);
    console.log(`  Posted:   ${queueStats.totalPosted}`);
    console.log(`  Avg Retry Attempts: ${queueStats.avgAttempts.toFixed(2)}`);

    if (queueStats.oldestPending) {
      const age = Math.round((Date.now() - new Date(queueStats.oldestPending).getTime()) / (1000 * 60));
      console.log(`  Oldest Pending: ${queueStats.oldestPending} (${age} minutes ago)`);
    }

    if (queueStats.byUser.length > 0) {
      console.log('\n👥 Top Users with Queued Replies:');
      queueStats.byUser.slice(0, 5).forEach(u => {
        console.log(`  ${u.userId.substring(0, 8)}... - Pending: ${u.pending}, Failed: ${u.failed}`);
      });
    }

    // Usage counters health
    console.log('\n📈 Usage Counters Health:');
    const usageHealth = await getUsageCountersHealth();
    console.log(`  Total Users: ${usageHealth.totalUsers}`);
    console.log(`  Stale Counters: ${usageHealth.staleCounters}`);

    if (usageHealth.staleDetails.length > 0) {
      console.log('\n⚠️  Stale Counters (not updated in 24h):');
      usageHealth.staleDetails.forEach(c => {
        console.log(`  ${c.userId.substring(0, 8)}... - Queued: ${c.queued}, Last: ${c.lastUpdate}`);
      });
    }

    // Recommendations
    console.log('\n💡 Recommendations:');

    if (queueStats.totalPending > 100) {
      console.log('  ⚠️  High pending count - consider increasing worker frequency');
    }

    if (queueStats.totalFailed > 50) {
      console.log('  ⚠️  High failure count - check error logs and YouTube API quota');
    }

    if (queueStats.avgAttempts > 1.5) {
      console.log('  ⚠️  High retry rate - investigate common failure reasons');
    }

    if (usageHealth.staleCounters > 0) {
      console.log('  ⚠️  Stale counters detected - verify counter reset cron is running');
    }

    if (queueStats.totalPending === 0 && queueStats.totalFailed === 0) {
      console.log('  ✅ Queue is healthy!');
    }

    console.log('\n' + '='.repeat(50));

  } catch (error: any) {
    console.error('❌ Error monitoring queue:', error.message);
    process.exit(1);
  }
}

main();
