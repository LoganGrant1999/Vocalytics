## Vocalytics Production Readiness Tests

Comprehensive test suite validating production deployment readiness including API functionality, security, billing integration, and concurrent behavior.

## Quick Start

```bash
# 1. Set environment variables
export BASE_URL=http://localhost:3000
export SUPABASE_URL=https://xxx.supabase.co
export SUPABASE_ANON=eyJhbGc...
export TEST_EMAIL=test@example.com
export TEST_PASS=password123
export STRIPE_PRICE_ID=price_xxx
export EXPECT_ANALYZE_CAP=2
export EXPECT_REPLY_CAP=1

# 2. Start server (Terminal 1)
pnpm --filter @vocalytics/server dev:http

# 3. Start Stripe listener (Terminal 2)
stripe listen --forward-to http://localhost:3000/api/webhook/stripe

# 4. Run all tests (Terminal 3)
bash scripts/prod_check.sh
```

## Test Suites

### 1. Production API Tests (`prod.spec.ts`)
**Coverage:**
- ✅ Health check endpoint
- ✅ Authentication (401 without JWT)
- ✅ Subscription baseline (tier=free)
- ✅ Analyze comments quota (2 OK, 3rd → 402)
- ✅ Reply generation quota (1 OK, 2nd → 402)
- ✅ Usage endpoint accuracy
- ✅ Billing endpoints (checkout/portal)
- ✅ Fetch comments (no paywall)
- ✅ Summarize sentiment (no paywall)

**Run:**
```bash
npx vitest run tests/prod.spec.ts
```

### 2. Security Tests (`security.spec.ts`)
**Coverage:**
- ✅ Invalid/malformed tokens → 401
- ✅ CORS policy validation
- ✅ Body size limits (20MB payloads → 413/400)
- ✅ Input validation (missing fields → 400)
- ✅ SQL injection protection
- ✅ XSS protection

**Run:**
```bash
npx vitest run tests/security.spec.ts
```

### 3. Billing Tests (`billing.spec.ts`)
**Coverage:**
- ✅ Checkout session creation
- ✅ Subscription activation via webhook
- ✅ Pro user paywall bypass
- ✅ Webhook idempotency
- ✅ Billing portal session
- 📋 Manual: Cancellation flow
- 📋 Manual: Payment failure flow

**Run:**
```bash
npx vitest run tests/billing.spec.ts
```

**Manual Steps:**
1. Complete checkout with test card `4242 4242 4242 4242`
2. Wait for webhook to activate subscription (max 120s)
3. Tests verify pro tier and paywall bypass

### 4. Race Condition Tests (`race.spec.ts`)
**Coverage:**
- ✅ Concurrent analyze requests (atomic counters)
- ✅ Concurrent reply requests
- ✅ Counter accuracy (no catastrophic drift)

**Run:**
```bash
npx vitest run tests/race.spec.ts
```

### 5. Load Tests (`rate_limit.k6.js`) - Optional
**Coverage:**
- 📊 Rate limiting detection (429 responses)
- 📊 Performance benchmarks
- 📊 Concurrent user simulation

**Run:**
```bash
RUN_K6=1 bash scripts/prod_check.sh
# Or directly:
JWT=$JWT BASE_URL=$BASE_URL k6 run tests/rate_limit.k6.js
```

## Environment Variables

### Required
```bash
BASE_URL=http://localhost:3000           # Server URL
SUPABASE_URL=https://xxx.supabase.co     # Supabase project URL
SUPABASE_ANON=eyJhbGc...                 # Supabase anon key
TEST_EMAIL=test@example.com              # Test user email
TEST_PASS=password123                    # Test user password
STRIPE_PRICE_ID=price_xxx                # Stripe price ID
```

### Optional
```bash
EXPECT_ANALYZE_CAP=2                     # Expected weekly analyze limit
EXPECT_REPLY_CAP=1                       # Expected daily reply limit
RUN_K6=1                                 # Run k6 load tests
STRIPE_WEBHOOK_SECRET=whsec_...          # Set by stripe listener
```

## Prerequisites

### Tools
```bash
# macOS
brew install curl jq node stripe k6

# Linux
apt-get install curl jq nodejs npm
npm install -g stripe
```

### Stripe CLI Setup
```bash
# Install
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Start listener (required for billing tests)
stripe listen --forward-to http://localhost:3000/api/webhook/stripe
```

### Test User Setup
1. Go to Supabase Dashboard > Authentication > Users
2. Create user with TEST_EMAIL and TEST_PASS
3. Confirm user (disable email confirmation for testing)

### Server Configuration
Update `packages/server/.env`:
```bash
FREE_LIMIT_ANALYZE_WEEKLY=2
FREE_LIMIT_REPLY_DAILY=1
STRIPE_WEBHOOK_SECRET=whsec_...  # From stripe listen output
```

## Success Criteria

```
✅ ALL TESTS PASSED - PRODUCTION READY! ✅

Summary:
  ✓ Production API tests
  ✓ Security tests
  ✓ Billing & Stripe tests
  ✓ Race condition tests
  ✓ Load tests (if RUN_K6=1)

🎉 Your application is ready for production deployment!
```

## Troubleshooting

### 401 Unauthorized
**Cause:** JWT expired or invalid

**Solution:**
```bash
# Get fresh JWT
JWT=$(SUPABASE_URL=$SUPABASE_URL SUPABASE_ANON=$SUPABASE_ANON \
  TEST_EMAIL=$TEST_EMAIL TEST_PASS=$TEST_PASS node scripts/get-jwt.js)
export JWT
```

### Paywall Not Triggering (No 402)
**Cause:** Limits too high or counters not reset

**Solution:**
```bash
# Check server limits
grep FREE_LIMIT packages/server/.env

# Reset counters in Supabase SQL Editor
UPDATE public.users SET
  comments_analyzed_count = 0,
  replies_generated_count = 0
WHERE email = 'test@example.com';
```

### Webhook Not Activating Subscription
**Causes:**
- Stripe CLI not running
- Wrong webhook secret
- Event not sent

**Solutions:**
```bash
# 1. Verify listener running
ps aux | grep "stripe listen"

# 2. Check webhook secret matches
grep STRIPE_WEBHOOK_SECRET packages/server/.env

# 3. Check server logs for webhook events
# Should see: "Processing event: customer.subscription.created"

# 4. Verify event in Stripe Dashboard
stripe events list --limit 5
```

### Server Not Running
**Cause:** ECONNREFUSED errors

**Solution:**
```bash
# Start server
pnpm --filter @vocalytics/server dev:http

# Verify
curl http://localhost:3000/healthz
```

### k6 Tests Skipped
**Cause:** k6 not installed or RUN_K6 not set

**Solution:**
```bash
# Install k6
brew install k6

# Run with k6 enabled
RUN_K6=1 bash scripts/prod_check.sh
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Production Readiness Tests

on: [push, pull_request]

jobs:
  prod-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3

      - name: Install dependencies
        run: |
          sudo apt-get install -y jq curl
          npm install -g pnpm
          pnpm install

      - name: Start server
        run: pnpm --filter @vocalytics/server start:http &
        env:
          FREE_LIMIT_ANALYZE_CAP: 2
          FREE_LIMIT_REPLY_DAILY: 1
          # Add all env vars from secrets

      - name: Run tests (without Stripe)
        run: |
          # Run non-Stripe tests
          npx vitest run tests/prod.spec.ts tests/security.spec.ts tests/race.spec.ts
        env:
          BASE_URL: http://localhost:3000
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          # ... other secrets
```

### Skip Stripe Tests in CI
Billing tests require manual checkout completion. For CI:
1. Mark billing tests as `it.skip` or `describe.skip`
2. Or create pre-subscribed test user
3. Or use Stripe test harness API

## Alternative Test Methods

### VS Code REST Client
1. Install [REST Client extension](https://marketplace.visualstudio.com/items?itemName=humao.rest-client)
2. Open `tests/rest/prod.http`
3. Update `@jwt` variable with token from `get-jwt.js`
4. Click "Send Request" on each test

### Postman
1. Import `tests/postman_collection.json`
2. Set environment variables (baseUrl, jwt, etc.)
3. Run collection with assertions enabled

## Files

```
scripts/
  get-jwt.js              # Get Supabase JWT token
  stripe_helpers.sh       # Stripe CLI utilities
  prod_check.sh           # Main test orchestrator

tests/
  utils.ts                # Shared test utilities
  prod.spec.ts            # Production API tests
  security.spec.ts        # Security validation
  billing.spec.ts         # Stripe integration tests
  race.spec.ts            # Concurrency tests
  rate_limit.k6.js        # Load tests (k6)
  rest/
    prod.http             # REST Client format
  postman_collection.json # Postman collection
  PROD_README.md          # This file

vitest.config.ts          # Vitest configuration
```

## Next Steps

After tests pass:

1. **Deploy to staging:**
   ```bash
   # Set production env vars
   # Deploy and run: bash scripts/prod_check.sh
   ```

2. **Monitor in production:**
   - Set up DataDog/Sentry
   - Enable error tracking
   - Monitor webhook delivery

3. **Expand tests:**
   - Add E2E browser tests (Playwright)
   - Add performance benchmarks
   - Add data integrity tests

4. **Automate resets:**
   - Verify pg_cron is working
   - Test reset procedures
   - Monitor counter accuracy

## Support

For issues:
1. Check server logs for detailed errors
2. Verify all environment variables are set
3. Ensure Supabase schema is applied
4. Confirm Stripe webhooks are forwarding
5. Review `IMPLEMENTATION_SUMMARY.md` for architecture

Report bugs: https://github.com/your-org/vocalytics/issues
