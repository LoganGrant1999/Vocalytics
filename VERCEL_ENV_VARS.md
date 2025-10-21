# Vercel Environment Variables - Required Setup

## Critical Environment Variables (Set These NOW)

Go to your Vercel project → Settings → Environment Variables and add:

### 1. Node Environment
```bash
NODE_ENV=production
```
**Why:** Tells the app it's running in production (fixes OAuth redirect to localhost)

### 2. App URL (Alternative to NODE_ENV)
```bash
APP_URL=https://vocalytics-alpha.vercel.app
```
**Why:** Used for OAuth redirects. Set this if NODE_ENV isn't working.

### 3. Supabase Credentials
```bash
SUPABASE_URL=https://aveujrwionxljrutvsze.supabase.co
SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```
**Where to find:** https://supabase.com/dashboard → Your Project → Settings → API

### 4. JWT & Cookie Secrets (Generate New Ones!)
```bash
JWT_SECRET=<generate-random-32-char-string>
COOKIE_SECRET=<generate-random-32-char-string>
```
**How to generate:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 5. Google OAuth Credentials
```bash
GOOGLE_CLIENT_ID=<your-client-id>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<your-client-secret>
```
**Where to find:** https://console.cloud.google.com/apis/credentials

**IMPORTANT:** Update your OAuth redirect URI in Google Console to:
```
https://vocalytics-alpha.vercel.app/api/youtube/callback
```

### 6. Stripe Keys (Currently Using Test/Sandbox)
```bash
STRIPE_SECRET_KEY=sk_test_<your-test-key>
STRIPE_PRICE_ID=price_<your-test-price-id>
```
**Where to find:** https://dashboard.stripe.com/test/apikeys

**Later for production:** Switch to `sk_live_...` keys

### 7. Stripe Webhook Secret
```bash
STRIPE_WEBHOOK_SECRET=whsec_<your-webhook-secret>
```
**How to set up:**
1. Go to https://dashboard.stripe.com/test/webhooks
2. Click "Add endpoint"
3. URL: `https://vocalytics-alpha.vercel.app/webhook/stripe`
4. Select events: `checkout.session.completed`, `customer.subscription.*`
5. Copy the webhook signing secret

### 8. CORS Origins
```bash
CORS_ORIGINS=https://vocalytics-alpha.vercel.app
```

### 9. Stripe Redirect URLs
```bash
STRIPE_CHECKOUT_SUCCESS_URL=https://vocalytics-alpha.vercel.app/billing?success=true
STRIPE_CHECKOUT_CANCEL_URL=https://vocalytics-alpha.vercel.app/billing?canceled=true
STRIPE_PORTAL_RETURN_URL=https://vocalytics-alpha.vercel.app/billing
PUBLIC_PRICING_URL=https://vocalytics-alpha.vercel.app/billing
PUBLIC_BILLING_URL=https://vocalytics-alpha.vercel.app/billing
```

---

## Optional Environment Variables

### OpenAI (For AI features - falls back to mock if not set)
```bash
OPENAI_API_KEY=sk-proj-<your-key>
REPLIES_MODEL=gpt-4o-mini
MODERATION_MODEL=omni-moderation-latest
```

### Quotas (Have defaults if not set)
```bash
FREE_LIMIT_ANALYZE_WEEKLY=2
FREE_LIMIT_REPLY_DAILY=1
RATE_LIMIT_PER_MINUTE=60
```

---

## Quick Setup Checklist

- [ ] Set `NODE_ENV=production` in Vercel
- [ ] Set `APP_URL=https://vocalytics-alpha.vercel.app` in Vercel
- [ ] Copy Supabase credentials from dashboard
- [ ] Generate new JWT_SECRET and COOKIE_SECRET
- [ ] Add Google OAuth credentials
- [ ] **Update Google OAuth redirect URI to production URL**
- [ ] Add Stripe test keys
- [ ] Create Stripe webhook for production URL
- [ ] Set all CORS and redirect URLs to production domain
- [ ] Redeploy on Vercel (or it will auto-deploy when you save env vars)

---

## After Setting Environment Variables

1. **Redeploy:** Vercel → Deployments → Latest → Redeploy (or it auto-deploys)
2. **Wait 2-3 minutes** for deployment
3. **Test OAuth:** Try connecting YouTube again
4. **Should redirect to:** `https://vocalytics-alpha.vercel.app/app?yt=connected` ✅

---

## Current Issue Fixed

✅ OAuth now checks `APP_URL` or `NODE_ENV` before falling back to localhost
✅ Once you set one of these env vars, OAuth will redirect to your Vercel domain

---

## Switching to Production Later

When ready to accept real payments, see [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) section:
"Switching from Development/Sandbox to Production"

Main changes:
- Stripe: `sk_test_...` → `sk_live_...`
- Stripe: Create new live webhook
- Supabase: Create separate production database
- Google OAuth: Create separate production OAuth client (optional)
