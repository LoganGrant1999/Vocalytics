# ✅ Rate Limits - Deployment Checklist

Follow this checklist to deploy the rate limiting system to production.

## Pre-Deployment (Local)

- [x] Migration file created: `supabase/migrations/20251031_rate_limits.sql`
- [x] Database layer implemented: `src/db/rateLimits.ts`
- [x] Routes updated with rate limits: `src/http/routes/comments.ts`
- [x] Usage endpoint created: `GET /me/usage`
- [x] Queue worker implemented: `src/workers/queueWorker.ts`
- [x] Counter reset worker implemented: `src/workers/resetCounters.ts`
- [x] Vercel cron endpoints created: `api/cron/*.ts`
- [x] Frontend progress bar implemented
- [x] Tests written and passing (9/9)
- [x] TypeScript compilation successful
- [x] Cron jobs configured in `vercel.json`

## Step 1: Apply Database Migration ⏳

Choose ONE method:

### Option A: Supabase Dashboard (Recommended) ✅

- [ ] Navigate to https://supabase.com/dashboard/project/YOUR_PROJECT_ID/sql/new
- [ ] Open file: `supabase/migrations/20251031_rate_limits.sql`
- [ ] Copy entire contents (Cmd+A, Cmd+C)
- [ ] Paste into SQL Editor
- [ ] Click **RUN** button
- [ ] Wait for "Success. No rows returned" message

**Verify Migration:**
- [ ] Run verification query:
  ```sql
  SELECT table_name FROM information_schema.tables
  WHERE table_name IN ('plans', 'usage_counters', 'reply_queue');
  ```
- [ ] Should see 3 rows returned
- [ ] Run plan check:
  ```sql
  SELECT * FROM plans;
  ```
- [ ] Should see 2 rows: `free` and `pro`
- [ ] Check user counters:
  ```sql
  SELECT COUNT(*) as total_users FROM usage_counters;
  ```
- [ ] Should show count matching your existing users

### Option B: Supabase CLI

- [ ] Install CLI: `npm install -g supabase`
- [ ] Link project: `npx supabase link --project-ref YOUR_PROJECT_REF`
- [ ] Push migration: `npx supabase db push`
- [ ] Verify success

## Step 2: Deploy to Vercel ⏳

- [ ] Commit all changes:
  ```bash
  git add .
  git commit -m "feat: rate limiting system (Free=50/mo, Pro=unlimited+100/day cap)"
  ```
- [ ] Push to main:
  ```bash
  git push origin main
  ```
- [ ] Wait for Vercel deployment (usually 2-3 minutes)
- [ ] Check deployment status in Vercel Dashboard
- [ ] Verify deployment succeeded (green checkmark)

## Step 3: Configure Environment Variables ⏳

In Vercel Dashboard → Settings → Environment Variables:

- [ ] Add `CRON_SECRET`:
  - Name: `CRON_SECRET`
  - Value: Generate with `openssl rand -hex 32`
  - Example: `a3f7d8e9c2b5f1a4e6d8c9b7a5f3e1d9c8b6a4f2e0d8c6b4a2f0e9d7c5b3a1f8`
  - Apply to: Production, Preview, Development
- [ ] Click **Save**
- [ ] Trigger redeploy (Settings → Deployments → Redeploy)

## Step 4: Verify Cron Jobs ⏳

After redeployment:

- [ ] Go to Vercel Dashboard → Deployments → [Latest]
- [ ] Click **Functions** tab
- [ ] Verify these functions exist:
  - `/api/cron/queue-worker`
  - `/api/cron/reset-counters`
- [ ] Click on each function, check **Crons** section
- [ ] Should show schedule: `*/5 * * * *` and `10 8 * * *`

**Manually Test Crons:**

- [ ] Get your CRON_SECRET from environment variables
- [ ] Test queue worker:
  ```bash
  curl -X POST https://your-app.vercel.app/api/cron/queue-worker \
    -H "Authorization: Bearer YOUR_CRON_SECRET"
  ```
- [ ] Should return: `{"success":true,"message":"Queue processed successfully",...}`
- [ ] Test counter reset:
  ```bash
  curl -X POST https://your-app.vercel.app/api/cron/reset-counters \
    -H "Authorization: Bearer YOUR_CRON_SECRET"
  ```
- [ ] Should return: `{"success":true,"message":"Counters reset successfully",...}`

Or use the test script:
```bash
./scripts/test-crons.sh https://your-app.vercel.app
```

## Step 5: Verify Frontend ⏳

- [ ] Visit your production app: `https://your-app.vercel.app`
- [ ] Log in with a test account
- [ ] Navigate to Dashboard
- [ ] Verify usage progress bar appears
- [ ] For Free account: Should show "X / 50" with progress bar
- [ ] For Pro account: Should show "Unlimited AI Replies"
- [ ] Generate a test reply
- [ ] Verify counter increments (refresh page, check progress bar)

## Step 6: Test Rate Limiting ⏳

### Test Free Tier Monthly Limit

- [ ] Create or use a Free tier test account
- [ ] Check current usage: `GET /api/me/usage`
- [ ] Note: `monthlyUsed: X, monthlyLimit: 50`
- [ ] Generate replies until near limit (e.g., 48/50)
- [ ] Verify next 2 replies work
- [ ] Verify 51st reply is blocked with error:
  ```json
  {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Monthly AI reply limit reached (50/month). Upgrade to Pro for unlimited replies."
  }
  ```

### Test Pro Tier Daily Cap

- [ ] Create or use a Pro tier test account
- [ ] Check current usage: `GET /api/me/usage`
- [ ] Note: `monthlyLimit: null` (unlimited)
- [ ] Generate multiple replies (won't hit monthly limit)
- [ ] Post replies until near daily cap (not feasible to test 100, but verify logic)
- [ ] After 100 posts, verify next post is queued:
  ```json
  {
    "success": true,
    "queued": true,
    "queueId": "...",
    "message": "Daily posting cap reached (100/day). Reply will be queued and posted tomorrow."
  }
  ```

### Test Queue Processing

- [ ] Queue a test reply (hit daily cap as Pro user, or manually insert)
- [ ] Wait 5 minutes for cron to run
- [ ] Check Vercel logs for queue worker execution
- [ ] Verify reply was posted to YouTube
- [ ] Check queue status: `SELECT * FROM reply_queue WHERE status = 'posted'`

## Step 7: Monitor Health ⏳

- [ ] Run monitoring script:
  ```bash
  cd packages/server
  pnpm monitor:queue
  ```
- [ ] Verify output shows:
  - Pending: < 10
  - Failed: 0
  - Posted: >= 0
  - Stale Counters: 0
  - "✅ Queue is healthy!"

- [ ] Check Vercel function logs:
  ```bash
  vercel logs --follow
  ```
- [ ] Look for:
  - `[cron/queue-worker] Queue processing completed successfully`
  - `[cron/reset-counters] Counters reset successfully`
  - No error messages

## Step 8: Setup Monitoring (Optional) ⏳

- [ ] Set up Vercel integration with monitoring tool (Datadog, Sentry, etc.)
- [ ] Create alert: Queue pending > 100
- [ ] Create alert: Queue failures > 5% of total
- [ ] Create alert: Cron job hasn't run in 10 minutes
- [ ] Schedule daily manual check of queue health

## Post-Deployment Verification ✅

After 24 hours:

- [ ] Check queue processed at least 288 times (24h × 12 per hour)
- [ ] Verify counter reset ran once at 00:10 PT
- [ ] Check for any failed replies: `SELECT COUNT(*) FROM reply_queue WHERE status = 'failed'`
- [ ] Review user feedback/complaints
- [ ] Monitor conversion rate (Free → Pro upgrades)

After 7 days:

- [ ] Analyze usage patterns
- [ ] Check if any users are consistently hitting limits
- [ ] Review failed reply error messages
- [ ] Adjust retry logic if needed
- [ ] Consider adjusting limits based on data

## Rollback Plan (If Needed) 🔄

If critical issues arise:

1. **Disable rate limiting in code:**
   - [ ] Comment out rate limit checks in `src/http/routes/comments.ts`
   - [ ] Deploy to Vercel
   - [ ] Users can generate unlimited replies (temporary fix)

2. **Disable cron jobs:**
   - [ ] Remove `crons` section from `vercel.json`
   - [ ] Deploy to Vercel
   - [ ] Queue processing stops

3. **Drop database tables (last resort):**
   - [ ] Run rollback SQL in Supabase Dashboard
   - [ ] See `RATE_LIMITS_DEPLOYMENT.md` for SQL commands

## Success Indicators ✅

You're done when ALL are true:

- ✅ Migration applied without errors
- ✅ Cron jobs running on schedule (check logs)
- ✅ Free users can generate 50 replies/month
- ✅ Free users blocked at 51st reply
- ✅ Pro users can generate unlimited replies
- ✅ Pro users have 100 posts/day cap
- ✅ Excess Pro posts are queued
- ✅ Queue processes within 30 minutes
- ✅ Failed replies < 5% of total
- ✅ Frontend progress bar displays correctly
- ✅ No user complaints about rate limiting bugs

## Files to Keep

Important files for future reference:

- `RATE_LIMITS_DEPLOYMENT.md` - Detailed deployment guide
- `DEPLOYMENT_SUMMARY.md` - Quick reference
- `DEPLOYMENT_CHECKLIST.md` - This checklist
- `supabase/migrations/20251031_rate_limits.sql` - Migration file
- `scripts/monitor-queue.ts` - Monitoring tool
- `scripts/test-crons.sh` - Cron testing tool

## Need Help?

- Review detailed guide: `RATE_LIMITS_DEPLOYMENT.md`
- Check logs: `vercel logs --follow`
- Monitor queue: `pnpm monitor:queue`
- Test crons: `./scripts/test-crons.sh`
- Run tests: `pnpm test rate-limits.test.ts`

---

**Estimated Total Deployment Time:** 15-20 minutes
**Status:** Ready to deploy ✅
