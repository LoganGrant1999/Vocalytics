# Vocalytics Codebase Analysis

**Last Updated:** November 21, 2025
**Total Lines of Code:** ~38,972 lines (excluding dependencies)

---

## What is Vocalytics?

Vocalytics (formerly TubeWhisperer) is a **YouTube comment management platform** that helps content creators:
- Analyze sentiment of comments on their videos
- Generate AI-powered replies to comments
- Track usage and manage billing through Stripe
- Learn and adapt to the creator's tone/voice

Think of it as an **AI assistant for YouTube creators** that reads comments, understands emotions, and helps craft authentic responses.

---

## Project Architecture Overview

This is a **monorepo** (multiple related projects in one repository) using:
- **pnpm workspaces** - Manages multiple packages efficiently
- **TypeScript** - Type-safe JavaScript for fewer bugs
- **Node.js 20.x** - Runtime environment

### The Three Main Parts:
1. **Frontend** (`packages/web`) - What users see and interact with
2. **Backend** (`packages/server`) - API and business logic
3. **Infrastructure** - Database, deployment, and automation

---

## Directory Structure & Purposes

### 📁 Root Level Directories

#### `/packages/`
**Purpose:** The main workspace containing all source code

| Directory | Type | Purpose | Lines of Code |
|-----------|------|---------|---------------|
| `packages/server/` | Backend | API endpoints, database logic, AI services | ~26,649 lines |
| `packages/web/` | Frontend | React UI, pages, components | ~8,032 lines |
| `packages/web.backup/` | Archive | Backup of old frontend (ignore) | N/A |

#### `/api/`
**Purpose:** Vercel serverless functions for deployment
- `api/index.ts` - Main API entry point for Vercel
- `api/cron/queue-worker.ts` - Background job processor (runs every 5 minutes)
- `api/cron/reset-counters.ts` - Daily usage counter reset (runs at 8:10 AM)

These are **thin wrappers** that call the actual server code in `packages/server/`.

#### `/supabase/`
**Purpose:** Database schema and migrations (PostgreSQL)
- Contains SQL files that modify the database structure
- Migration files are numbered chronologically (e.g., `20251011_atomic_quota.sql`)
- **12 migration files** total

#### `/scripts/`
**Purpose:** Utility scripts for development and deployment
- `prod_verify.sh` - End-to-end production testing
- `smoke.sh` - Quick health checks
- `get-jwt.js` - Generate authentication tokens for testing
- `apply-migration.js` - Run database migrations
- `monitor-queue.ts` - Watch background job queue

#### `/tests/`
**Purpose:** Integration and end-to-end tests
- Tests the entire system as a real user would
- Includes billing lifecycle, rate limits, OAuth flows

#### `/.github/workflows/`
**Purpose:** CI/CD automation (GitHub Actions)
- `ci.yml` - Runs linting, type checking, tests on every push
- `verify.yml` - Runs comprehensive verification suite
- `web.yml` - Builds frontend on pull requests

#### `/docs/`
**Purpose:** Project documentation and planning

#### `/images/`
**Purpose:** Brand assets (logos, screenshots)

---

## Frontend Deep Dive (`packages/web/`)

**Technology Stack:**
- **React 18** - UI library
- **Vite** - Lightning-fast build tool
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first styling
- **React Router** - Page navigation
- **React Query** - Data fetching and caching
- **Radix UI** - Accessible component primitives

### Directory Structure

```
packages/web/
├── src/
│   ├── components/       # Reusable UI pieces
│   │   ├── ui/          # 54 base components (buttons, dialogs, etc.)
│   │   └── shared/      # 14 app-specific components (charts, cards)
│   ├── pages/           # 14 full page views
│   ├── hooks/           # 3 custom React hooks (auth, mobile, toast)
│   ├── lib/             # 3 utility libraries (API client, YouTube helpers)
│   ├── App.tsx          # Main app component
│   └── main.tsx         # Entry point
├── public/              # Static assets (images, favicon)
├── vite.config.ts       # Build configuration
├── tailwind.config.ts   # Styling configuration
└── package.json         # Dependencies and scripts
```

### Key Frontend Files

| File | Role | What It Does |
|------|------|--------------|
| `src/main.tsx` | Entry Point | Boots up the React app, wraps it with providers |
| `src/App.tsx` | Root Component | Sets up routing and global layout |
| `src/lib/api.ts` | API Client | All backend communication happens here (129 lines) |
| `src/hooks/useAuth.tsx` | Authentication | Manages user login state and JWT tokens |
| `src/pages/DashboardPage.tsx` | Main Dashboard | Overview of videos, usage, and analytics |
| `src/pages/VideosPage.tsx` | Video List | Browse and analyze YouTube videos |
| `src/pages/CommentsPage.tsx` | Comment Inbox | View and reply to comments |
| `src/components/shared/SentimentChart.tsx` | Data Viz | Charts showing comment sentiment distribution |
| `src/components/ui/*` | UI Library | 54 pre-built, styled, accessible components |

### Frontend Pages (14 Total)

1. **LandingPage.tsx** - Marketing homepage
2. **RegisterPage.tsx** - Sign up flow
3. **SignInPage.tsx** - Login flow
4. **DashboardPage.tsx** - Main hub after login
5. **VideosPage.tsx** - List of user's YouTube videos
6. **VideoDetailPage.tsx** - Deep dive into single video's comments
7. **CommentsPage.tsx** - Comment management inbox
8. **BillingPage.tsx** - Subscription and payment
9. **SettingsPage.tsx** - User preferences
10. **VoiceProfilePage.tsx** - AI tone learning
11. **ConnectYouTubePage.tsx** - OAuth connection flow
12. **AppShell.tsx** - Wrapper with nav and sidebar
13. **AuthGate.tsx** - Protects authenticated routes
14. **NotFound.tsx** - 404 page

---

## Backend Deep Dive (`packages/server/`)

**Technology Stack:**
- **Fastify** - High-performance web framework
- **Supabase** - PostgreSQL database + Auth
- **OpenAI API** - GPT-4 for AI replies and moderation
- **Google APIs** - YouTube Data API v3
- **Stripe** - Payment processing
- **Zod** - Runtime validation
- **Vitest** - Testing framework

### Directory Structure

```
packages/server/
├── src/
│   ├── http/            # API routes and middleware
│   │   ├── routes/      # 16 endpoint files
│   │   └── __tests__/   # 20 route test files
│   ├── db/              # Database operations
│   │   └── __tests__/   # Database tests
│   ├── services/        # Business logic
│   ├── workers/         # Background jobs
│   ├── lib/             # Utilities (JWT, Google auth)
│   ├── config/          # Environment configuration
│   └── types/           # TypeScript type definitions
├── fixtures/            # Test data
└── package.json
```

### Code Statistics

- **Production Code:** ~8,737 lines
- **Test Code:** ~17,912 lines (2.05x more tests than code!)
- **Test Files:** 38 files
- **Test Coverage:** Excellent (more test code than production code)

### Key Backend Files

| File | Lines | Role | What It Does |
|------|-------|------|--------------|
| `src/http/index.ts` | - | Server Entry | Starts Fastify server, registers routes |
| `src/http/auth.ts` | - | Auth Middleware | Verifies JWT tokens on protected routes |
| `src/http/paywall.ts` | - | Usage Limits | Blocks requests when user hits free tier limits |
| `src/http/rateLimit.ts` | - | Rate Limiting | Prevents abuse (e.g., max 10 requests/minute) |
| `src/db/client.ts` | - | Database | Supabase connection and query helper |
| `src/db/users.ts` | - | User Data | CRUD operations for user accounts |
| `src/db/analyses.ts` | - | Analytics | Store and retrieve video sentiment data |
| `src/db/usage.ts` | - | Quota Tracking | Track API usage per user |
| `src/llm.ts` | - | AI Integration | Calls OpenAI for sentiment and replies |
| `src/lib/google.ts` | - | YouTube API | Fetch videos and comments from YouTube |
| `src/workers/queueWorker.ts` | - | Background Jobs | Processes async tasks (e.g., bulk analysis) |
| `src/workers/resetCounters.ts` | - | Daily Reset | Resets usage counters for free tier |

### API Routes (16 Files)

| Route File | HTTP Endpoints | Purpose |
|------------|----------------|---------|
| `auth.ts` | POST `/auth/register`, `/auth/login` | User registration and login |
| `me.ts` | GET `/me` | Get current user profile |
| `youtube-oauth.ts` | GET `/youtube/auth`, `/youtube/callback` | YouTube OAuth flow |
| `youtube-api.ts` | GET `/youtube/channels`, `/youtube/videos` | Fetch YouTube data |
| `youtube-videos.ts` | GET `/youtube/videos/:videoId` | Single video details |
| `analysis.ts` | POST `/analysis`, GET `/analysis/:videoId` | Video sentiment analysis |
| `comments.ts` | GET `/comments/:videoId` | Fetch comments for video |
| `analyze-comments.ts` | POST `/analyze-comments` | Analyze sentiment of comments |
| `generate-replies.ts` | POST `/generate-replies` | AI-generated comment replies |
| `tone.ts` | POST `/tone/learn`, GET `/tone` | Learn creator's voice |
| `billing.ts` | POST `/billing/checkout`, `/billing/portal` | Stripe subscription management |
| `webhook.ts` | POST `/webhook/stripe` | Handle Stripe webhook events |
| `fetch-comments.ts` | GET `/fetch-comments/:videoId` | Paginated comment fetching |
| `summarize-sentiment.ts` | GET `/summarize-sentiment/:videoId` | Aggregate sentiment stats |
| `debug-youtube.ts` | GET `/debug/youtube` | Debugging helper |

### Database Schema (Key Tables)

From migration files in `/supabase/migrations/`:

1. **profiles** - User accounts (email, tier, YouTube tokens, Stripe IDs)
2. **video_analyses** - Sentiment analysis results per video
3. **comments** - YouTube comments cache
4. **replies** - Generated replies (draft and posted)
5. **tone_samples** - Examples of creator's tone for AI learning
6. **priority_queues** - Background job queue
7. **rate_limit_buckets** - Rate limiting state

---

## Configuration Files

| File | Purpose | Who Uses It |
|------|---------|-------------|
| `package.json` (root) | Workspace configuration, global scripts | pnpm, all packages |
| `pnpm-workspace.yaml` | Defines which folders are packages | pnpm |
| `tsconfig.json` | TypeScript compiler settings (strict mode) | TypeScript compiler |
| `eslint.config.js` | Code linting rules | ESLint |
| `.prettierrc` | Code formatting rules | Prettier |
| `vitest.config.ts` | Test runner configuration | Vitest |
| `.nvmrc` | Specifies Node.js version (20.x) | nvm |
| `.env` | Secret keys and API tokens (NOT committed to git) | Backend |
| `.env.example` | Template for environment variables | Developers |
| `vercel.json` | Deployment configuration | Vercel |

---

## Deployment Files

| File | Purpose |
|------|---------|
| `api/index.ts` | Vercel serverless function entry point |
| `api/cron/*.ts` | Scheduled background jobs |
| `vercel.json` | Configures build, functions, cron jobs, routes |
| `.vercelignore` | Files to exclude from deployment |
| `.github/workflows/ci.yml` | CI pipeline (lint, test, build) |
| `.github/workflows/verify.yml` | End-to-end verification tests |
| `.github/workflows/web.yml` | Frontend build on PRs |

---

## Testing Infrastructure

### Test Organization

**Total Test Lines:** ~17,912 lines
**Production Code Lines:** ~8,737 lines
**Test-to-Code Ratio:** 2.05:1 (excellent!)

### Test Files by Category

**Backend Route Tests** (20 files in `src/http/__tests__/`):
- `auth.route.test.ts` - Login, registration, JWT validation
- `billing.route.test.ts` - Stripe checkout and webhooks
- `youtube-oauth.route.test.ts` - YouTube OAuth flow
- `analysis.route.test.ts` - Video sentiment analysis
- `quota-integration.test.ts` - Usage limit enforcement
- `rate-limits.test.ts` - API rate limiting
- `paywall.integration.test.ts` - Free vs Pro feature gating

**Database Tests** (3 files in `src/db/__tests__/`):
- `users.test.ts` - User CRUD operations
- `usage.test.ts` - Quota tracking
- `stripe.test.ts` - Billing data

**Service Tests** (2 files in `src/services/__tests__/`):
- `toneAnalysis.test.ts` - Voice learning
- `commentScoring.test.ts` - Sentiment scoring

**Worker Tests** (2 files in `src/workers/__tests__/`):
- `queueWorker.test.ts` - Background job processing
- `resetCounters.test.ts` - Daily usage reset

**Integration Tests** (in `/tests/`):
- `prod.spec.ts` - Full production simulation
- `billing_lifecycle.spec.ts` - Complete billing flow
- `youtube.oauth.spec.ts` - OAuth end-to-end
- `concurrency.spec.ts` - Race condition testing
- `security.spec.ts` - Security validation

---

## Key Workflows Explained

### 1. User Registration Flow
```
User fills form → POST /auth/register → Create profile in DB → Return JWT token → Store in localStorage → User logged in
```

**Files Involved:**
- Frontend: `RegisterPage.tsx`, `useAuth.tsx`, `lib/api.ts`
- Backend: `http/routes/auth.ts`, `db/users.ts`

### 2. YouTube Video Analysis Flow
```
User connects YouTube → OAuth flow → Get access token → Fetch videos → User selects video → Fetch comments → Analyze sentiment with OpenAI → Store results → Display charts
```

**Files Involved:**
- Frontend: `ConnectYouTubePage.tsx`, `VideosPage.tsx`, `VideoDetailPage.tsx`, `SentimentChart.tsx`
- Backend: `routes/youtube-oauth.ts`, `routes/youtube-api.ts`, `routes/analysis.ts`, `llm.ts`, `lib/google.ts`

### 3. AI Reply Generation Flow
```
User views comment → Clicks "Generate Reply" → POST /generate-replies with tone preference → OpenAI generates reply → Store draft → User edits/posts
```

**Files Involved:**
- Frontend: `CommentsPage.tsx`, `CommentWithReply.tsx`
- Backend: `routes/generate-replies.ts`, `llm.ts`, `db/analyses.ts`

### 4. Billing/Subscription Flow
```
User hits free tier limit → Show upgrade banner → Click upgrade → POST /billing/checkout → Stripe Checkout → User pays → Webhook updates DB → User gets Pro features
```

**Files Involved:**
- Frontend: `BillingPage.tsx`, `UpgradeBanner.tsx`
- Backend: `routes/billing.ts`, `routes/webhook.ts`, `db/stripe.ts`, `http/paywall.ts`

---

## Development Scripts

These commands are defined in `package.json` files:

### Root Commands (run from project root)
```bash
pnpm install          # Install all dependencies
pnpm build            # Build both packages
pnpm test             # Run all tests
pnpm lint             # Lint all code
pnpm typecheck        # Type-check TypeScript
pnpm dev              # Start both server and web in parallel
pnpm dev:server       # Start backend only (port 3000)
pnpm dev:web          # Start frontend only (port 5173)
```

### Server Commands (run from `packages/server/`)
```bash
pnpm dev              # Development mode with hot reload
pnpm dev:http         # Start HTTP server only
pnpm build            # Compile TypeScript
pnpm test             # Run unit and integration tests
pnpm typecheck        # Check types without building
pnpm worker:queue     # Manually run queue worker
pnpm worker:reset     # Manually reset usage counters
```

### Web Commands (run from `packages/web/`)
```bash
pnpm dev              # Vite dev server (localhost:5173)
pnpm build            # Production build
pnpm preview          # Preview production build
pnpm lint             # Lint frontend code
```

---

## Environment Variables

These are stored in `.env` (never committed to git):

### Backend (`packages/server/`)
```bash
# Database
DATABASE_URL=postgresql://...
SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=...

# Authentication
JWT_SECRET=...

# YouTube API
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
YOUTUBE_API_KEY=...

# OpenAI
OPENAI_API_KEY=sk-...
REPLIES_MODEL=gpt-4o-mini
MODERATION_MODEL=omni-moderation-latest

# Stripe
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_PRO=price_...

# Usage Limits
FREE_LIMIT_ANALYZE_WEEKLY=10
FREE_LIMIT_REPLY_DAILY=5
```

### Frontend (`packages/web/`)
```bash
VITE_API_URL=http://localhost:3000  # Backend URL
VITE_ENABLE_POSTING=false            # Actually post to YouTube
VITE_POSTHOG_KEY=...                 # Analytics (optional)
```

---

## Understanding the Codebase as a Beginner

### Start Here:
1. **Read** `README.md` - High-level overview
2. **Browse** `packages/web/src/pages/` - See what users interact with
3. **Check** `packages/server/src/http/routes/` - See what APIs exist
4. **Run** `pnpm dev` - Start the app and click around

### Key Concepts to Learn:

**Monorepo:** Multiple related projects in one repository. Easier to share code and ensure consistency.

**TypeScript:** JavaScript with types. Catches bugs before runtime.

**React:** Build UIs with reusable components. Each `.tsx` file is a component.

**Fastify:** Fast web framework for Node.js. Handles HTTP requests.

**Supabase:** PostgreSQL database + authentication service. Handles user accounts and data storage.

**Vitest:** Testing framework. Ensures code works as expected.

**pnpm:** Fast, disk-efficient package manager. Better than npm.

**Vite:** Modern build tool. Super fast hot module replacement.

### Code Reading Tips:

1. **Frontend Pages** - Start with page components to understand user flows
2. **API Routes** - Look at route files to see what endpoints exist
3. **Database Files** - Check `db/` folder to understand data model
4. **Tests** - Read tests to understand how code should behave

### Common File Extensions:
- `.ts` - TypeScript file
- `.tsx` - TypeScript + JSX (React components)
- `.json` - Configuration data
- `.sql` - Database queries
- `.sh` - Shell script (automation)
- `.yml` - YAML config (CI/CD)

---

## Architecture Decisions

### Why a Monorepo?
- Share types between frontend and backend
- Single CI/CD pipeline
- Atomic commits across full stack
- Easier to keep versions in sync

### Why Fastify over Express?
- 2x faster request handling
- Better TypeScript support
- Built-in schema validation
- Modern async/await patterns

### Why Supabase over Custom Auth?
- Production-ready authentication
- Row-level security (RLS)
- Built-in PostgreSQL
- Reduces boilerplate code

### Why Vercel Serverless?
- Auto-scaling
- Zero server maintenance
- Global CDN
- Integrated cron jobs

---

## Next Steps for Learning

### To Understand Frontend:
1. Read `packages/web/src/App.tsx`
2. Pick a page like `DashboardPage.tsx` and trace data flow
3. Check `lib/api.ts` to see how frontend talks to backend
4. Read `hooks/useAuth.tsx` to understand authentication

### To Understand Backend:
1. Start with `packages/server/src/http/index.ts`
2. Pick a route file like `routes/auth.ts` and follow the flow
3. Check `db/users.ts` to see database operations
4. Read `llm.ts` to understand AI integration

### To Run Your First Feature:
1. Set up `.env` files (use `.env.example` as template)
2. Run `pnpm install`
3. Run `pnpm dev` to start both servers
4. Open `http://localhost:5173`
5. Register an account and explore

### To Write Your First Test:
1. Look at existing tests in `src/http/__tests__/`
2. Copy a similar test structure
3. Run `pnpm test` to execute
4. Tests use Vitest - read their docs for advanced features

---

## Summary Statistics

| Metric | Value |
|--------|-------|
| **Total Lines** | 38,972 |
| **Backend Code** | 8,737 lines |
| **Backend Tests** | 17,912 lines |
| **Frontend Code** | 8,032 lines |
| **Test Coverage Ratio** | 2.05:1 (tests to code) |
| **Total Files** | 200+ TypeScript/JavaScript files |
| **API Routes** | 16 route files, 40+ endpoints |
| **Frontend Pages** | 14 pages |
| **UI Components** | 54 base + 14 custom = 68 total |
| **Database Tables** | 7 main tables |
| **Migrations** | 12 SQL files |
| **Test Files** | 38 test suites |
| **Dependencies** | ~100 npm packages |

---

## Quick Reference: Where to Find Things

| "I need to..." | "Look in..." |
|----------------|--------------|
| Add a new page | `packages/web/src/pages/` |
| Add a new API endpoint | `packages/server/src/http/routes/` |
| Modify the database | Create new file in `supabase/migrations/` |
| Change styling | `packages/web/tailwind.config.ts` or component files |
| Add authentication logic | `packages/server/src/http/auth.ts` |
| Integrate a new API | Create service in `packages/server/src/services/` |
| Add a background job | `packages/server/src/workers/` |
| Configure deployment | `vercel.json` or `.github/workflows/` |
| Update dependencies | Relevant `package.json` file |
| Add environment variable | `.env` and `.env.example` |

---

**Built by:** Logan Gibbons
**Tech Stack:** TypeScript, React, Fastify, Supabase, OpenAI, Stripe, Vercel
**License:** Private (not open source)
