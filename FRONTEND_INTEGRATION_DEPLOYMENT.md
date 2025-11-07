# Frontend Integration & Deployment Guide

This guide explains how to deploy the Vocalytics backend and integrate it with your new React frontend.

## Architecture Overview

- **Backend (this repo)**: Fastify API deployed to Vercel as serverless functions
- **Frontend (separate repo)**: React + Vite app deployed separately to Vercel
- **Integration**: Frontend calls backend REST API via fetch with HttpOnly cookie auth

## Backend Changes Made

### 1. CORS Configuration ✅
- Added `localhost:8080` to allowed origins for local development
- Updated `.env.example` with instructions to add frontend Vercel domain
- Location: `packages/server/src/http/cors.ts`

### 2. Enhanced `/api/auth/me` Endpoint ✅
- Now returns user info + quota in a single request
- Response format:
  ```json
  {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "avatar": "https://...",
      "tier": "free",
      "emailVerified": true,
      "hasYouTubeConnected": true,
      "createdAt": "2025-01-01T00:00:00Z"
    },
    "quota": {
      "analyze_weekly_count": 1,
      "analyze_weekly_limit": 2,
      "reply_daily_count": 0,
      "reply_daily_limit": 1,
      "period_start": "2025-01-01T00:00:00Z"
    }
  }
  ```

### 3. Vercel Configuration ✅
- Updated `vercel.json` for API-only deployment
- Routes all requests through serverless function handler
- Configured cron jobs for queue processing and counter resets

## API Endpoints Reference

All endpoints are available at: `https://your-backend.vercel.app/api/*`

### Authentication
- `POST /api/auth/register` - Register with email/password
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user + quota (requires auth)
- `GET /api/auth/youtube` - Initiate YouTube OAuth
- `GET /api/youtube/callback` - OAuth callback

### YouTube API
- `GET /api/youtube/videos` - List user's videos (requires auth)
- `GET /api/youtube/comments?videoId=xxx` - Fetch comments (requires auth)

### Analysis & AI
- `POST /api/analyze-comments` - Sentiment analysis (requires auth, uses weekly quota)
- `POST /api/generate-replies` - Generate AI replies (requires auth, uses daily quota)

### Billing
- `POST /api/billing/checkout` - Create Stripe checkout session (requires auth)
- `POST /api/billing/portal` - Create Stripe customer portal session (requires auth)

### User Info
- `GET /api/me/subscription` - Get subscription details (requires auth)
- `GET /api/me/usage` - Get usage stats (requires auth)

## Deployment Steps

### Step 1: Deploy Backend to Vercel

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy from this repo**:
   ```bash
   vercel
   ```

   - Choose a project name (e.g., `vocalytics-backend` or `vocalytics-api`)
   - Note the deployment URL (e.g., `https://vocalytics-backend.vercel.app`)

4. **Set Environment Variables** in Vercel Dashboard:

   Go to your project settings → Environment Variables and add:

   ```bash
   # Supabase
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

   # YouTube OAuth
   GOOGLE_CLIENT_ID=your_client_id
   GOOGLE_CLIENT_SECRET=your_client_secret
   GOOGLE_REDIRECT_URI_LOCAL=http://localhost:3000/api/youtube/callback
   GOOGLE_REDIRECT_URI_PROD=https://your-backend.vercel.app/api/youtube/callback
   APP_ENV=production

   # OpenAI
   OPENAI_API_KEY=sk-...
   REPLIES_MODEL=gpt-4o-mini
   MODERATION_MODEL=omni-moderation-latest

   # Stripe
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   STRIPE_PRICE_ID=price_...
   STRIPE_CHECKOUT_SUCCESS_URL=https://your-frontend.vercel.app/billing?success=true
   STRIPE_CHECKOUT_CANCEL_URL=https://your-frontend.vercel.app/billing
   STRIPE_PORTAL_RETURN_URL=https://your-frontend.vercel.app/billing

   # Public URLs
   PUBLIC_PRICING_URL=https://your-frontend.vercel.app/pricing
   PUBLIC_BILLING_URL=https://your-frontend.vercel.app/billing

   # Free tier limits
   FREE_LIMIT_ANALYZE_WEEKLY=2
   FREE_LIMIT_REPLY_DAILY=1

   # Security
   CORS_ORIGINS=https://your-frontend.vercel.app
   RATE_LIMIT_PER_MINUTE=60
   JWT_SECRET=your-random-jwt-secret-here
   COOKIE_SECRET=your-random-cookie-secret-here

   # Cron jobs
   CRON_SECRET=your-random-cron-secret-here

   # Server config
   PORT=3000
   NODE_ENV=production
   ```

   **Important**: Replace all placeholder values with your actual credentials!

5. **Redeploy** to apply environment variables:
   ```bash
   vercel --prod
   ```

### Step 2: Update Frontend Configuration

In your **frontend repo**, update the API base URL:

1. Create/update `.env` file:
   ```bash
   VITE_API_URL=https://your-backend.vercel.app
   ```

2. Update your API client to use this base URL for all requests

3. Ensure cookies are included in requests:
   ```javascript
   fetch('https://your-backend.vercel.app/api/auth/me', {
     credentials: 'include'  // Important for HttpOnly cookies!
   })
   ```

### Step 3: Deploy Frontend to Vercel

1. In your **frontend repo**:
   ```bash
   vercel
   ```

2. Note the frontend URL (e.g., `https://your-frontend.vercel.app`)

### Step 4: Update CORS in Backend

1. Go back to **backend** Vercel project settings → Environment Variables

2. Update `CORS_ORIGINS` to include your frontend domain:
   ```bash
   CORS_ORIGINS=https://your-frontend.vercel.app
   ```

3. Redeploy backend:
   ```bash
   vercel --prod
   ```

### Step 5: Configure Stripe Webhooks (if using billing)

1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://your-backend.vercel.app/webhook/stripe`
3. Select events:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Copy the webhook signing secret
5. Update `STRIPE_WEBHOOK_SECRET` in Vercel environment variables
6. Redeploy backend

## Testing the Integration

### Local Development

1. **Start backend** (this repo):
   ```bash
   pnpm dev:server
   ```
   Backend runs at `http://localhost:3000`

2. **Start frontend** (your repo):
   ```bash
   npm run dev
   ```
   Frontend runs at `http://localhost:8080`

3. **Test API calls**:
   ```bash
   # Health check
   curl http://localhost:3000/healthz

   # Register (should set cookie)
   curl -X POST http://localhost:3000/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{
       "firstName": "Test",
       "lastName": "User",
       "email": "test@example.com",
       "password": "TestPass123!"
     }' \
     -c cookies.txt

   # Get user info (using cookie)
   curl http://localhost:3000/api/auth/me \
     -b cookies.txt
   ```

### Production Testing

1. Test health endpoint:
   ```bash
   curl https://your-backend.vercel.app/healthz
   ```

2. Test CORS from frontend:
   - Open your frontend in browser
   - Open DevTools → Network tab
   - Try logging in
   - Verify requests to backend succeed and cookies are set

3. Check Vercel logs:
   ```bash
   vercel logs
   ```

## Common Issues & Solutions

### 1. CORS Errors
**Problem**: `Access to fetch has been blocked by CORS policy`

**Solution**:
- Verify `CORS_ORIGINS` includes your frontend domain (no trailing slash!)
- Redeploy backend after updating env vars
- Check cookies are sent with `credentials: 'include'`

### 2. Cookies Not Being Set
**Problem**: Login succeeds but no cookie is set

**Solution**:
- Ensure frontend uses `credentials: 'include'` in fetch
- Verify `sameSite: 'lax'` in cookie settings (should be automatic)
- Check that frontend and backend are on HTTPS in production

### 3. YouTube OAuth Fails
**Problem**: OAuth redirect fails with 400 error

**Solution**:
- Verify `GOOGLE_REDIRECT_URI_PROD` matches exactly what's in Google Cloud Console
- Ensure Google OAuth credentials are for "Web application" type (not Desktop)
- Check redirect URI is `https://your-backend.vercel.app/api/youtube/callback`

### 4. Rate Limit Errors
**Problem**: `429 Too Many Requests`

**Solution**:
- Increase `RATE_LIMIT_PER_MINUTE` if needed
- Implement exponential backoff in frontend
- Check if you're making duplicate requests

### 5. 500 Errors on Analyze/Generate
**Problem**: Sentiment analysis or reply generation fails

**Solution**:
- Verify `OPENAI_API_KEY` is set correctly
- Check OpenAI account has credits
- Review Vercel logs for detailed error: `vercel logs --follow`

## Environment Variables Checklist

Before deploying, ensure ALL of these are set in Vercel:

- [ ] `SUPABASE_URL`
- [ ] `SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `GOOGLE_CLIENT_ID`
- [ ] `GOOGLE_CLIENT_SECRET`
- [ ] `GOOGLE_REDIRECT_URI_PROD`
- [ ] `APP_ENV=production`
- [ ] `OPENAI_API_KEY`
- [ ] `STRIPE_SECRET_KEY`
- [ ] `STRIPE_WEBHOOK_SECRET`
- [ ] `STRIPE_PRICE_ID`
- [ ] `STRIPE_CHECKOUT_SUCCESS_URL`
- [ ] `STRIPE_CHECKOUT_CANCEL_URL`
- [ ] `STRIPE_PORTAL_RETURN_URL`
- [ ] `CORS_ORIGINS` (with frontend domain)
- [ ] `JWT_SECRET` (random 64+ char string)
- [ ] `COOKIE_SECRET` (random 64+ char string)
- [ ] `CRON_SECRET` (random string)
- [ ] `FREE_LIMIT_ANALYZE_WEEKLY`
- [ ] `FREE_LIMIT_REPLY_DAILY`
- [ ] `NODE_ENV=production`

## Quick Command Reference

```bash
# Deploy backend
vercel --prod

# View logs
vercel logs --follow

# View environment variables
vercel env ls

# Add environment variable
vercel env add VARIABLE_NAME

# Remove environment variable
vercel env rm VARIABLE_NAME

# Test health check
curl https://your-backend.vercel.app/healthz

# Test cron endpoints (with CRON_SECRET)
curl -X POST https://your-backend.vercel.app/api/cron/queue-worker \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Next Steps

1. ✅ Backend deployed with all env vars configured
2. ✅ Frontend deployed and configured with backend URL
3. ✅ CORS updated to allow frontend domain
4. ✅ Stripe webhooks configured
5. Test the full user flow:
   - Register → Login → Connect YouTube → Fetch Videos → Analyze Comments → Generate Reply
6. Monitor Vercel logs for any issues
7. Set up custom domains (optional)

## Support

If you encounter issues:
1. Check Vercel logs: `vercel logs --follow`
2. Review this repo's test files for expected behavior
3. Verify all environment variables are set correctly
4. Test endpoints with curl to isolate frontend vs backend issues

---

**Last Updated**: 2025-01-07
