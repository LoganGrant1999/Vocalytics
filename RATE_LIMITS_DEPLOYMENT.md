# Rate Limits System - Deployment Guide

## Overview

This guide walks you through deploying the new rate limiting system:
- **Free Plan**: 50 AI replies/month, 25 posts/day
- **Pro Plan**: Unlimited monthly, 100 posts/day (fair-use cap)
- **Queue System**: Automatic queueing when daily cap reached

## Step 1: Apply Database Migration

### Option A: Supabase Dashboard (Recommended)

1. Go to your Supabase project: https://supabase.com/dashboard
2. Navigate to **SQL Editor** → **New Query**
3. Copy the entire contents of `supabase/migrations/20251031_rate_limits.sql`
4. Paste into the query editor
5. Click **Run**
6. Verify success (should see "Success. No rows returned")

### Option B: Supabase CLI

```bash
# Install Supabase CLI if not installed
npm install -g supabase

# Link your project (if not already linked)
npx supabase link --project-ref YOUR_PROJECT_REF

# Push migration
npx supabase db push
```

### Option C: Direct psql (if VPN/firewall allows)

```bash
export PGPASSWORD='your_supabase_password'
psql -h your-project.supabase.co -p 5432 -U postgres -d postgres \
  -f supabase/migrations/20251031_rate_limits.sql
```

### Verify Migration

Run this SQL in Supabase Dashboard to verify tables were created:

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('plans', 'usage_counters', 'reply_queue');

-- Check functions exist
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name LIKE '%counter%';

-- Check initial data
SELECT * FROM plans;
SELECT COUNT(*) as user_count FROM usage_counters;
```

Expected output:
- 3 tables: `plans`, `usage_counters`, `reply_queue`
- 6 functions: `roll_usage_counters`, `increment_monthly_counter`, etc.
- 2 plan rows: `free` and `pro`
- N usage_counter rows (one per existing user)

## Step 2: Set Up Cron Jobs

### Vercel (Recommended - Already Configured)

The cron jobs are already configured in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/queue-worker",
      "schedule": "*/5 * * * *"  // Every 5 minutes
    },
    {
      "path": "/api/cron/reset-counters",
      "schedule": "10 8 * * *"  // 00:10 PT (08:10 UTC)
    }
  ]
}
```

**Deploy to activate crons:**

```bash
# Commit changes
git add .
git commit -m "feat: add rate limiting system with cron jobs"
git push origin main

# Vercel will automatically deploy
```

**Set environment variable:**

In Vercel Dashboard → Settings → Environment Variables:
- Add `CRON_SECRET`: Generate a random secret (e.g., `openssl rand -hex 32`)
- This protects cron endpoints from unauthorized access

**Verify cron jobs are running:**

1. Go to Vercel Dashboard → Deployments → [Latest] → Functions
2. Look for `/api/cron/queue-worker` and `/api/cron/reset-counters`
3. Check logs for execution

### Alternative: Render Cron Jobs

If using Render instead of Vercel:

```yaml
# render.yaml
services:
  - type: cron
    name: queue-worker
    runtime: node
    schedule: "*/5 * * * *"
    buildCommand: pnpm install && pnpm --filter server build
    startCommand: pnpm --filter server worker:queue

  - type: cron
    name: reset-counters
    runtime: node
    schedule: "10 8 * * *"
    buildCommand: pnpm install && pnpm --filter server build
    startCommand: pnpm --filter server worker:reset
```

### Alternative: GitHub Actions

```yaml
# .github/workflows/cron-queue-worker.yml
name: Queue Worker
on:
  schedule:
    - cron: '*/5 * * * *'  # Every 5 minutes
  workflow_dispatch:

jobs:
  process-queue:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm --filter server worker:queue
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
```

## Step 3: Monitor Queue Processing

### Manual Monitoring

Run the monitoring script:

```bash
tsx scripts/monitor-queue.ts
```

Output example:

```
🔍 Queue Monitoring Report
==================================================

📊 Reply Queue Status:
  Pending:  12
  Failed:   3
  Posted:   458
  Avg Retry Attempts: 1.25
  Oldest Pending: 2025-10-31T20:15:00Z (23 minutes ago)

👥 Top Users with Queued Replies:
  abcd1234... - Pending: 5, Failed: 1
  efgh5678... - Pending: 4, Failed: 0

📈 Usage Counters Health:
  Total Users: 47
  Stale Counters: 0

💡 Recommendations:
  ✅ Queue is healthy!

==================================================
```

### Automated Monitoring

Set up alerts using your monitoring service (e.g., Datadog, Sentry):

```typescript
// Example: Alert if queue grows too large
if (queueStats.totalPending > 100) {
  await sendAlert({
    severity: 'warning',
    message: 'Reply queue exceeds 100 pending items',
    count: queueStats.totalPending,
  });
}
```

### Key Metrics to Track

1. **Pending Replies**: Should stay < 50 under normal load
2. **Failed Replies**: Should be < 5% of total
3. **Average Retry Attempts**: Should be < 1.5
4. **Queue Age**: Oldest pending should be < 30 minutes
5. **Stale Counters**: Should be 0 (indicates cron is working)

## Step 4: Adjust Retry Logic (If Needed)

### Current Retry Settings

In `supabase/migrations/20251031_rate_limits.sql`:

```sql
attempts int not null default 0,
max_attempts int not null default 3
```

### If Queue Backs Up

**Increase max attempts:**

```sql
UPDATE reply_queue SET max_attempts = 5 WHERE status = 'pending';
```

**Increase cron frequency** (in `vercel.json`):

```json
{
  "path": "/api/cron/queue-worker",
  "schedule": "*/2 * * * *"  // Every 2 minutes instead of 5
}
```

### If Too Many Failures

**Check error messages:**

```sql
SELECT
  error_message,
  COUNT(*) as count
FROM reply_queue
WHERE status = 'failed'
GROUP BY error_message
ORDER BY count DESC;
```

Common issues:
- **YouTube API quota exceeded**: Increase quota or reduce posting rate
- **Invalid OAuth token**: User needs to reconnect YouTube
- **Comment deleted**: Normal, can be ignored

**Manually retry failed replies:**

```sql
-- Reset failed replies to pending (only if error is resolved)
UPDATE reply_queue
SET status = 'pending', attempts = 0
WHERE status = 'failed'
AND error_message LIKE '%specific error%';
```

## Step 5: Verify Frontend

1. Log in to your app
2. Go to Dashboard
3. Verify the usage progress bar appears:
   - For **Free users**: Shows "23 / 50" with progress bar
   - For **Pro users**: Shows "Unlimited AI Replies" + daily fair-use cap
4. Generate a reply to test counter increments
5. Check `/api/me/usage` endpoint returns correct data

## Troubleshooting

### Migration Failed

**Error: "relation already exists"**
- Tables were already created. Run only the specific statements that failed.

**Error: "function already exists"**
- Functions were already created. Safe to ignore or drop and recreate.

### Cron Jobs Not Running

**Vercel:**
1. Check Vercel Dashboard → Functions tab
2. Verify `CRON_SECRET` environment variable is set
3. Check function logs for errors

**Manually trigger:**
```bash
curl -X POST https://your-app.vercel.app/api/cron/queue-worker \
  -H "Authorization: Bearer $CRON_SECRET"
```

### Usage Counter Not Created

Users created before migration may not have usage_counter rows.

**Fix:**
```sql
-- Create missing usage counters
INSERT INTO usage_counters (user_id, plan_id)
SELECT id, COALESCE(tier, 'free')
FROM profiles
WHERE id NOT IN (SELECT user_id FROM usage_counters)
ON CONFLICT (user_id) DO NOTHING;
```

### Queue Stuck

If replies aren't being processed:

1. Check worker logs: `vercel logs --follow`
2. Verify YouTube OAuth tokens are valid
3. Manually trigger worker: `curl https://your-app.vercel.app/api/cron/queue-worker`
4. Check for database locks: `SELECT * FROM pg_locks;`

## Rollback Plan

If issues arise, to rollback:

```sql
-- Disable rate limiting temporarily
DROP TABLE IF EXISTS reply_queue CASCADE;
DROP TABLE IF EXISTS usage_counters CASCADE;
DROP TABLE IF EXISTS plans CASCADE;

DROP FUNCTION IF EXISTS roll_usage_counters CASCADE;
DROP FUNCTION IF EXISTS increment_monthly_counter CASCADE;
DROP FUNCTION IF EXISTS increment_daily_counter CASCADE;
DROP FUNCTION IF EXISTS increment_queued_counter CASCADE;
DROP FUNCTION IF EXISTS decrement_queued_counter CASCADE;
```

Then comment out rate limit checks in `comments.ts` routes.

## Success Criteria

✅ Migration applied successfully
✅ Cron jobs running every 5 minutes
✅ Usage counters created for all users
✅ Frontend progress bar displays correctly
✅ Free users blocked at 50 replies/month
✅ Pro users can generate unlimited, capped at 100 posts/day
✅ Queue processes pending replies within 30 minutes
✅ Failed replies < 5% of total

## Next Steps

1. Monitor queue for first 48 hours
2. Adjust cron frequency if needed
3. Set up automated alerts for queue health
4. Add queue metrics to admin dashboard
5. Consider adding retry exponential backoff for failed replies
