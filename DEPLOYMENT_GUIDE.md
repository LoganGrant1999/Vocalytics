# Complete Deployment Guide - 100% Free with Vercel

**Good news!** Your backend already has Vercel serverless support built-in. You can deploy **everything to Vercel for FREE** - no need for additional hosting services.

## Free Tier Summary

| Service | Free Tier | What You Get |
|---------|-----------|--------------|
| **Vercel** | 100GB bandwidth/month | Frontend + Backend hosting |
| **Supabase** | 500MB database, 2GB bandwidth | PostgreSQL database (already set up) |
| **Stripe** | Unlimited | Payment processing (2.9% + 30¢ per transaction) |
| **Google Cloud** | Free | YouTube API OAuth (no charges for OAuth) |
| **OpenAI** | Pay-as-you-go | $5 credit for new accounts |

**Total monthly cost: $0** (until you exceed free tiers)

---

## Deployment Strategy

You have **two deployment options**:

### Option 1: Split Deployment (Recommended for Free Tier)
- **Frontend:** Vercel (separate project)
- **Backend:** Vercel (separate project)
- **Benefit:** Better separation, easier debugging, independent scaling

### Option 2: Monorepo Deployment (Already Configured!)
- **Frontend + Backend:** Single Vercel project
- **Benefit:** Simpler setup, single deployment
- **Note:** Your `vercel.json` at root already configures this

**I recommend Option 2** since you already have the config. Let's use that!

---

## Step-by-Step Deployment

### Prerequisites (5 minutes)

1. **GitHub Account** - Create at https://github.com if you don't have one
2. **Vercel Account** - Sign up at https://vercel.com with your GitHub account
3. **Stripe Account** - Already set up (you have test keys in .env.local)
4. **Supabase Account** - Already set up (you're using it locally)

---

### Step 1: Prepare Your Repository (5 minutes)

**1.1 Check your .gitignore (prevent secrets from being committed)**

```bash
# Verify .env.local is NOT committed
cat .gitignore | grep .env
```

You should see `.env.local` in the output. If not, add it:

```bash
echo ".env.local" >> .gitignore
echo "packages/server/.env.local" >> .gitignore
echo "packages/web/.env.local" >> .gitignore
```

**1.2 Create a GitHub repository**

```bash
# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - ready for deployment"

# Create a new repository on GitHub (via web interface):
# 1. Go to https://github.com/new
# 2. Name it "vocalytics"
# 3. Make it private (recommended)
# 4. Do NOT initialize with README (you already have code)
# 5. Click "Create repository"

# Connect your local repo to GitHub (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/vocalytics.git
git branch -M main
git push -u origin main
```

---

### Step 2: Configure Vercel Project (10 minutes)

**2.1 Import project to Vercel**

1. Go to https://vercel.com/new
2. Click "Import Git Repository"
3. Select your `vocalytics` repository
4. Vercel will detect it as a monorepo

**2.2 Configure build settings**

Keep these default settings (Vercel auto-detects from your `vercel.json`):
- **Framework Preset:** Other
- **Root Directory:** `./ (root)`
- **Build Command:** (leave as auto-detected)
- **Output Directory:** (leave as auto-detected)

**2.3 Add Environment Variables**

Click "Environment Variables" and add these (copy from your `.env.local`):

#### Core Services (Required)
```bash
NODE_ENV=production
SUPABASE_URL=https://aveujrwionxljrutvsze.supabase.co
SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

#### Security (Required)
```bash
JWT_SECRET=<generate-random-string-32-chars>
COOKIE_SECRET=<generate-random-string-32-chars>
```

**Generate random secrets:**
```bash
# Run these in your terminal to generate secure secrets
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### Stripe (Required for billing)
```bash
STRIPE_SECRET_KEY=sk_test_... # Your test key (or sk_live_... for production)
STRIPE_WEBHOOK_SECRET=whsec_... # We'll get this after deployment
STRIPE_PRICE_ID=price_... # Your price ID from Stripe
```

**To find your Stripe values:**
1. **STRIPE_SECRET_KEY:** https://dashboard.stripe.com/test/apikeys
2. **STRIPE_PRICE_ID:** https://dashboard.stripe.com/test/products
   - Create a product "Pro Plan" - $10/month recurring
   - Copy the Price ID (starts with `price_`)

#### YouTube OAuth (Required for YouTube features)
```bash
GOOGLE_CLIENT_ID=<your-client-id>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<your-client-secret>
APP_ENV=production
```

**To get Google OAuth credentials:**
1. Go to https://console.cloud.google.com/apis/credentials
2. Create a new OAuth 2.0 Client ID (Web application)
3. Add authorized redirect URI: `https://your-app.vercel.app/api/youtube/callback`
   - Replace `your-app` with your actual Vercel domain (you'll get this after first deploy)
   - **You'll need to update this after your first deployment!**

#### OpenAI (Optional - falls back to mock mode if not set)
```bash
OPENAI_API_KEY=sk-proj-...
REPLIES_MODEL=gpt-4o-mini
MODERATION_MODEL=omni-moderation-latest
```

#### URLs (Update after deployment)
```bash
CORS_ORIGINS=https://your-app.vercel.app
STRIPE_CHECKOUT_SUCCESS_URL=https://your-app.vercel.app/billing?success=true
STRIPE_CHECKOUT_CANCEL_URL=https://your-app.vercel.app/billing?canceled=true
STRIPE_PORTAL_RETURN_URL=https://your-app.vercel.app/billing
PUBLIC_PRICING_URL=https://your-app.vercel.app/billing
PUBLIC_BILLING_URL=https://your-app.vercel.app/billing
```

#### Quotas (Optional - these have defaults)
```bash
FREE_LIMIT_ANALYZE_WEEKLY=2
FREE_LIMIT_REPLY_DAILY=1
RATE_LIMIT_PER_MINUTE=60
```

**2.4 Deploy!**

Click **"Deploy"** and wait ~2-3 minutes.

---

### Step 3: Post-Deployment Configuration (10 minutes)

**3.1 Get your deployment URL**

After deployment, Vercel will show you a URL like:
```
https://vocalytics-abc123.vercel.app
```

**3.2 Update environment variables with your real URL**

Go to your Vercel project → Settings → Environment Variables

Update these variables (replace `your-app.vercel.app` with your actual URL):

```bash
CORS_ORIGINS=https://vocalytics-abc123.vercel.app
STRIPE_CHECKOUT_SUCCESS_URL=https://vocalytics-abc123.vercel.app/billing?success=true
STRIPE_CHECKOUT_CANCEL_URL=https://vocalytics-abc123.vercel.app/billing?canceled=true
STRIPE_PORTAL_RETURN_URL=https://vocalytics-abc123.vercel.app/billing
PUBLIC_PRICING_URL=https://vocalytics-abc123.vercel.app/billing
PUBLIC_BILLING_URL=https://vocalytics-abc123.vercel.app/billing
```

**3.3 Update Google OAuth redirect URI**

1. Go to https://console.cloud.google.com/apis/credentials
2. Edit your OAuth 2.0 Client ID
3. Add authorized redirect URI:
   ```
   https://vocalytics-abc123.vercel.app/api/youtube/callback
   ```
4. Save

**3.4 Set up Stripe Webhook**

1. Go to https://dashboard.stripe.com/test/webhooks
2. Click "+ Add endpoint"
3. Enter webhook URL:
   ```
   https://vocalytics-abc123.vercel.app/webhook/stripe
   ```
4. Select events to listen to:
   - ✅ `checkout.session.completed`
   - ✅ `customer.subscription.created`
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`
5. Click "Add endpoint"
6. Click "Reveal" next to "Signing secret"
7. Copy the webhook secret (starts with `whsec_`)
8. Go back to Vercel → Settings → Environment Variables
9. Update `STRIPE_WEBHOOK_SECRET` with the new value

**3.5 Redeploy**

After updating environment variables:
1. Go to Vercel → Deployments
2. Click the three dots (•••) on the latest deployment
3. Click "Redeploy"
4. Wait ~2 minutes

---

### Step 4: Update Frontend Config (5 minutes)

**4.1 Update web package to point to your backend**

Your frontend needs to know where your backend API is. Since you're deploying both to the same Vercel project, the API is at `/api/*`.

Check that `packages/web/vercel.json` doesn't have conflicting rewrites:

```bash
cat packages/web/vercel.json
```

If it has an `api` rewrite pointing elsewhere, remove it or update it to point to your Vercel backend URL.

**4.2 Verify API_URL in frontend**

Check if your frontend has a hardcoded API URL:

```bash
grep -r "API_URL" packages/web/src
```

If you find any, make sure they're set to use relative paths (`/api`) or update them in Vercel environment variables.

---

### Step 5: Test Your Deployment (10 minutes)

**5.1 Test health endpoint**

Visit: `https://your-app.vercel.app/healthz`

You should see:
```json
{
  "ok": true,
  "version": "1.0.0",
  "db": "ok",
  "stripeWebhook": "configured"
}
```

**5.2 Test user registration**

1. Visit `https://your-app.vercel.app`
2. Click "Get Started Free"
3. Register a new account
4. Check if you're redirected to onboarding

**5.3 Test YouTube connection**

1. After registration, connect YouTube
2. You should be redirected to Google OAuth
3. After authorizing, you should return to your app

**5.4 Test sentiment analysis**

1. Select a video from your channel
2. Click "Analyze"
3. Wait for sentiment results

**5.5 Test billing upgrade**

1. Go to Billing page
2. Click "Upgrade to Pro"
3. Use Stripe test card: `4242 4242 4242 4242`
4. Expiry: Any future date
5. CVC: Any 3 digits
6. Complete checkout

---

### Step 6: Update Code Review Document (2 minutes)

Update your `SPRINT3_CODE_REVIEW.md`:

```bash
# Open the file
# Replace [Add your Vercel URL here] with your actual URL
```

Example:
```markdown
**Live Application:** https://vocalytics-abc123.vercel.app
```

Commit and push:
```bash
git add SPRINT3_CODE_REVIEW.md
git commit -m "Add production URL to code review"
git push
```

---

## Troubleshooting

### Issue: "Module not found" or build errors

**Solution:** Make sure all dependencies are in `package.json` and run:
```bash
pnpm install
git add package.json pnpm-lock.yaml
git commit -m "Update dependencies"
git push
```

Vercel will auto-redeploy.

---

### Issue: API calls failing with CORS errors

**Check:**
1. Verify `CORS_ORIGINS` in Vercel environment variables includes your deployment URL
2. Redeploy after updating environment variables
3. Check browser console for specific CORS error

**Solution:**
```bash
# In Vercel dashboard, set:
CORS_ORIGINS=https://your-app.vercel.app
```

---

### Issue: Stripe webhook not working

**Check:**
1. Visit `https://your-app.vercel.app/healthz`
2. Check if `stripeWebhook: "configured"`
3. If not, verify `STRIPE_WEBHOOK_SECRET` is set in Vercel

**Solution:**
1. Go to Stripe Dashboard → Webhooks
2. Click on your webhook endpoint
3. Click "Send test webhook"
4. Select `checkout.session.completed`
5. Check Vercel logs for errors

---

### Issue: YouTube OAuth failing

**Check:**
1. Verify redirect URI in Google Cloud Console matches exactly:
   ```
   https://your-app.vercel.app/api/youtube/callback
   ```
2. Check if `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set
3. Verify `APP_ENV=production` is set

---

### Issue: Database errors

**Check:**
1. Visit `https://your-app.vercel.app/healthz`
2. Check if `db: "ok"`
3. If not, verify Supabase credentials

**Solution:**
1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to Settings → API
4. Copy `URL`, `anon public`, and `service_role` keys
5. Update in Vercel environment variables
6. Redeploy

---

### Issue: "Invalid JWT" or authentication errors

**Solution:**
- Clear browser cookies
- Try incognito/private browsing mode
- Verify `JWT_SECRET` and `COOKIE_SECRET` are set in Vercel

---

## Monitoring Your Free Tier Usage

### Vercel Dashboard
- Go to https://vercel.com/dashboard
- Click on your project
- View "Analytics" tab for bandwidth usage
- **Free tier:** 100GB bandwidth/month

### Supabase Dashboard
- Go to https://supabase.com/dashboard
- Click on your project
- View "Database" tab for storage usage
- **Free tier:** 500MB database, 2GB file storage

### Stripe Dashboard
- Go to https://dashboard.stripe.com
- No limits on free tier
- 2.9% + 30¢ per successful transaction

---

## Upgrading to Production

When you're ready to go live with real users:

### 1. Switch Stripe to Live Mode
```bash
# In Vercel environment variables:
STRIPE_SECRET_KEY=sk_live_... # Instead of sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_... # Create new webhook for live mode
```

### 2. Use Production Supabase Project
- Create a new Supabase project for production
- Run all migrations on production database
- Update `SUPABASE_URL` and keys in Vercel

### 3. Set up Custom Domain (Optional - $15/year)
1. Buy domain from Namecheap, Google Domains, etc.
2. In Vercel → Settings → Domains
3. Add your custom domain
4. Update DNS records as instructed
5. Update all URLs in environment variables

### 4. Enable Monitoring
- Add Sentry for error tracking (free tier available)
- Set up Vercel Analytics (included in free tier)
- Configure Supabase database logs

---

## Cost Estimate for Growth

| Users | Vercel | Supabase | OpenAI | Total/month |
|-------|--------|----------|--------|-------------|
| 0-100 | Free | Free | ~$5 | **$5** |
| 100-1000 | Free | Free | ~$30 | **$30** |
| 1000-5000 | $20 | $25 | ~$100 | **$145** |
| 5000+ | $20+ | $25+ | ~$300 | **$345+** |

**Notes:**
- Vercel Pro ($20/mo) needed after 100GB bandwidth
- Supabase Pro ($25/mo) needed after 500MB database or 2GB bandwidth
- OpenAI costs scale with usage (~$0.01 per analysis)

---

## Next Steps After Deployment

1. ✅ Update `SPRINT3_CODE_REVIEW.md` with your URL
2. ✅ Test all features end-to-end
3. ✅ Submit on LearningSuite
4. 📊 Share with friends for feedback
5. 🚀 Launch on Product Hunt / HackerNews
6. 💰 Get your first paying customer!

---

## Quick Deploy Checklist

Use this checklist to ensure nothing is missed:

### Pre-Deployment
- [ ] `.env.local` is in `.gitignore`
- [ ] Code committed to GitHub
- [ ] Supabase project created and accessible
- [ ] Stripe test keys available

### Vercel Setup
- [ ] Project imported to Vercel
- [ ] All required environment variables added
- [ ] JWT_SECRET and COOKIE_SECRET generated
- [ ] First deployment successful

### Post-Deployment
- [ ] Deployment URL obtained
- [ ] CORS_ORIGINS updated with deployment URL
- [ ] Stripe URLs updated with deployment URL
- [ ] Google OAuth redirect URI updated
- [ ] Stripe webhook created and secret added
- [ ] Redeployed with updated environment variables

### Testing
- [ ] `/healthz` endpoint returns `ok: true`
- [ ] User registration works
- [ ] Login works
- [ ] YouTube OAuth connection works
- [ ] Sentiment analysis works
- [ ] Billing upgrade works (with test card)

### Submission
- [ ] `SPRINT3_CODE_REVIEW.md` updated with URL
- [ ] Changes committed and pushed
- [ ] Submitted on LearningSuite

---

**Estimated total time: 45-60 minutes**

Good luck with your deployment! 🚀
