# E2E Test Setup Guide

## Overview
The `tests/` directory contains comprehensive end-to-end tests that verify the entire application stack. These tests require a running server instance to execute properly.

## Test Files

### Core Functionality Tests
- **`verify.spec.ts`** - Core API functionality and quota enforcement
- **`security.spec.ts`** - Security validations and auth boundaries
- **`ratelimit.spec.ts`** - Rate limiting enforcement

### Billing & Subscription Tests
- **`billing.spec.ts`** - Payment flows and Stripe integration
- **`billing_lifecycle.spec.ts`** - Complete subscription lifecycle
  - Subscribe → Use → Cancel → Reactivate flows

### Integration Tests
- **`youtube.oauth.spec.ts`** - YouTube OAuth connection flow
- **`concurrency.spec.ts`** - Concurrent request handling
- **`race.spec.ts`** - Race condition prevention

### Operational Tests
- **`ops.spec.ts`** - Operational checks (logging, headers, etc.)
- **`prod.spec.ts`** - Production readiness verification

## Prerequisites

### Environment Variables
Create a `.env.local` file in `packages/server/` with:

```bash
# Database
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-key

# Auth
JWT_SECRET=your-jwt-secret
COOKIE_SECRET=your-cookie-secret

# Stripe (for billing tests)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...

# OpenAI (for analysis tests)
OPENAI_API_KEY=sk-...

# YouTube (for OAuth tests)
YOUTUBE_CLIENT_ID=your-client-id
YOUTUBE_CLIENT_SECRET=your-client-secret

# Quota Configuration (for testing)
FREE_LIMIT_ANALYZE_WEEKLY=2
FREE_LIMIT_REPLY_DAILY=1
```

### Database Setup
The E2E tests expect:
1. Clean database state (or ability to reset test user)
2. Required tables: `profiles`, `video_analyses`, `usage`, etc.
3. Database functions for atomic quota consumption

## Running E2E Tests

### Method 1: Two Terminal Setup (Recommended)

**Terminal 1 - Start Server:**
```bash
cd /Users/logangrant/Desktop/Vocalytics
pnpm dev:server
```

Wait for server to be ready:
```
✅ HTTP server listening on 0.0.0.0:3000
   Environment: development
```

**Terminal 2 - Run Tests:**
```bash
# Run all E2E tests
pnpm test tests/

# Run specific test file
pnpm test tests/verify.spec.ts

# Run with verbose output
pnpm test tests/ --reporter=verbose

# Run specific test suite
pnpm test tests/billing.spec.ts
```

### Method 2: Using Test Script

Create a test script `scripts/test-e2e.sh`:

```bash
#!/bin/bash

# Start server in background
echo "Starting server..."
pnpm dev:server &
SERVER_PID=$!

# Wait for server to be ready
sleep 5

# Run E2E tests
echo "Running E2E tests..."
pnpm test tests/

# Capture exit code
TEST_EXIT=$?

# Kill server
kill $SERVER_PID

# Exit with test result
exit $TEST_EXIT
```

Make it executable:
```bash
chmod +x scripts/test-e2e.sh
./scripts/test-e2e.sh
```

### Method 3: Docker Compose (CI/CD)

Create `docker-compose.test.yml`:

```yaml
version: '3.8'
services:
  server:
    build: .
    environment:
      - NODE_ENV=test
      - PORT=3000
    env_file:
      - packages/server/.env.local
    ports:
      - "3000:3000"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/healthz"]
      interval: 5s
      timeout: 3s
      retries: 3

  tests:
    build: .
    depends_on:
      server:
        condition: service_healthy
    environment:
      - BASE_URL=http://server:3000
    command: pnpm test tests/
```

Run with:
```bash
docker-compose -f docker-compose.test.yml up --abort-on-container-exit
```

## Test Configuration

### Environment-Specific Settings

Tests use the `BASE_URL` environment variable to locate the server:

```bash
# Local development (default)
BASE_URL=http://localhost:3000

# Docker
BASE_URL=http://server:3000

# Staging
BASE_URL=https://staging.vocalytics.com

# Production (use with caution!)
BASE_URL=https://api.vocalytics.com
```

### Quota Configuration

For testing quota enforcement, set specific limits:

```bash
FREE_LIMIT_ANALYZE_WEEKLY=2  # Allow 2 analyses in tests
FREE_LIMIT_REPLY_DAILY=1     # Allow 1 reply in tests
```

### Test User Setup

E2E tests create a test user. To use a specific test account:

```bash
TEST_EMAIL=test@vocalytics.dev
TEST_PASS=TestPass123!
```

## Troubleshooting

### Tests Fail with "fetch failed" or "ECONNREFUSED"

**Problem**: Server isn't running or wrong URL

**Solution**:
```bash
# Check server is running
curl http://localhost:3000/healthz

# Check BASE_URL matches
echo $BASE_URL
```

### Tests Fail with "quota exceeded" immediately

**Problem**: Test user has leftover usage from previous run

**Solution**:
```bash
# Reset test user quota in database
psql $SUPABASE_URL -c "UPDATE profiles SET comments_analyzed_count=0, replies_generated_count=0 WHERE email='test@vocalytics.dev';"

# Or use migration script
pnpm tsx packages/server/reset-quota.js
```

### Stripe webhook tests fail

**Problem**: Stripe webhook signature verification failing

**Solution**:
1. Use Stripe CLI to forward webhooks:
```bash
stripe listen --forward-to localhost:3000/webhook/stripe
```

2. Copy webhook secret to `.env.local`:
```bash
STRIPE_WEBHOOK_SECRET=whsec_...
```

### YouTube OAuth tests fail

**Problem**: OAuth redirect URL mismatch

**Solution**:
1. Configure redirect URL in Google Cloud Console:
```
http://localhost:3000/api/youtube/callback
```

2. Ensure CLIENT_ID and CLIENT_SECRET are correct

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  e2e:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install pnpm
        run: npm install -g pnpm

      - name: Install dependencies
        run: pnpm install

      - name: Build
        run: pnpm build

      - name: Start server
        run: |
          pnpm dev:server &
          sleep 10
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          JWT_SECRET: ${{ secrets.JWT_SECRET }}

      - name: Run E2E tests
        run: pnpm test tests/
        env:
          BASE_URL: http://localhost:3000

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: e2e-test-results
          path: test-results/
```

## Test Data Cleanup

After running tests, you may want to clean up test data:

```sql
-- Delete test user and related data
DELETE FROM video_analyses WHERE user_id IN (
  SELECT id FROM profiles WHERE email LIKE '%@test.com'
);

DELETE FROM profiles WHERE email LIKE '%@test.com';

-- Reset quota for all users (use carefully!)
UPDATE profiles SET
  comments_analyzed_count = 0,
  replies_generated_count = 0;
```

Or use a cleanup script:

```bash
pnpm tsx scripts/cleanup-test-data.ts
```

## Best Practices

### 1. Isolate Test Data
- Use distinct test email addresses
- Clean up after test runs
- Don't run tests against production!

### 2. Idempotent Tests
- Tests should be able to run multiple times
- Use unique identifiers (timestamps, UUIDs)
- Reset state between test suites

### 3. Parallel Execution
- E2E tests can be slow
- Consider running in parallel with `--maxWorkers`
- Ensure tests don't interfere with each other

### 4. Monitoring
- Log all test API calls
- Track test execution time
- Alert on test failures in CI/CD

## Support

For issues with E2E tests:
1. Check server logs: Look for errors in server terminal
2. Check test output: Run with `--reporter=verbose`
3. Verify environment: Ensure all required env vars are set
4. Check database: Verify schema and data are correct

## Future Improvements

- [ ] Dockerize test environment for consistency
- [ ] Add visual regression testing
- [ ] Add performance benchmarking
- [ ] Add cross-browser testing
- [ ] Add mobile app E2E tests
