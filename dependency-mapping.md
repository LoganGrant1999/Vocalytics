# Vocalytics Dependency Mapping

**Complete inventory of all dependencies, services, APIs, and integrations**

---

## Table of Contents

1. [External Services](#1-external-services)
2. [Major Libraries & Packages](#2-major-libraries--packages)
3. [API Endpoints](#3-api-endpoints)
4. [Database Tables](#4-database-tables)
5. [Third-Party Integrations](#5-third-party-integrations)
6. [Failure Impact Analysis](#6-failure-impact-analysis)
7. [Dependency Health Dashboard](#7-dependency-health-dashboard)

---

## 1. External Services

### Critical Infrastructure Dependencies

| Service | Purpose | What It Does | Cost | What Breaks If It Fails |
|---------|---------|--------------|------|-------------------------|
| **Vercel** | Deployment & Hosting | Hosts frontend (static files) and backend (serverless functions) | ~$20/month (Pro) | 🔴 **COMPLETE OUTAGE** - Entire app unavailable |
| **Supabase** | Database & Auth | PostgreSQL database with Row-Level Security | ~$25/month (Pro) | 🔴 **COMPLETE OUTAGE** - Cannot read/write data, no auth |
| **OpenAI** | AI/ML Processing | GPT-4 for sentiment analysis, reply generation, summaries | ~$50-200/month (usage-based) | 🟡 **PARTIAL** - Analysis fails, replies fail, summaries fail |
| **Stripe** | Payment Processing | Subscription billing, customer management, webhooks | 2.9% + $0.30/transaction | 🟡 **PARTIAL** - Cannot upgrade, billing fails, free tier still works |
| **YouTube Data API** | Content Access | Fetch videos, comments, post replies | Free (10,000 quota/day) | 🟡 **PARTIAL** - Cannot fetch new videos/comments, existing data cached |
| **Google OAuth** | Authentication | YouTube account connection (OAuth 2.0) | Free | 🟡 **PARTIAL** - New users can't connect YouTube, existing tokens work |

---

### Service Details

#### 🚀 Vercel
**Type:** Platform-as-a-Service (PaaS)
**Version:** N/A (managed service)
**Dashboard:** https://vercel.com/dashboard

**What We Use:**
- Static site hosting (React app)
- Serverless functions (`/api/*` routes)
- Cron jobs (2 scheduled tasks)
- Environment variables
- Domain management
- Analytics

**Configuration:**
- `vercel.json` - Build settings, routes, cron schedules
- `api/` folder - Serverless function entry points

**What Breaks:**
- ❌ Website unreachable
- ❌ API calls fail (no backend)
- ❌ Cron jobs don't run (usage counters don't reset)
- ❌ Users see 503 Service Unavailable

**Mitigation:**
- Vercel has 99.99% uptime SLA
- Multi-region deployment
- Automatic failover
- Status page: https://www.vercel-status.com/

---

#### 🗄️ Supabase
**Type:** Backend-as-a-Service (BaaS)
**Version:** PostgreSQL 15
**Dashboard:** https://app.supabase.com/

**What We Use:**
- PostgreSQL database (8 tables)
- Row-Level Security (RLS) policies
- Database functions (stored procedures)
- Connection pooling
- Automatic backups

**Connection:**
- `SUPABASE_URL` environment variable
- `SUPABASE_SERVICE_ROLE_KEY` for service-level access
- `@supabase/supabase-js` SDK (version 2.75.0)

**What Breaks:**
- ❌ Cannot read user profiles
- ❌ Cannot save analyses
- ❌ Cannot check usage quotas
- ❌ Login/registration fails
- ❌ All API endpoints return 500 errors

**Mitigation:**
- Daily automated backups
- Point-in-time recovery (7 days)
- Multi-region replication (Pro tier)
- Can export SQL and migrate to self-hosted PostgreSQL

---

#### 🤖 OpenAI API
**Type:** AI/ML API
**Version:** GPT-4 (various models)
**Dashboard:** https://platform.openai.com/

**What We Use:**
- **GPT-4o-mini** - Fast, cheap sentiment analysis
- **GPT-4** - High-quality reply generation
- **GPT-4** - Summary generation
- **omni-moderation-latest** - Toxicity detection

**Models:**
```javascript
REPLIES_MODEL=gpt-4o-mini              // Default for replies
MODERATION_MODEL=omni-moderation-latest // Toxicity check
```

**Rate Limits:**
- 10,000 requests/minute (Tier 3)
- ~90,000 tokens/minute

**Cost Estimate:**
- Sentiment analysis: ~$0.10-$0.50 per video (200 comments)
- Reply generation: ~$0.01-$0.03 per reply
- Summary: ~$0.03 per video
- **Monthly:** $50-200 depending on usage

**What Breaks:**
- ❌ Video analysis fails with error
- ❌ Reply generation fails
- ❌ Summary generation fails
- ✅ Existing cached analyses still work
- ✅ User can still browse old data

**Mitigation:**
- Graceful fallback to rule-based sentiment (keywords)
- Error messages tell user to retry later
- Results cached indefinitely (never need to re-analyze)

---

#### 💳 Stripe
**Type:** Payment Processing
**Version:** API version 2025-09-30.clover
**Dashboard:** https://dashboard.stripe.com/

**What We Use:**
- Checkout Sessions (subscription signup)
- Customer Portal (manage subscription)
- Webhooks (subscription updates)
- Subscriptions (recurring billing)
- Invoices

**Webhooks:**
```
POST /api/webhook/stripe
Events:
  - checkout.session.completed
  - customer.subscription.created
  - customer.subscription.updated
  - customer.subscription.deleted
```

**What Breaks:**
- ❌ Users cannot upgrade to Pro
- ❌ Users cannot manage billing
- ✅ Existing Pro subscriptions continue to work
- ✅ Free tier unaffected

**Mitigation:**
- Webhook idempotency (store events in `stripe_events` table)
- Retry failed webhooks automatically
- Manual upgrade via database if needed

---

#### 📺 YouTube Data API v3
**Type:** Content API
**Version:** v3
**Dashboard:** https://console.cloud.google.com/

**What We Use:**
- `commentThreads.list` - Fetch comments
- `videos.list` - Fetch video metadata
- `comments.insert` - Post replies

**Rate Limits:**
- **10,000 quota units/day** (free tier)
- Each request costs 1-100 units
- Fetching 100 comments = ~3 units
- Posting reply = 50 units

**Quota Usage:**
- 1 video analysis (1,000 comments) = ~30 units
- 1 reply posted = 50 units
- **Max ~330 analyses/day OR ~200 replies/day**

**What Breaks:**
- ❌ Cannot fetch new videos
- ❌ Cannot fetch new comments
- ❌ Cannot analyze videos
- ❌ Cannot post replies
- ✅ Cached videos still visible
- ✅ Old analyses still work

**Mitigation:**
- Cache video metadata in `user_videos` table
- Cache analyses in `video_analyses` table
- Respect rate limits (10 pages max = 1,000 comments)
- Ask for quota increase if needed ($$$)

---

#### 🔐 Google OAuth 2.0
**Type:** Authentication Protocol
**Version:** OAuth 2.0
**Dashboard:** https://console.cloud.google.com/

**What We Use:**
- Authorization Code Flow
- Scopes: `youtube.readonly`, `youtube.force-ssl`
- Access tokens (expires 1 hour)
- Refresh tokens (long-lived)

**What Breaks:**
- ❌ New users cannot connect YouTube
- ❌ Existing users whose tokens expired cannot refresh
- ✅ Users with valid tokens still work
- ✅ Email/password auth unaffected

**Mitigation:**
- Store refresh tokens in database
- Automatically refresh expired access tokens
- Clear error messages to re-authenticate

---

## 2. Major Libraries & Packages

### Backend Dependencies (36 total)

#### Core Framework

| Package | Version | Purpose | Why Critical | Replacement Difficulty |
|---------|---------|---------|--------------|------------------------|
| **fastify** | ^4.26.0 | Web framework | Handles all HTTP requests | 🟡 Medium - Could switch to Express |
| **@fastify/cookie** | ^9.4.0 | Cookie parsing | Reads JWT from cookies | 🟢 Easy - Built-in Node.js option |
| **@fastify/cors** | ^9.0.1 | CORS handling | Allows frontend to call API | 🟢 Easy - Simple middleware |
| **@fastify/aws-lambda** | ^6.1.1 | Serverless adapter | Makes Fastify work on Vercel | 🔴 Hard - Required for deployment |

---

#### Authentication & Security

| Package | Version | Purpose | Why Critical | Replacement Difficulty |
|---------|---------|---------|--------------|------------------------|
| **jsonwebtoken** | ^9.0.2 | JWT creation/verification | Authenticates users | 🟢 Easy - Standard JWT library |
| **bcrypt** | ^6.0.0 | Password hashing | Securely stores passwords | 🟢 Easy - Could use bcryptjs |
| **@supabase/supabase-js** | ^2.75.0 | Supabase SDK | Database access | 🟡 Medium - Could use raw PostgreSQL |
| **zod** | ^3.22.4 | Input validation | Validates API requests | 🟡 Medium - Could use joi or yup |

---

#### External APIs

| Package | Version | Purpose | Why Critical | Replacement Difficulty |
|---------|---------|---------|--------------|------------------------|
| **openai** | ^6.5.0 | OpenAI SDK | AI sentiment & replies | 🔴 Hard - Core feature |
| **googleapis** | ^162.0.0 | YouTube API | Fetch videos/comments | 🔴 Hard - Core feature |
| **google-auth-library** | ^10.4.0 | Google OAuth | YouTube authentication | 🔴 Hard - Required for YouTube |
| **stripe** | ^19.1.0 | Stripe SDK | Payment processing | 🟡 Medium - Could switch to Paddle |

---

#### Development Tools

| Package | Version | Purpose | Replaceability |
|---------|---------|---------|----------------|
| **typescript** | ^5.9.3 | Type checking | 🔴 Core - Would need full rewrite |
| **tsx** | ^4.20.6 | TypeScript execution | 🟢 Easy - Could use ts-node |
| **vitest** | ^1.2.1 | Testing framework | 🟢 Easy - Could use Jest |

---

### Frontend Dependencies (62 total)

#### Core Framework

| Package | Version | Purpose | Why Critical | Replacement Difficulty |
|---------|---------|---------|--------------|------------------------|
| **react** | ^18.3.1 | UI framework | Entire frontend | 🔴 Impossible - Would be full rewrite |
| **react-dom** | ^18.3.1 | React renderer | Renders React to DOM | 🔴 Impossible - Required for React |
| **react-router-dom** | ^6.30.1 | Client-side routing | Page navigation | 🟡 Medium - Could use TanStack Router |
| **vite** | ^5.4.19 | Build tool | Bundles & serves app | 🟡 Medium - Could use Webpack/Rollup |

---

#### State Management

| Package | Version | Purpose | Why Critical | Replacement Difficulty |
|---------|---------|---------|--------------|------------------------|
| **@tanstack/react-query** | ^5.83.0 | Data fetching & caching | API calls, loading states | 🟡 Medium - Could use SWR or Redux |
| **react-hook-form** | ^7.61.1 | Form handling | All forms (login, register) | 🟢 Easy - Could use Formik |

---

#### UI Components (Radix UI)

**All @radix-ui/* packages** (28 packages)
- Accessible, unstyled component primitives
- Used in every UI component
- Replacement: 🟡 Medium - Could use HeadlessUI or build custom

**Why Radix?**
- ✅ Accessible by default (WCAG AA)
- ✅ Unstyled (we control appearance)
- ✅ Battle-tested
- ✅ Works with Tailwind

---

#### Styling

| Package | Version | Purpose | Replaceability |
|---------|---------|---------|----------------|
| **tailwindcss** | ^3.4.17 | CSS utility classes | 🟡 Medium - Could use vanilla CSS |
| **tailwind-merge** | ^2.6.0 | Merge Tailwind classes | 🟢 Easy - Helper function |
| **tailwindcss-animate** | ^1.0.7 | Animation utilities | 🟢 Easy - Could write CSS |
| **class-variance-authority** | ^0.7.1 | Variant management | 🟢 Easy - Helper function |
| **clsx** | ^2.1.1 | Conditional classes | 🟢 Easy - Simple utility |

---

#### Data Visualization

| Package | Version | Purpose | Replaceability |
|---------|---------|---------|----------------|
| **recharts** | ^2.15.4 | Charts & graphs | 🟡 Medium - Could use Chart.js or D3 |

---

#### Utilities

| Package | Version | Purpose | Replaceability |
|---------|---------|---------|----------------|
| **date-fns** | ^3.6.0 | Date formatting | 🟢 Easy - Could use dayjs or luxon |
| **lucide-react** | ^0.462.0 | Icons | 🟢 Easy - Could use react-icons |
| **sonner** | ^1.7.4 | Toast notifications | 🟢 Easy - Could build custom |
| **zod** | ^3.25.76 | Type validation | 🟡 Medium - Could use yup |

---

## 3. API Endpoints

**Total:** 40+ endpoints across 16 route files

### Authentication Endpoints

| Method | Endpoint | Purpose | Auth Required | Rate Limited |
|--------|----------|---------|---------------|--------------|
| `POST` | `/api/auth/register` | Create new account | No | Yes (5/min) |
| `POST` | `/api/auth/login` | Login with email/password | No | Yes (10/min) |
| `POST` | `/api/auth/logout` | Clear session cookie | No | No |
| `GET` | `/api/auth/me` | Get current user + quota | Yes | No |

**What Uses This:** SignInPage.tsx, RegisterPage.tsx, useAuth.tsx

---

### User Profile Endpoints

| Method | Endpoint | Purpose | Auth Required | Rate Limited |
|--------|----------|---------|---------------|--------------|
| `GET` | `/api/me/subscription` | Get subscription status | Yes | No |
| `GET` | `/api/me/usage` | Get quota usage stats | Yes | No |

**What Uses This:** BillingPage.tsx, DashboardPage.tsx, HeaderBar.tsx

---

### YouTube OAuth Endpoints

| Method | Endpoint | Purpose | Auth Required | Rate Limited |
|--------|----------|---------|---------------|--------------|
| `GET` | `/api/youtube/connect` | Start OAuth flow | Yes | No |
| `GET` | `/api/youtube/callback` | OAuth callback (exchange code for token) | No | No |

**What Uses This:** ConnectYouTubePage.tsx, OAuth redirect flow

---

### YouTube Data Endpoints

| Method | Endpoint | Purpose | Auth Required | Rate Limited |
|--------|----------|---------|---------------|--------------|
| `GET` | `/api/youtube/videos` | Fetch user's videos | Yes | Yes (10/min) |
| `GET` | `/api/youtube/comments?videoId=X` | Fetch comments for video | Yes | Yes (10/min) |
| `GET` | `/api/youtube/public-comments?videoId=X` | Fetch public comments (no auth) | Yes | Yes (10/min) |
| `POST` | `/api/youtube/reply` | Post reply to comment | Yes | Yes (5/min) |
| `GET` | `/api/debug/youtube` | Debug YouTube connection | Yes | No |

**What Uses This:** VideosPage.tsx, VideoDetailPage.tsx, CommentsPage.tsx

---

### Video Analysis Endpoints

| Method | Endpoint | Purpose | Auth Required | Quota Enforced |
|--------|----------|---------|---------------|----------------|
| `POST` | `/api/analysis/:videoId` | Analyze video comments | Yes | Yes (2/week free) |
| `GET` | `/api/analysis/:videoId` | Get existing analysis | Yes | No |
| `GET` | `/api/analysis` | List all analyses | Yes | No |
| `GET` | `/api/analysis/trends?days=90` | Get sentiment trends | Yes | No |

**What Uses This:** VideoDetailPage.tsx, DashboardPage.tsx

**External APIs Called:**
- YouTube Data API (fetch comments)
- OpenAI API (sentiment analysis)
- OpenAI API (generate summary)

---

### Comment Management Endpoints

| Method | Endpoint | Purpose | Auth Required | Rate Limited |
|--------|----------|---------|---------------|--------------|
| `GET` | `/api/comments/settings` | Get priority settings | Yes | No |
| `PUT` | `/api/comments/settings` | Update priority settings | Yes | No |
| `POST` | `/api/comments/:videoId/score` | Score comments by priority | Yes | Yes (10/min) |
| `GET` | `/api/comments/:videoId/scores` | Get scored comments | Yes | No |
| `GET` | `/api/comments/inbox` | Get priority inbox | Yes | No |
| `POST` | `/api/comments/generate-bulk` | Generate bulk replies | Yes | Yes (quota) |
| `POST` | `/api/comments/:commentId/generate-reply` | Generate single reply | Yes | Yes (quota) |
| `POST` | `/api/comments/:commentId/post-reply` | Post reply to YouTube | Yes | Yes (5/min) |

**What Uses This:** CommentsPage.tsx (Pro feature)

---

### AI Reply Endpoints

| Method | Endpoint | Purpose | Auth Required | Quota Enforced |
|--------|----------|---------|---------------|----------------|
| `POST` | `/api/generate-replies` | Generate AI replies for comments | Yes | Yes (1/day free) |
| `POST` | `/api/analyze-comments` | Analyze comment sentiment | Yes | No |
| `POST` | `/api/fetch-comments` | Fetch & cache comments | Yes | Yes (10/min) |
| `POST` | `/api/summarize-sentiment` | Generate sentiment summary | Yes | No |

**What Uses This:** VideoDetailPage.tsx, CommentsPage.tsx

---

### Tone Learning Endpoints

| Method | Endpoint | Purpose | Auth Required | Rate Limited |
|--------|----------|---------|---------------|--------------|
| `POST` | `/api/tone/learn` | Learn creator's tone from examples | Yes | Yes (5/hour) |
| `GET` | `/api/tone/profile` | Get learned tone profile | Yes | No |
| `DELETE` | `/api/tone/profile` | Delete tone profile | Yes | No |

**What Uses This:** VoiceProfilePage.tsx

---

### Billing Endpoints

| Method | Endpoint | Purpose | Auth Required | Rate Limited |
|--------|----------|---------|---------------|--------------|
| `POST` | `/api/billing/checkout` | Create Stripe checkout session | Yes | Yes (3/min) |
| `POST` | `/api/billing/portal` | Create Stripe customer portal session | Yes | Yes (3/min) |
| `POST` | `/api/webhook/stripe` | Stripe webhook receiver | No (signature verified) | No |

**What Uses This:** BillingPage.tsx

**External APIs Called:**
- Stripe API (create checkout)
- Stripe API (create portal)

---

### Endpoint Summary by Category

| Category | Endpoint Count | Rate Limited | Quota Enforced |
|----------|----------------|--------------|----------------|
| Authentication | 4 | 3 | 0 |
| User Profile | 2 | 0 | 0 |
| YouTube OAuth | 2 | 0 | 0 |
| YouTube Data | 5 | 4 | 0 |
| Video Analysis | 4 | 0 | 1 |
| Comment Management | 8 | 5 | 2 |
| AI Replies | 4 | 1 | 1 |
| Tone Learning | 3 | 1 | 0 |
| Billing | 3 | 2 | 0 |
| **TOTAL** | **35** | **16** | **4** |

---

## 4. Database Tables

**Total:** 8 core tables + 3 utility tables

### Core Application Tables

#### Table: `profiles`
**Purpose:** User accounts and subscription data

**Columns:**
```sql
id                      UUID PRIMARY KEY
email                   TEXT NOT NULL
name                    TEXT
password_hash           TEXT
avatar_url              TEXT
tier                    TEXT (free | pro)
subscription_status     TEXT
subscribed_until        TIMESTAMPTZ
stripe_customer_id      TEXT
stripe_subscription_id  TEXT
youtube_access_token    TEXT
youtube_refresh_token   TEXT
youtube_token_expiry    TIMESTAMPTZ
youtube_scope           TEXT
email_verified          BOOLEAN
last_login_at           TIMESTAMPTZ
created_at              TIMESTAMPTZ
updated_at              TIMESTAMPTZ
```

**Relationships:**
- Referenced by: `video_analyses`, `user_videos`, `usage_counters`, `tone_profiles`, `reply_settings`, `comment_scores`, `reply_queue`

**What Breaks Without It:** 🔴 Complete auth failure, cannot identify users

---

#### Table: `video_analyses`
**Purpose:** Stored sentiment analysis results

**Columns:**
```sql
user_id                 UUID REFERENCES profiles(id)
video_id                TEXT
analyzed_at             TIMESTAMPTZ
sentiment               JSONB (pos, neu, neg)
score                   NUMERIC
top_positive            JSONB (array of comments)
top_negative            JSONB (array of comments)
summary                 TEXT
raw                     JSONB (full data)
PRIMARY KEY (user_id, video_id, analyzed_at)
```

**Indexes:**
- `(user_id, video_id, analyzed_at DESC)`
- `(user_id, analyzed_at DESC)` for trends

**What Breaks Without It:** 🟡 Cannot store/retrieve analyses, must re-analyze every time (expensive!)

---

#### Table: `user_videos`
**Purpose:** Cache of YouTube video metadata

**Columns:**
```sql
user_id                 UUID REFERENCES profiles(id)
video_id                TEXT
title                   TEXT
thumbnail_url           TEXT
published_at            TIMESTAMPTZ
stats                   JSONB (views, likes, comments)
fetched_at              TIMESTAMPTZ
PRIMARY KEY (user_id, video_id)
```

**What Breaks Without It:** 🟢 Minor - Must fetch from YouTube API every time (slower, uses quota)

---

#### Table: `usage_counters`
**Purpose:** Track usage quotas (free vs pro limits)

**Columns:**
```sql
user_id                 UUID PRIMARY KEY
plan_id                 TEXT REFERENCES plans(id)
replies_used_month      INT
month_start             DATE
replies_posted_today    INT
day_start               DATE
queued_replies          INT
updated_at              TIMESTAMPTZ
```

**What Breaks Without It:** 🔴 Cannot enforce quotas, free users could abuse unlimited features

---

#### Table: `tone_profiles`
**Purpose:** Learned creator voice/tone

**Columns:**
```sql
user_id                 UUID PRIMARY KEY
tone                    VARCHAR (casual, professional, etc.)
formality_level         VARCHAR
emoji_usage             VARCHAR
common_emojis           TEXT[]
avg_reply_length        VARCHAR
common_phrases          TEXT[]
uses_name               BOOLEAN
asks_questions          BOOLEAN
uses_commenter_name     BOOLEAN
example_replies         TEXT[]
learned_from_count      INT
learned_at              TIMESTAMPTZ
```

**What Breaks Without It:** 🟢 Minor - Replies generic, not personalized

---

#### Table: `comment_scores`
**Purpose:** Priority scores for comments (Pro feature)

**Columns:**
```sql
id                      UUID PRIMARY KEY
user_id                 UUID REFERENCES profiles(id)
comment_id              TEXT
video_id                TEXT
priority_score          INT (0-100)
reasons                 TEXT[]
should_auto_reply       BOOLEAN
comment_text            TEXT
author_name             TEXT
is_subscriber           BOOLEAN
like_count              INT
sentiment               VARCHAR
is_question             BOOLEAN
is_spam                 BOOLEAN
scored_at               TIMESTAMPTZ
```

**What Breaks Without It:** 🟢 Minor - Pro users cannot prioritize comments, must review all manually

---

#### Table: `reply_queue`
**Purpose:** Queued replies waiting to be posted

**Columns:**
```sql
id                      UUID PRIMARY KEY
user_id                 UUID
comment_id              TEXT
reply_text              TEXT
video_id                TEXT
status                  TEXT (pending | posted | failed)
error_message           TEXT
created_at              TIMESTAMPTZ
posted_at               TIMESTAMPTZ
attempts                INT
max_attempts            INT
```

**What Breaks Without It:** 🟡 Cannot batch-post replies, must post immediately (hits rate limits)

---

#### Table: `reply_settings`
**Purpose:** User preferences for comment prioritization

**Columns:**
```sql
user_id                     UUID PRIMARY KEY
prioritize_subscribers      BOOLEAN
prioritize_questions        BOOLEAN
prioritize_negative         BOOLEAN
prioritize_verified         BOOLEAN
prioritize_large_channels   BOOLEAN
prioritize_first_time       BOOLEAN
prioritize_popular          BOOLEAN
custom_keywords             TEXT[]
ignore_spam                 BOOLEAN
ignore_generic_praise       BOOLEAN
ignore_links                BOOLEAN
```

**What Breaks Without It:** 🟢 Minor - Uses default settings

---

### Utility Tables

#### Table: `plans`
**Purpose:** Rate limit configurations (free vs pro)

**Columns:**
```sql
id                          TEXT PRIMARY KEY (free | pro)
monthly_ai_replies_limit    INT (null = unlimited)
daily_post_cap              INT (null = unlimited)
```

**Data:**
- `free`: 50 replies/month, 25 posts/day
- `pro`: unlimited replies, 100 posts/day

---

#### Table: `stripe_events`
**Purpose:** Webhook idempotency tracking

**Columns:**
```sql
id                      SERIAL PRIMARY KEY
event_id                TEXT UNIQUE
type                    TEXT
payload                 JSONB
processed               BOOLEAN
created_at              TIMESTAMPTZ
```

**What Breaks Without It:** 🟡 Duplicate webhook processing, inconsistent subscription state

---

### Database Relationships

```
profiles (users)
  ├── video_analyses (1-to-many)
  ├── user_videos (1-to-many)
  ├── usage_counters (1-to-1)
  ├── tone_profiles (1-to-1)
  ├── reply_settings (1-to-1)
  ├── comment_scores (1-to-many)
  └── reply_queue (1-to-many)

plans
  └── usage_counters (1-to-many)
```

**Foreign Keys:** All tables use `ON DELETE CASCADE` - deleting a user deletes all their data.

---

## 5. Third-Party Integrations

### Direct API Integrations

| Service | Integration Type | Credentials | Configuration |
|---------|------------------|-------------|---------------|
| **OpenAI** | REST API | API Key | `OPENAI_API_KEY` |
| **YouTube Data API** | REST API | OAuth 2.0 | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `YOUTUBE_API_KEY` |
| **Stripe** | REST API + Webhooks | Secret Key + Webhook Secret | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID` |
| **Supabase** | SDK | Service Role Key | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |

---

### SDK/Library Integrations

#### OpenAI SDK
```typescript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Used in: packages/server/src/llm.ts
```

**Functions:**
- `analyzeSentiment()` - Sentiment analysis
- `chatReply()` - Generate replies
- `generateCommentSummary()` - Video summaries

---

#### Google APIs SDK
```typescript
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

// Used in: packages/server/src/lib/google.ts
```

**Functions:**
- `getYouTubeClient()` - Create authenticated client
- `refreshAccessToken()` - Refresh expired tokens
- Fetch videos, comments, post replies

---

#### Stripe SDK
```typescript
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-09-30.clover'
});

// Used in: packages/server/src/http/routes/billing.ts
```

**Functions:**
- `stripe.checkout.sessions.create()` - Start checkout
- `stripe.billingPortal.sessions.create()` - Manage billing
- `stripe.customers.create()` - Create customer
- `stripe.subscriptions.retrieve()` - Get subscription

---

#### Supabase SDK
```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Used in: packages/server/src/db/client.ts
```

**Functions:**
- `.from('table').select()` - Query data
- `.from('table').insert()` - Insert data
- `.from('table').update()` - Update data
- `.rpc('function_name')` - Call stored procedures

---

### Webhook Integrations

#### Stripe Webhooks
**Endpoint:** `POST /api/webhook/stripe`
**Signature Verification:** Required (`stripe-signature` header)

**Events Handled:**
- `checkout.session.completed` - User completed payment
- `customer.subscription.created` - New subscription
- `customer.subscription.updated` - Subscription renewed/changed
- `customer.subscription.deleted` - Subscription cancelled
- `invoice.paid` - Successful payment
- `invoice.payment_failed` - Failed payment

**What It Does:**
- Updates `profiles.tier` to `pro`
- Sets `subscription_status` and `subscribed_until`
- Records event in `stripe_events` for idempotency

---

## 6. Failure Impact Analysis

### Critical Path Dependencies

**If Vercel fails:**
```
User opens app
  → DNS resolves to Vercel
    → [FAILURE] Vercel is down
      → User sees: 503 Service Unavailable
        → Impact: Complete outage
          → Duration: Until Vercel recovers
            → Workaround: None (unless we migrate to another host)
```

**Mitigation:**
- Vercel 99.99% uptime SLA
- Multi-region deployment
- Can migrate to AWS/GCP if needed (2-3 days work)

---

**If Supabase fails:**
```
User logs in
  → POST /api/auth/login
    → Backend queries Supabase
      → [FAILURE] Supabase is down
        → Backend returns: 500 Internal Server Error
          → User sees: "Login failed"
            → Impact: Cannot login, cannot fetch data
              → Duration: Until Supabase recovers
                → Workaround: Restore from backup to self-hosted PostgreSQL
```

**Mitigation:**
- Daily automated backups
- 7-day point-in-time recovery
- Can export and migrate to self-hosted PostgreSQL (4-8 hours work)

---

**If OpenAI fails:**
```
User clicks "Analyze Video"
  → POST /api/analysis/:videoId
    → Backend calls OpenAI API
      → [FAILURE] OpenAI returns 503
        → Backend catches error
          → Fallback: Rule-based sentiment (keywords)
            → User sees: Results with "AI unavailable" badge
              → Impact: Lower quality analysis, no AI replies
                → Duration: Until OpenAI recovers
                  → Workaround: Use cached results, wait, or use fallback
```

**Mitigation:**
- Graceful degradation to rule-based analysis
- Cache all results (never need to re-analyze)
- Error messages explain retry later

---

**If Stripe fails:**
```
User clicks "Upgrade to Pro"
  → POST /api/billing/checkout
    → Backend calls Stripe API
      → [FAILURE] Stripe returns 503
        → Backend returns error
          → User sees: "Payment processing unavailable, please try again"
            → Impact: Cannot upgrade to Pro
              → Existing Pro users: Unaffected
                → Free users: Can still use app
                  → Duration: Until Stripe recovers
                    → Workaround: Manual upgrade via database (emergency only)
```

**Mitigation:**
- Existing subscriptions continue working
- Webhook retries handle temporary failures
- Can manually upgrade users via SQL if urgent

---

**If YouTube API quota exceeded:**
```
User analyzes 300th video today
  → POST /api/analysis/:videoId
    → Backend calls YouTube API
      → [FAILURE] YouTube returns 403 Quota Exceeded
        → Backend returns error
          → User sees: "YouTube quota exceeded, please try tomorrow"
            → Impact: Cannot analyze new videos today
              → Cached videos: Still visible
                → Old analyses: Still work
                  → Duration: Until midnight (quota resets)
                    → Workaround: Request quota increase from Google
```

**Mitigation:**
- Cache video metadata
- Cache analyses indefinitely
- Limit fetching to 1,000 comments/video
- Request quota increase if needed ($100-500/month for 100,000 units/day)

---

## 7. Dependency Health Dashboard

### External Service Health Checks

| Service | Status Page | Current Status | Last Incident |
|---------|-------------|----------------|---------------|
| Vercel | https://www.vercel-status.com/ | 🟢 Operational | N/A |
| Supabase | https://status.supabase.com/ | 🟢 Operational | N/A |
| OpenAI | https://status.openai.com/ | 🟢 Operational | N/A |
| Stripe | https://status.stripe.com/ | 🟢 Operational | N/A |
| YouTube API | https://developers.google.com/youtube/v3/status | 🟢 Operational | N/A |

---

### Package Update Status

**Backend:**
- ✅ All packages up-to-date
- ⚠️ 2 minor security updates available
- 🟢 No critical vulnerabilities

**Frontend:**
- ✅ All packages up-to-date
- 🟢 No security vulnerabilities
- ℹ️ Radix UI has minor updates available

**Update Commands:**
```bash
# Check for updates
pnpm outdated

# Update all packages
pnpm update

# Update specific package
pnpm add <package>@latest
```

---

### Dependency Risk Assessment

| Dependency | Risk Level | Reason | Mitigation |
|------------|------------|--------|------------|
| Vercel | 🟡 Medium | Vendor lock-in | Can migrate to AWS/Netlify (2-3 days) |
| Supabase | 🟡 Medium | Vendor lock-in | Can migrate to self-hosted PostgreSQL (1 day) |
| OpenAI | 🟢 Low | Fallback exists | Rule-based sentiment as backup |
| Stripe | 🟢 Low | Industry standard | Can switch to Paddle/Chargebee |
| YouTube API | 🟡 Medium | Quota limits | Cache aggressively, request increase |
| React | 🔴 High | Core framework | No alternative without full rewrite |
| Fastify | 🟢 Low | Can replace | Can switch to Express easily |
| TypeScript | 🔴 High | Core language | No alternative without full rewrite |

---

### Monthly Cost Breakdown

| Service | Tier | Monthly Cost | Cost per User | Notes |
|---------|------|--------------|---------------|-------|
| **Vercel** | Pro | $20 | $0.002 | First 100GB bandwidth included |
| **Supabase** | Pro | $25 | $0.0025 | 8GB database, daily backups |
| **OpenAI** | Pay-as-you-go | $50-200 | $0.005-0.02 | Varies with usage |
| **Stripe** | Transaction fees | 2.9% + $0.30 | Variable | Only on Pro subscriptions |
| **YouTube API** | Free | $0 | $0 | 10,000 quota/day (may need increase) |
| **Google OAuth** | Free | $0 | $0 | Unlimited |
| **Domain** | N/A | $12/year | $0.001/month | Example |
| **TOTAL** | | **$95-245/month** | **~$0.01-0.03/user** | At 10,000 users |

---

### Recommended Monitoring

**What to Monitor:**
1. ✅ **Uptime:** Vercel, Supabase (use UptimeRobot or Pingdom)
2. ✅ **API Errors:** Track 5xx errors in backend logs
3. ✅ **OpenAI Usage:** Monitor token consumption and costs
4. ✅ **YouTube Quota:** Track quota usage (Google Cloud Console)
5. ✅ **Stripe Webhooks:** Monitor failed webhook deliveries
6. ✅ **Database Size:** Monitor storage growth (Supabase dashboard)

**Alerting Thresholds:**
- ⚠️ Error rate > 1% of requests
- 🔴 Uptime < 99.9% in 24 hours
- ⚠️ YouTube quota > 8,000/10,000
- 🔴 OpenAI costs > $500/month
- ⚠️ Database size > 6GB/8GB

---

## Summary

**Total Dependencies:**
- **6** External services
- **98** NPM packages (36 backend, 62 frontend)
- **35+** API endpoints
- **8** Database tables
- **4** Third-party API integrations
- **1** Webhook integration

**Single Points of Failure:**
1. 🔴 **Vercel** - Complete outage if down
2. 🔴 **Supabase** - Cannot read/write data if down
3. 🟡 **OpenAI** - Core features degrade (has fallback)

**Cost:** $95-245/month at current scale (~10,000 users = $0.01-0.03/user/month)

**Health:** 🟢 All systems operational, no critical vulnerabilities

---

**Document Version:** 1.0
**Last Updated:** November 21, 2025
**Next Review:** February 1, 2026
