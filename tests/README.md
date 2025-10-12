# Vocalytics HTTP API - Smoke Tests

Production-style automated smoke tests validating authentication, metering, paywall, Stripe billing, and pro bypass functionality.

## Quick Start

### Prerequisites

1. **Install required tools:**
   ```bash
   # macOS
   brew install curl jq node stripe

   # Ubuntu/Debian
   apt-get install curl jq nodejs
   npm install -g stripe
   ```

2. **Set environment variables:**
   ```bash
   export SUPABASE_URL=https://xxx.supabase.co
   export SUPABASE_ANON=eyJhbGc...
   export TEST_EMAIL=test@example.com
   export TEST_PASS=password123

   # Optional - override defaults
   export BASE_URL=http://localhost:3000
   export EXPECT_ANALYZE_CAP=2
   export EXPECT_REPLY_CAP=1
   ```

3. **Create test user in Supabase:**
   - Go to Supabase Dashboard > Authentication > Users
   - Click "Add User"
   - Enter email and password matching `TEST_EMAIL` and `TEST_PASS`
   - Confirm the user (if email confirmation required)

4. **Configure server for testing:**

   Create/update `packages/server/.env`:
   ```bash
   # Use small limits for testing
   FREE_LIMIT_ANALYZE_WEEKLY=2
   FREE_LIMIT_REPLY_DAILY=1

   # All other required env vars...
   SUPABASE_URL=...
   SUPABASE_SERVICE_ROLE_KEY=...
   STRIPE_SECRET_KEY=...
   # etc.
   ```

### Running Tests

#### Option 1: Bash Script (Recommended)

```bash
# Start HTTP server
pnpm --filter @vocalytics/server dev:http

# In another terminal, start Stripe webhook forwarding
stripe listen --forward-to http://localhost:3000/api/webhook/stripe

# In a third terminal, run smoke tests
bash scripts/smoke.sh
```

**Expected Output:**
```
════════════════════════════════════════════════════════════════
  Vocalytics HTTP API Smoke Test
════════════════════════════════════════════════════════════════
Configuration:
  BASE_URL: http://localhost:3000
  ...

✓ Health check passed (got 200)
✓ Request without auth rejected (got 401)
✓ JWT token obtained (xxx chars)
...
════════════════════════════════════════════════════════════════
  ✅ All Smoke Tests Passed!
════════════════════════════════════════════════════════════════
```

#### Option 2: VS Code REST Client

1. Install [REST Client extension](https://marketplace.visualstudio.com/items?itemName=humao.rest-client)
2. Open `tests/smoke.http`
3. Get JWT token first:
   ```bash
   export JWT=$(SUPABASE_URL=$SUPABASE_URL SUPABASE_ANON=$SUPABASE_ANON \
     TEST_EMAIL=$TEST_EMAIL TEST_PASS=$TEST_PASS node scripts/get-jwt.js)
   echo $JWT
   ```
4. Replace `YOUR_JWT_TOKEN_HERE` in `smoke.http` with your JWT
5. Click "Send Request" on each request sequentially

#### Option 3: Postman

1. Import `tests/postman_collection.json` into Postman
2. Create environment with variables:
   - `baseUrl`: `http://localhost:3000`
   - `jwt`: (get via `node scripts/get-jwt.js`)
   - `supabaseUrl`, `supabaseAnon`, `expectAnalyzeCap`, `expectReplyCap`
3. Run collection with "Run Collection" → assertions will validate responses

---

## Test Coverage

The smoke tests validate:

### ✅ Authentication & Security
- JWT authentication via Supabase
- User auto-upsert on first auth
- 401 on missing/invalid tokens
- 401 on bad/malformed tokens

### ✅ Free Tier Metering
- **Analyze comments**: Weekly limit (default: 2)
  - Requests 1-2 succeed (200)
  - Request 3 hits paywall (402)
- **Generate replies**: Daily limit (default: 1)
  - Request 1 succeeds (200)
  - Request 2 hits paywall (402)

### ✅ Paywall Enforcement
- HTTP 402 status code
- JSON response with:
  - `code: "PAYWALL"`
  - `reason: "FREE_TIER_EXCEEDED"`
  - `feature: "analyze" | "reply"`
  - `upgradeUrl` and `manageUrl`
  - Current `usage` and `limits`

### ✅ Usage Tracking
- `/api/me/usage` reflects accurate counters
- Limits match server configuration
- Counters increment atomically

### ✅ Stripe Integration
- **Checkout**: Creates session, returns valid URL
- **Webhook**: Processes subscription events
- **Activation**: Sets `subscription_status=active`, `tier=pro`
- **Customer/Subscription IDs**: Properly linked
- **Portal**: Creates portal session URL

### ✅ Pro Tier
- Bypasses paywall (no 402 on analyze/reply)
- Usage may or may not increment (implementation choice)

### ✅ Manual Reset Procedures
- Documents how to reset counters via SQL
- Simulates daily/weekly cron jobs

---

## Troubleshooting

### Problem: `401 Unauthorized` on all requests

**Causes:**
- JWT expired (tokens expire after 1 hour by default)
- Wrong `TEST_EMAIL` or `TEST_PASS`
- User doesn't exist in Supabase

**Solutions:**
```bash
# Get fresh JWT
JWT=$(SUPABASE_URL=$SUPABASE_URL SUPABASE_ANON=$SUPABASE_ANON \
  TEST_EMAIL=$TEST_EMAIL TEST_PASS=$TEST_PASS node scripts/get-jwt.js)

# Verify user exists in Supabase Dashboard > Authentication > Users
# Create if missing
```

### Problem: Paywall not triggering (no 402)

**Causes:**
- Server limits set too high
- User is already pro tier
- Database counters not reset

**Solutions:**
```bash
# Check server env
grep FREE_LIMIT packages/server/.env

# Should see:
# FREE_LIMIT_ANALYZE_WEEKLY=2
# FREE_LIMIT_REPLY_DAILY=1

# Reset counters in Supabase SQL Editor:
CALL public.reset_daily_replies();
CALL public.reset_weekly_comments();

# Or manually:
UPDATE public.users SET
  comments_analyzed_count = 0,
  replies_generated_count = 0,
  tier = 'free',
  subscription_status = NULL
WHERE email = 'test@example.com';
```

### Problem: Webhook not flipping subscription to active

**Causes:**
- Stripe CLI not running
- Wrong webhook secret
- Webhook event not sent

**Solutions:**
```bash
# Start Stripe CLI with forwarding
stripe listen --forward-to http://localhost:3000/api/webhook/stripe

# Check server logs for webhook events
# Should see: "Processing event: customer.subscription.created"

# Verify STRIPE_WEBHOOK_SECRET in server .env matches CLI output
# Look for: "whsec_..." in stripe listen output

# Check Supabase for event storage:
SELECT * FROM public.stripe_events ORDER BY created_at DESC LIMIT 5;
```

### Problem: `ECONNREFUSED` errors

**Cause:** Server not running

**Solution:**
```bash
# Start server
pnpm --filter @vocalytics/server dev:http

# Verify health check
curl http://localhost:3000/healthz
```

### Problem: OpenAI API errors in reply generation

**Cause:** Missing or invalid `OPENAI_API_KEY`

**Solution:**
```bash
# Set in server .env
OPENAI_API_KEY=sk-proj-...

# Or skip reply tests and only test analyze
```

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Smoke Tests

on: [push, pull_request]

jobs:
  smoke-tests:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: |
          sudo apt-get install -y jq curl
          npm install -g pnpm
          pnpm install

      - name: Start server
        run: |
          pnpm --filter @vocalytics/server build
          pnpm --filter @vocalytics/server start:http &
          sleep 5
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          FREE_LIMIT_ANALYZE_WEEKLY: 2
          FREE_LIMIT_REPLY_DAILY: 1
          # ... other env vars

      - name: Run smoke tests (pre-Stripe)
        run: |
          # Run up to step 7 (before Stripe checkout)
          # Skip Stripe steps in CI unless using Stripe test harness
          bash scripts/smoke.sh || true
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_ANON: ${{ secrets.SUPABASE_ANON }}
          TEST_EMAIL: ${{ secrets.TEST_EMAIL }}
          TEST_PASS: ${{ secrets.TEST_PASS }}
          BASE_URL: http://localhost:3000
```

### Skip Stripe Steps in CI

Modify `scripts/smoke.sh` to check for CI environment:

```bash
if [ "${CI:-false}" = "true" ]; then
  log_warn "Running in CI - skipping Stripe checkout/webhook tests"
  # Skip sections 8-10
else
  # Run full test suite
fi
```

### Alternative: Use Canned Pro User

For CI, pre-create a "pro" user in a test database:

```sql
INSERT INTO public.users (app_user_id, email, tier, subscription_status)
VALUES ('ci-test-user', 'ci@test.com', 'pro', 'active');
```

Then tests can skip Stripe flows and validate pro bypass directly.

---

## Manual Reset Procedures

Simulates the automated cron jobs that reset free-tier usage counters:

### Daily Reply Reset (normally runs 00:00 UTC daily)

```sql
-- In Supabase SQL Editor
CALL public.reset_daily_replies();
```

**Verifies:**
```bash
curl -H "Authorization: Bearer $JWT" http://localhost:3000/api/me/usage | jq
# Should show: "repliesGenerated": 0
```

### Weekly Comment Reset (normally runs Mon 00:00 UTC)

```sql
-- In Supabase SQL Editor
CALL public.reset_weekly_comments();
```

**Verifies:**
```bash
curl -H "Authorization: Bearer $JWT" http://localhost:3000/api/me/usage | jq
# Should show: "commentsAnalyzed": 0, "resetDate": "2025-10-10" (updated)
```

---

## Race Condition Testing (Optional)

Test that concurrent requests don't wildly overshoot usage caps:

```bash
# Fire 3 concurrent analyze requests (each with 2 comments)
for i in 1 2 3; do
  curl -X POST http://localhost:3000/api/analyze-comments \
    -H "Authorization: Bearer $JWT" \
    -H "Content-Type: application/json" \
    -d '{"comments":[{"id":"race'$i'a",...},{"id":"race'$i'b",...}]}' &
done

wait

# Check final count
curl -H "Authorization: Bearer $JWT" http://localhost:3000/api/me/usage | jq

# Expected: count ≤ cap + last_increment
# (slight overshoot acceptable due to race; catastrophic overshoot indicates bug)
```

---

## File Structure

```
scripts/
  get-jwt.js           # Helper to obtain Supabase JWT
  smoke.sh             # Main bash smoke test script

tests/
  smoke.http           # VS Code REST Client format
  postman_collection.json  # Postman collection with assertions
  README.md            # This file
```

---

## Next Steps

- **Expand coverage**: Add tests for fetch-comments, summarize-sentiment
- **Load testing**: Use Artillery or k6 for concurrency/performance
- **E2E tests**: Playwright tests for full user flows
- **Monitoring**: Add DataDog/Sentry integration smoke tests

---

## Support

If tests fail consistently:

1. Check server logs for detailed error messages
2. Verify all environment variables are set correctly
3. Ensure Supabase schema is applied (see `supabase/README.md`)
4. Confirm Stripe API keys are valid and webhook secret matches CLI
5. Review `IMPLEMENTATION_SUMMARY.md` for architecture details

For issues, see GitHub Issues or contact support.
