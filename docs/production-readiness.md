# Production Readiness Checklist

This document outlines all production readiness features, their test coverage, and configuration requirements.

---

## Security & Operations Features

### ✅ 1. Global Rate Limiting
**Implementation:** `packages/server/src/http/rateLimit.ts`

- **Algorithm:** Token bucket with per-user (JWT ID) + IP tracking
- **Default Limit:** 60 requests/minute (configurable via `RATE_LIMIT_PER_MINUTE`)
- **Headers Exposed:**
  - `X-RateLimit-Limit`: Maximum requests allowed
  - `X-RateLimit-Remaining`: Requests remaining in window
  - `Retry-After`: Seconds until rate limit resets (on 429)
- **YouTube Routes:** Additional 10 req/min limit enforced in route handlers

**Tests:** `tests/ratelimit.spec.ts`
- ✓ Returns 429 after exceeding limit
- ✓ Includes rate limit headers on success and 429
- ✓ Allows requests after Retry-After period
- ✓ Stable error structure (no stack traces)

---

### ✅ 2. CORS Allowlist
**Implementation:** `packages/server/src/http/cors.ts`

- **NO Wildcard (`*`)**: Strict origin checking
- **Configuration:** `CORS_ORIGINS` environment variable (comma-separated)
- **Default (dev):** `http://localhost:3000,http://localhost:5173`
- **Pattern Support:** Wildcard subdomains (e.g., `*.vercel.app`)

**Tests:** `tests/security.spec.ts`
- ✓ Rejects malicious origins
- ✓ No wildcard in `Access-Control-Allow-Origin`
- ✓ No credentials with wildcard

**Example Configuration:**
```bash
CORS_ORIGINS=http://localhost:3000,https://vocalytics-alpha.vercel.app
```

---

### ✅ 3. Security Headers
**Implementation:** `packages/server/src/http/index.ts`

Headers automatically applied to all responses:
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block` (legacy)
- `Permissions-Policy: geolocation=(), microphone=(), camera=()`

**Tests:** `tests/ops.spec.ts`
- ✓ X-Content-Type-Options present
- ✓ Referrer-Policy present
- ✓ X-Frame-Options or CSP frame-ancestors

---

### ✅ 4. Body Size Limits
**Implementation:** Fastify `bodyLimit: 1MB`

- **Limit:** 1MB for JSON payloads
- **Response:** 413 Payload Too Large or 400 Bad Request (deterministic)

**Tests:** `tests/security.spec.ts`
- ✓ Rejects payloads exceeding body limit
- ✓ Returns 413 or 400 (not 500)

---

### ✅ 5. Request ID Tracking
**Implementation:** `packages/server/src/http/index.ts`

- **Header:** `X-Request-Id`
- **Generation:** Uses provided ID or generates `req_${timestamp}_${random}`
- **Logging:** Included in all structured logs

**Tests:** `tests/ops.spec.ts`
- ✓ Echoes X-Request-Id if provided
- ✓ Generates X-Request-Id if not provided

---

### ✅ 6. Structured Logging
**Implementation:** Fastify logger + custom hooks

Logs include:
- `requestId`: Unique request identifier
- `method`: HTTP method
- `url`: Request path
- `status`: Response status code
- `duration`: Response time in milliseconds
- `userId`: Authenticated user ID (or 'anonymous')

**Tests:** `tests/ops.spec.ts` (documentation test)
- Documents required log fields and standards

---

### ✅ 7. Health Check Endpoint
**Implementation:** `GET /healthz`

**Response Shape:**
```json
{
  "ok": true,
  "version": "1.0.0",
  "time": "2024-10-13T12:00:00Z",
  "db": "ok",
  "stripeWebhook": "configured"
}
```

- **DB Check:** Lightweight `SELECT id FROM profiles LIMIT 1`
- **Stripe Check:** Verifies `STRIPE_WEBHOOK_SECRET` env var present

**Tests:** `tests/ops.spec.ts`
- ✓ Returns 200 with required fields (ok, version, time, db, stripeWebhook)
- ✓ Does not expose internal paths

---

### ✅ 8. Environment Validation
**Implementation:** `packages/server/src/http/envValidation.ts`

Validates critical environment variables on startup:
- `SUPABASE_URL` (required)
- `SUPABASE_SERVICE_ROLE_KEY` (required)
- `STRIPE_SECRET_KEY` (required)
- `STRIPE_WEBHOOK_SECRET` (required)
- `GOOGLE_CLIENT_ID` (optional)
- `GOOGLE_CLIENT_SECRET` (optional)
- `CORS_ORIGINS` (optional)

**Output:** Startup logs show configured/missing vars (non-fatal warnings)

**Dev Endpoint:** `GET /api/me/env` (only in development)
- Returns `{ VAR_NAME: true/false }` for each critical var

---

### ✅ 9. Error Handling
**Implementation:** Custom error handlers + Fastify defaults

- **Production:** No stack traces in error responses
- **Stable Structure:** `{ error: string, message?: string, code?: string }`
- **Status Codes:**
  - `400`: Bad Request (validation errors)
  - `401`: Unauthorized (missing/invalid JWT)
  - `402`: Payment Required (paywall)
  - `403`: Forbidden (YouTube not connected, insufficient scope)
  - `413`: Payload Too Large (body limit)
  - `429`: Rate Limit Exceeded
  - `500`: Internal Server Error (sanitized)

**Tests:** `tests/security.spec.ts`, `tests/ops.spec.ts`
- ✓ No stack traces in 4xx/5xx responses
- ✓ Stable error structure
- ✓ No internal paths exposed

---

## YouTube OAuth Integration

### ✅ Scope Management
**Implementation:** `packages/server/src/http/routes/youtube.ts`

**Required Scopes:**
- `youtube.readonly`: Read comments
- `youtube.force-ssl`: Post replies

**OAuth Flow:**
1. `GET /api/youtube/connect` → Redirects to Google with `access_type=offline` and `prompt=consent`
2. Google callback → Stores tokens in `profiles` table
3. Auto-refresh when token expires within 60 seconds

**Insufficient Scope Handling:**
- If user only granted `youtube.readonly`, posting replies returns:
  ```json
  {
    "error": "Insufficient Permissions",
    "needsReconnect": true
  }
  ```
- Client should prompt user to re-authorize via `/api/youtube/connect`

**Tests:** `tests/youtube.oauth.spec.ts`
- ✓ OAuth URL includes both scopes, access_type=offline, prompt=consent
- ✓ Returns needsReconnect on 403 insufficient scope
- ✓ Enforces 220 character limit on replies
- ✓ Requires videoId for comments endpoint
- ✓ Requires parentId and text for reply endpoint

---

## Running Tests

### Local Development
```bash
# Install dependencies
pnpm -w install

# Build packages
pnpm -w build

# Run all tests
pnpm test:prod
```

### Test Suites
1. **`tests/security.spec.ts`**: CORS, body limits, input validation, XSS/SQL injection
2. **`tests/ops.spec.ts`**: Security headers, request IDs, healthz, error format
3. **`tests/billing_lifecycle.spec.ts`**: Stripe checkout, activation, cancellation
4. **`tests/concurrency.spec.ts`**: Atomic counters under parallel load
5. **`tests/youtube.oauth.spec.ts`**: OAuth flow, scope handling, comment/reply endpoints
6. **`tests/ratelimit.spec.ts`**: Global and per-route rate limits
7. **`tests/verify.spec.ts`**: Core E2E happy paths (analyze, replies)

### Expected Output
```
✅ Production Readiness Gate: PASSED (all suites green)
```

If tests fail, output includes:
- Suite name
- Failing assertion
- Exact error message

---

## Configuration Guide

### Required Environment Variables (Production)
```bash
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
PRICE_ID=price_...

# Google OAuth (YouTube)
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
GOOGLE_REDIRECT_URI_PROD=https://vocalytics-alpha.vercel.app/api/youtube/callback

# CORS
CORS_ORIGINS=https://vocalytics-alpha.vercel.app

# Optional
SENTRY_DSN=https://xxx@sentry.io/xxx
RATE_LIMIT_PER_MINUTE=60
APP_ENV=production
NODE_ENV=production
```

### Vercel Deployment
```bash
# Add environment variables
vercel env add SUPABASE_URL
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add STRIPE_SECRET_KEY
vercel env add STRIPE_WEBHOOK_SECRET
vercel env add GOOGLE_CLIENT_ID
vercel env add GOOGLE_CLIENT_SECRET
vercel env add GOOGLE_REDIRECT_URI_PROD
vercel env add CORS_ORIGINS
vercel env add APP_ENV

# Deploy
git push origin main
```

---

## Optional Integrations

### Sentry (Error Tracking)
**Status:** Documented, not yet implemented

**Implementation Guide:**
```bash
pnpm add @sentry/node
```

Add to `packages/server/src/http/index.ts`:
```typescript
import * as Sentry from '@sentry/node';

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.APP_ENV || 'development',
    tracesSampleRate: 0.1,
  });

  // Add Sentry error handler
  fastify.setErrorHandler((error, request, reply) => {
    Sentry.captureException(error, {
      tags: {
        requestId: request.id,
        userId: (request as any).auth?.userId || 'anonymous',
      },
    });
    reply.send(error);
  });
}
```

---

## CI/CD Pipeline

### GitHub Actions
**File:** `.github/workflows/verify.yml`

**Triggers:**
- Pull requests to `main`
- Pushes to `main`

**Steps:**
1. Checkout code
2. Setup Node.js 20 + pnpm
3. Cache pnpm store
4. Install dependencies
5. Build packages
6. Run typecheck
7. Run lint (non-blocking)
8. Run test suite (`pnpm test:prod`)
9. Verify OpenAPI spec exists

**Exit Codes:**
- `0`: All checks passed ✅
- `1`: One or more checks failed ❌

---

## Production Deployment Checklist

Before deploying to production:

- [ ] All tests pass (`pnpm test:prod`)
- [ ] Build succeeds (`pnpm -w build`)
- [ ] Environment variables configured in Vercel
- [ ] CORS origins include production domain
- [ ] Google OAuth redirect URI updated in Google Cloud Console
- [ ] Supabase database migration applied
- [ ] Stripe webhook endpoint configured
- [ ] Rate limits tuned for expected traffic
- [ ] Sentry DSN configured (optional)

---

## Monitoring & Alerting

### Key Metrics to Monitor
1. **Rate Limit Hit Rate**: 429 responses / total requests
2. **Health Check Failures**: `/healthz` returns `db: "error"`
3. **YouTube OAuth Failures**: 403 responses on `/api/youtube/*`
4. **Paywall Trigger Rate**: 402 responses / authenticated requests
5. **Response Time P95**: 95th percentile latency
6. **Error Rate**: 5xx responses / total requests

### Recommended Tools
- **Vercel Analytics**: Built-in for response times and error rates
- **Sentry**: Error tracking with context (requestId, userId)
- **Supabase Logs**: Database query performance
- **Stripe Dashboard**: Webhook delivery monitoring

---

## Troubleshooting

### Rate Limit Issues
**Symptom:** Frequent 429 responses

**Solutions:**
1. Increase `RATE_LIMIT_PER_MINUTE` environment variable
2. Consider Upstash Redis for distributed rate limiting across Vercel instances
3. Implement per-tier rate limits (higher for Pro users)

### CORS Errors in Production
**Symptom:** Browser blocks API requests with CORS error

**Solution:**
1. Verify `CORS_ORIGINS` includes production domain
2. Check that domain uses HTTPS (not HTTP)
3. Ensure no trailing slashes in origin

### YouTube OAuth Fails
**Symptom:** Users stuck on OAuth consent screen

**Solution:**
1. Verify `GOOGLE_REDIRECT_URI_PROD` matches Google Cloud Console configuration
2. Ensure OAuth client type is "Web application" (NOT "Desktop")
3. Check `APP_ENV=production` is set in Vercel

### Health Check DB Error
**Symptom:** `/healthz` returns `db: "error"`

**Solution:**
1. Verify `SUPABASE_SERVICE_ROLE_KEY` is correct
2. Check Supabase project is not paused
3. Verify RLS policies allow service role to query `profiles` table

---

## OpenAPI Specification

**File:** `openapi.yaml`

OpenAI Actions-ready specification covering:
- Authentication (Bearer JWT)
- All `/api/*` endpoints
- Request/response schemas
- Error responses (including paywall)
- YouTube OAuth endpoints

**Usage:**
- Import into Postman, Insomnia, or similar tools
- Use for OpenAI GPT Actions configuration
- Generate client SDKs with `openapi-generator`

---

**Last Updated:** 2024-10-13
**Version:** 1.0.0
