# Vocalytics - Claude Code Reference

**AI-powered YouTube comment sentiment analysis and reply assistant**

---

## Project Overview

Vocalytics is a SaaS application that helps YouTube creators:
- Analyze comment sentiment using AI (GPT-4)
- Generate AI-powered replies in their voice/tone
- Prioritize important comments to respond to
- Track engagement trends across videos

**Tech Stack**: React + TypeScript (frontend) | Fastify + TypeScript (backend) | PostgreSQL (Supabase) | Deployed on Vercel

---

## Quick Reference

### Project Structure
```
Vocalytics/
├── packages/
│   ├── web/           # React frontend (87 files, ~8K LOC)
│   │   ├── src/pages/           # 14 route pages
│   │   ├── src/components/      # 68 UI components
│   │   ├── src/hooks/           # Custom React hooks (useAuth, etc.)
│   │   └── src/lib/api.ts       # API client (all backend calls)
│   │
│   └── server/        # Fastify backend (86 files, ~8.7K LOC)
│       ├── src/http/routes/     # 16 API route files
│       ├── src/db/              # 7 database access files
│       ├── src/services/        # 2 business logic services
│       ├── src/llm.ts           # OpenAI integration
│       └── src/schemas.ts       # Zod validation schemas
│
├── api/               # Vercel serverless entry points
├── supabase/migrations/  # Database migrations (20+ files)
├── tests/             # 38 test files (~17.9K LOC, 2:1 coverage)
└── scripts/           # Utility scripts
```

### Database Schema (8 Core Tables)

```sql
profiles              -- Users (email, tier, stripe_customer_id, youtube_tokens)
video_analyses        -- Cached sentiment results (sentiment, score, summary, top comments)
usage_counters        -- Quota tracking (analyze_weekly_count, replies_posted_today)
tone_profiles         -- Learned user voice/tone
comment_scores        -- Priority scoring (0-100, reasons, is_question)
user_videos          -- Cached YouTube metadata
reply_queue          -- Pending AI-generated replies
reply_settings       -- User preferences for reply generation
```

**Key Relationships**:
- `profiles` (1) → (many) `video_analyses`, `comment_scores`, `reply_queue`
- `profiles` (1) → (1) `usage_counters`, `tone_profiles`

---

## Key API Endpoints (35+)

### Authentication (4)
- `POST /api/auth/register` - Create account (bcrypt + JWT cookie)
- `POST /api/auth/login` - Sign in
- `POST /api/auth/logout` - Clear cookie
- `GET /api/auth/me` - Get current user + quota

### Video Analysis (4) 🔥 Core Feature
- `POST /api/analysis/:videoId` - Analyze sentiment (quota: 2/week free)
- `GET /api/analysis/:videoId` - Get cached analysis
- `GET /api/analysis` - List all analyses
- `GET /api/analysis/trends` - Aggregate stats

### YouTube Data (5)
- `GET /api/youtube/videos` - Fetch user's videos
- `GET /api/youtube/comments` - Fetch video comments
- `POST /api/youtube/reply` - Post reply to comment
- `POST /api/youtube/connect` - OAuth flow
- `GET /api/youtube/channel` - Channel info

### Billing (3)
- `POST /api/billing/checkout` - Create Stripe session
- `POST /api/billing/portal` - Customer portal link
- `POST /api/webhook/stripe` - Webhook handler (with idempotency)

### Comments & Replies (10+)
- Score, prioritize, generate, queue, tone analysis...

---

## Common Development Tasks

### Running Locally
```bash
pnpm install          # Install dependencies
pnpm dev              # Start both frontend + backend
pnpm dev:web          # Frontend only (port 5173)
pnpm dev:http         # Backend only (port 3030)
```

### Testing
```bash
pnpm test             # Run all tests
pnpm test:watch       # Watch mode
pnpm typecheck        # TypeScript checks
pnpm lint             # ESLint
```

### Building
```bash
pnpm build            # Build both packages
pnpm --filter web build
pnpm --filter server build
```

### Database
```bash
# Connect to production DB
PGPASSWORD='sb_secret_...' psql -h db.aveujrwionxljrutvsze.supabase.co -p 5432 -U postgres -d postgres

# Run migration
PGPASSWORD='sb_secret_...' psql ... -f supabase/migrations/filename.sql
```

---

## Architecture Patterns

### Overall Pattern
- **Client-Server** with **Serverless** backend (Vercel Functions)
- **Three-Layer Backend**: Routes → Services → Database
- **RESTful API** design
- **Event-Driven** (Stripe webhooks)

### Frontend Patterns
- **Component-based** (React 18 + TypeScript)
- **Client-side routing** (React Router)
- **State management**: Context API (auth) + React Query (server state)
- **Styling**: Tailwind CSS + Radix UI components

### Backend Patterns
- **Dependency injection**: Fastify decorators
- **Middleware pipeline**: CORS → Cookie Parser → Auth → Rate Limit → Paywall → Route
- **Schema validation**: Zod for all inputs
- **Database access**: Supabase client (PostgreSQL)

### Security
- JWT tokens in HTTP-only cookies
- bcrypt password hashing (10 rounds)
- Row-Level Security (RLS) in database
- Rate limiting (10 req/min typical)
- Input validation with Zod

---

## Important Files to Know

### Frontend
| File | Purpose | LOC |
|------|---------|-----|
| `packages/web/src/App.tsx` | Root component, provider setup | ~50 |
| `packages/web/src/hooks/useAuth.tsx` | Auth context (user, quota, login/logout) | ~150 |
| `packages/web/src/lib/api.ts` | **ALL backend API calls** | 409 |
| `packages/web/src/pages/VideoDetailPage.tsx` | Video analysis UI | ~300 |
| `packages/web/src/components/shared/VideoAnalysisInput.tsx` | Main analysis trigger | ~200 |

### Backend
| File | Purpose | LOC |
|------|---------|-----|
| `packages/server/src/index.ts` | Fastify app entry point | ~100 |
| `packages/server/src/http/routes/analysis.ts` | 🔴 **HEAVY** - Video analysis logic | 352 |
| `packages/server/src/http/routes/auth.ts` | Registration + login | 288 |
| `packages/server/src/http/routes/billing.ts` | Stripe integration | 229 |
| `packages/server/src/llm.ts` | OpenAI API wrapper | ~200 |
| `packages/server/src/schemas.ts` | Zod validation schemas | ~300 |
| `packages/server/src/db/analyses.ts` | Analysis CRUD operations | ~150 |

### Configuration
| File | Purpose |
|------|---------|
| `vercel.json` | Deployment config + cron jobs |
| `pnpm-workspace.yaml` | Monorepo setup |
| `.env` (local only) | Environment variables |

---

## Data Flow Examples

### Video Analysis Flow (10-30 seconds, ~$0.10-$0.50 cost)
1. User clicks "Analyze" → `POST /api/analysis/:videoId`
2. Check quota → `usage_counters` table (free: 2/week)
3. Fetch comments → YouTube API (up to 1000, paginated)
4. Analyze sentiment → OpenAI API (batch processing)
5. Aggregate results → `{pos: 0.65, neu: 0.25, neg: 0.10}`
6. Generate summary → OpenAI API (second call)
7. Save to DB → `video_analyses` table
8. Increment quota → `usage_counters`
9. Return to frontend → Display charts + top comments

### Authentication Flow
1. User submits form → `POST /api/auth/login`
2. Validate input → Zod schema
3. Query DB → `SELECT * FROM profiles WHERE email = ?`
4. Compare password → `bcrypt.compare(input, hash)`
5. Generate JWT → `jwt.sign({userId, email, tier})`
6. Set cookie → HTTP-only, secure, sameSite: 'lax'
7. Return user data → Frontend updates context

### Payment Flow (Stripe)
1. User clicks "Upgrade" → `POST /api/billing/checkout`
2. Create Stripe customer (if needed)
3. Create checkout session → Redirect to Stripe
4. User pays → Stripe redirects back
5. **Background webhook** → `POST /api/webhook/stripe`
6. Verify signature + idempotency → `stripe_events` table
7. Update user tier → `UPDATE profiles SET tier = 'pro'`
8. User refreshes → Sees Pro features

---

## External Dependencies

### Critical Services (🔴 = outage if fails)
- 🔴 **Vercel** ($20/mo) - Hosting + serverless functions
- 🔴 **Supabase** ($25/mo) - PostgreSQL database
- 🟡 **OpenAI** ($50-200/mo) - GPT-4 for analysis/replies (has fallback)
- 🟡 **Stripe** (2.9% + $0.30) - Payment processing
- 🟡 **YouTube Data API** (Free, 10k/day) - Video/comment data
- 🟡 **Google OAuth** (Free) - YouTube account connection

### Failure Mitigation
- **OpenAI fails** → Graceful degradation to rule-based sentiment
- **YouTube quota exceeded** → Wait until midnight reset
- **Stripe fails** → Cannot upgrade, free tier unaffected
- **Vercel/Supabase fails** → Complete outage (no mitigation)

---

## Known Issues & Tech Debt

### 🔴 High Priority
1. **Heavy route files** (352-629 lines) - Business logic should be in services
2. **Thin service layer** - Only 2 service files, most logic in routes
3. **Mixed concerns** - Routes calling external APIs directly

### 🟡 Medium Priority
1. **Large API client** (`api.ts` = 409 lines) - Could split by feature
2. **"God file" tools.ts** - Multiple unrelated responsibilities
3. **Inconsistent error handling** - Some routes throw, others return error objects

### 🟢 Low Priority
1. **Code duplication** - Similar Zod schemas across files
2. **Missing JSDoc** - Most functions lack documentation
3. **Console.log debugging** - Should use proper logger

---

## Testing Strategy

**Coverage**: 38 test files, ~17,912 LOC (2:1 test-to-production ratio)

**Test Categories**:
- **Unit tests**: Database access, services, utilities
- **Integration tests**: API endpoints (with mocked external services)
- **E2E tests**: `scripts/prod_verify.sh` (full user flows)

**Running Tests**:
```bash
pnpm test                    # All tests
pnpm --filter server test    # Backend only
pnpm --filter web test       # Frontend only
npx vitest run path/to/test  # Single file
```

---

## Environment Variables

### Required
```bash
# Database
SUPABASE_URL=https://aveujrwionxljrutvsze.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Auth
JWT_SECRET=your-secret-key

# OpenAI
OPENAI_API_KEY=sk-proj-...

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...

# YouTube
GOOGLE_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
GOOGLE_REDIRECT_URI=http://localhost:3030/auth/youtube/callback

# Quotas (optional, defaults exist)
FREE_LIMIT_ANALYZE_WEEKLY=2
FREE_LIMIT_REPLY_DAILY=1
```

---

## Quota System (Free vs Pro)

### Free Tier Limits
- **Video analysis**: 2 per week
- **AI replies**: 1 per day
- **Comment scoring**: Unlimited
- **Tone learning**: From 10 comments max

### Pro Tier ($9.99/month)
- **Video analysis**: Unlimited
- **AI replies**: Unlimited
- **Comment scoring**: Unlimited
- **Tone learning**: Unlimited samples
- **Priority support**: Email support

### Enforcement
- Middleware: `enforceAnalyze()`, `enforceReply()`
- Database: `usage_counters` table with atomic functions
- Reset: Daily cron job at 8:10 AM UTC

---

## Deployment

### Production URLs
- **Frontend**: https://vocalytics.vercel.app
- **API**: https://vocalytics.vercel.app/api/*
- **Database**: Supabase (managed)

### Vercel Configuration
```json
{
  "functions": {
    "api/**/*.ts": { "memory": 1024, "maxDuration": 60 }
  },
  "crons": [
    { "path": "/api/cron/queue-worker", "schedule": "*/5 * * * *" },
    { "path": "/api/cron/reset-counters", "schedule": "10 8 * * *" }
  ]
}
```

### Deployment Process
```bash
git push origin main        # Auto-deploys to Vercel
# OR
vercel --prod              # Manual deploy
```

---

## When Working on Features

### Adding a New API Endpoint
1. Create route in `packages/server/src/http/routes/`
2. Add Zod schema in `src/schemas.ts`
3. Add middleware (auth, rate limit, paywall) as needed
4. Create database access function in `src/db/`
5. Add to `src/index.ts` route registration
6. Add frontend API call in `packages/web/src/lib/api.ts`
7. Write tests in `tests/`

### Adding a Database Table
1. Create migration in `supabase/migrations/`
2. Run migration against production DB
3. Add TypeScript types
4. Create CRUD functions in `src/db/`
5. Update relevant routes

### Adding a New Page
1. Create component in `packages/web/src/pages/`
2. Add route in `src/App.tsx`
3. Add navigation link if needed
4. Update API calls in `src/lib/api.ts`

---

## Performance Considerations

### Frontend
- Code splitting via Vite (automatic)
- React Query caching (5-minute default)
- Lazy loading for large components
- Optimistic updates for better UX

### Backend
- Database indexes on all foreign keys
- Aggressive caching of AI results (never re-analyze)
- Pagination for large datasets (100 items/page)
- Batch OpenAI requests when possible

### Cost Optimization
- Cache expensive operations (AI analysis)
- Free tier for YouTube API
- Serverless = pay-per-request (no idle costs)
- ~$0.01-0.03 per user per month at scale

---

## Debugging Tips

### Frontend Issues
```bash
# Check React Query cache
Open DevTools → React Query DevTools (bottom right)

# Check auth state
console.log(useAuth()) in any component

# Network requests
DevTools → Network tab → Filter: "api"
```

### Backend Issues
```bash
# Check logs in Vercel
vercel logs --follow

# Test endpoint locally
curl -X POST http://localhost:3030/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'

# Check database
PGPASSWORD='...' psql ... -c "SELECT * FROM profiles LIMIT 5;"
```

### Common Issues
1. **401 Unauthorized** → Check JWT cookie, may need to re-login
2. **402 Payment Required** → User hit quota limit
3. **429 Too Many Requests** → Rate limit exceeded
4. **503 Service Unavailable** → External API (OpenAI, YouTube) failed

---

## Git Workflow

### Branches
- `main` - Production branch (auto-deploys)
- `sprint-N-*` - Feature branches
- `hotfix-*` - Urgent fixes

### Commit Messages
```bash
git commit -m "feat: add comment priority scoring"
git commit -m "fix: resolve quota reset bug"
git commit -m "docs: update architecture diagrams"
```

### Pre-commit Checks
```bash
pnpm typecheck    # TypeScript errors?
pnpm lint         # ESLint errors?
pnpm test         # Tests passing?
```

---

## Resources

- **Architecture Docs**: See `architecture-pattern.md`, `architecture-diagram.md`
- **Data Flow**: See `data-flow-analysis.md`
- **Dependencies**: See `dependency-mapping.md`
- **Codebase Map**: See `code-base-analysis.md`
- **Diagrams**: See `architecture-diagrams/` folder (PNG + PDF exports)

---

## Quick Commands Reference

```bash
# Development
pnpm dev                     # Start both frontend + backend
pnpm test                    # Run all tests
pnpm typecheck               # TypeScript validation
pnpm build                   # Build for production

# Database
pnpm db:connect              # (if script exists)
# Manual: See "Database" section above

# Deployment
git push origin main         # Auto-deploy to Vercel
vercel --prod               # Manual deploy

# Utilities
pnpm lint --fix             # Auto-fix linting issues
pnpm clean                  # Clean build artifacts (if script exists)
```

---

**Last Updated**: November 21, 2025
**Maintained By**: Engineering Team
**For Questions**: See documentation files or ask in #engineering
