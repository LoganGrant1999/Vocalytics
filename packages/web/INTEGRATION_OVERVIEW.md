# Vocalytics Frontend-Backend Integration Overview

## Executive Summary

**Current State**:
- Frontend: Pure UI mockup with mock data ✅
- Backend: Production-ready API (7.5/10 score) ✅

**Integration Goal**: Connect React frontend to Fastify backend with minimal changes to both codebases.

**Estimated Time**: 2-4 hours (backend prep) + 4-6 hours (frontend integration) = **6-10 hours total**

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER BROWSER                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  React Frontend (Vite)                                          │
│  ├── React Router (routing)                                     │
│  ├── TanStack Query (data fetching)                             │
│  ├── Shadcn UI (components)                                     │
│  └── Tailwind CSS (styling)                                     │
│                                                                  │
│  Port: 8080 (dev) / Vercel (prod)                              │
│                                                                  │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 │ HTTP Requests (fetch with credentials)
                 │
┌────────────────▼────────────────────────────────────────────────┐
│                                                                  │
│  Fastify Backend                                                │
│  ├── CORS middleware (credentials enabled)                      │
│  ├── JWT auth (HttpOnly cookies)                                │
│  ├── YouTube OAuth                                              │
│  ├── Sentiment Analysis (OpenAI)                                │
│  ├── Reply Generation (GPT-4)                                   │
│  ├── Stripe Billing                                             │
│  └── Rate Limiting                                              │
│                                                                  │
│  Port: 3000 (dev) / Vercel (prod)                              │
│                                                                  │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 │ Database queries
                 │
┌────────────────▼────────────────────────────────────────────────┐
│                                                                  │
│  Supabase PostgreSQL                                            │
│  ├── Users table                                                │
│  ├── Subscriptions table                                        │
│  ├── Quota tracking                                             │
│  ├── Voice profiles                                             │
│  └── Row Level Security (RLS)                                   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Integration Points

### 1. Authentication Flow

**Current Backend Implementation**:
- ✅ YouTube OAuth 2.0 with CSRF protection
- ✅ JWT issued in HttpOnly cookie (30-day expiry)
- ✅ Automatic token refresh
- ✅ Secure cookie settings

**Frontend Changes Needed**:
- Create AuthContext to manage user state
- Add protected route wrapper
- Handle OAuth redirect flow
- Display user info in header

**Backend Changes Needed**:
- ✅ Add CORS for frontend origin
- ✅ Create `/api/auth/me` endpoint
- ✅ Ensure cookie `sameSite: 'lax'`

---

### 2. YouTube Data Integration

**Backend Endpoints** (already exist):
- `GET /api/youtube/videos` - List videos
- `GET /api/youtube/comments?videoId=...` - Get comments
- Rate limited: 10 req/min

**Frontend Pages**:
- `VideosPage.tsx` - Replace mock videos
- `VideoDetailPage.tsx` - Fetch real comments
- `DashboardPage.tsx` - Show recent activity

**Integration**:
- TanStack Query hooks for caching
- Loading skeletons
- Error handling with retry

---

### 3. Sentiment Analysis

**Backend Endpoint**: `POST /api/analyze-comments`

**Paywall Logic** (already implemented):
- Free tier: 2 analyses/week (resets Monday)
- Pro tier: Unlimited
- Atomic quota tracking (no race conditions)

**Frontend Integration**:
- Trigger analysis from video detail page
- Show quota usage in dashboard
- Display paywall banner when quota exceeded
- Visualize sentiment distribution

---

### 4. AI Reply Generation

**Backend Endpoint**: `POST /api/generate-replies`

**Paywall Logic** (already implemented):
- Free tier: 1 reply/day (resets daily)
- Pro tier: Unlimited
- 220 character limit (YouTube constraint)

**Frontend Integration**:
- Voice profile configuration page
- Draft reply review interface
- Batch approval for Pro users
- Individual/bulk posting

---

### 5. Billing Integration

**Backend Endpoints** (already exist):
- `POST /api/billing/checkout` - Stripe checkout
- `POST /api/billing/portal` - Customer portal
- Webhook handler for subscription events

**Frontend Integration**:
- Upgrade button → Stripe checkout
- Manage billing → Stripe portal
- Show current plan & status
- Handle success/cancel redirects

---

## Data Flow Example: Analyzing Comments

```
1. User clicks video on VideosPage
   └─> Frontend: useQuery('/api/youtube/comments?videoId=abc123')
       └─> Backend: Fetch from YouTube API (with rate limit check)
           └─> Returns: List of comments

2. User clicks "Analyze Sentiment"
   └─> Frontend: useMutation('/api/analyze-comments')
       └─> Backend:
           ├─> Check quota (free: 2/week, pro: unlimited)
           ├─> If allowed: Call OpenAI API
           ├─> Decrement quota
           └─> Return sentiment data
       └─> Frontend: Update UI with sentiment pills, topics, priority scores

3. User clicks "Generate Replies"
   └─> Frontend: useMutation('/api/generate-replies')
       └─> Backend:
           ├─> Check quota (free: 1/day, pro: unlimited)
           ├─> If allowed: Call GPT-4 with voice profile
           ├─> Decrement quota
           └─> Return drafted replies (max 220 chars)
       └─> Frontend: Show drafts for review

4. User approves and posts reply
   └─> Frontend: useMutation('/api/youtube/reply')
       └─> Backend: Post to YouTube API
       └─> Frontend: Show success toast
```

---

## Frontend API Client Architecture

### File Structure
```
src/
├── lib/
│   ├── api.ts              # Fetch wrapper with auth
│   └── queryClient.ts       # TanStack Query config
├── hooks/
│   ├── useAuth.tsx          # Auth context + hooks
│   ├── useYouTube.ts        # YouTube data queries
│   ├── useAnalysis.ts       # Sentiment analysis mutations
│   ├── useReplies.ts        # Reply generation mutations
│   └── useBilling.ts        # Stripe billing mutations
├── components/
│   └── ProtectedRoute.tsx   # Auth guard wrapper
└── pages/
    └── (existing pages)      # Replace mock data with hooks
```

### API Client Example (`lib/api.ts`)
```typescript
const API_BASE = import.meta.env.VITE_API_URL;

export async function apiClient<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: 'include', // Send cookies
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message);
  }

  return res.json();
}
```

### Auth Hook Example (`hooks/useAuth.tsx`)
```typescript
export function useAuth() {
  const { data: user, isLoading, error } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => apiClient<AuthResponse>('/api/auth/me'),
    retry: false,
  });

  return {
    user,
    isAuthenticated: !!user,
    isLoading,
    error,
  };
}
```

---

## Backend Changes Summary

### ✅ Already Implemented
- YouTube OAuth with refresh token preservation
- JWT auth with HttpOnly cookies
- Sentiment analysis with OpenAI
- Reply generation with GPT-4
- Stripe checkout + webhook handling
- Quota enforcement (atomic operations)
- Rate limiting
- Row Level Security (RLS)

### ⚠️ Needs Implementation
1. **CORS Configuration**
   ```typescript
   fastify.register(cors, {
     origin: process.env.FRONTEND_URL,
     credentials: true,
   });
   ```

2. **`GET /api/auth/me` Endpoint**
   - Return user + subscription + quota in one call
   - Reduces frontend API calls

3. **Standardized Error Format**
   ```typescript
   {
     error: {
       code: 'QUOTA_EXCEEDED',
       message: 'You have used all 2 analyses this week.',
       details: { quotaResetsAt: '2025-01-13T00:00:00Z' }
     }
   }
   ```

4. **Environment Variable**
   - Add `FRONTEND_URL=http://localhost:8080` to `.env`

---

## Migration Steps

### Step 1: Backend Preparation (Do this first!)
1. Copy `BACKEND_MIGRATION_PROMPT.md` to your backend repo
2. Give the prompt to Claude in that repo
3. Claude will implement all necessary backend changes
4. Test endpoints with Postman/curl
5. Verify all tests still pass

### Step 2: Frontend Integration (Do this after backend is ready)
1. Create `.env` file: `VITE_API_URL=http://localhost:3000`
2. Build API client layer (`lib/api.ts`)
3. Create auth context (`hooks/useAuth.tsx`)
4. Add protected routes
5. Create TanStack Query hooks for each feature
6. Replace mock data in pages one by one
7. Test end-to-end flows

### Step 3: Testing & Polish
1. Test OAuth flow (start to finish)
2. Test paywall enforcement (free tier limits)
3. Test Stripe checkout (use test mode)
4. Test reply generation + posting
5. Add error boundaries
6. Add loading states
7. Run Lighthouse audit

### Step 4: Deployment
1. Deploy backend to Vercel (or Railway/Render)
2. Deploy frontend to Vercel
3. Update `FRONTEND_URL` env var in backend
4. Update `VITE_API_URL` env var in frontend
5. Test production OAuth flow
6. Monitor for errors (add Sentry)

---

## Development Workflow

### Terminal 1: Backend
```bash
cd ~/vocalytics-backend
npm run dev
# Runs on http://localhost:3000
```

### Terminal 2: Frontend
```bash
cd ~/reply-sculptor
npm run dev
# Runs on http://localhost:8080
```

### Testing Flow
1. Open `http://localhost:8080`
2. Click "Sign In"
3. Redirects to `http://localhost:3000/api/auth/youtube`
4. Complete YouTube OAuth
5. Redirects back to `http://localhost:8080/app/dashboard` with cookie
6. Dashboard fetches data from backend API

---

## Environment Variables

### Backend `.env`
```bash
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:8080

DATABASE_URL=postgresql://...
YOUTUBE_CLIENT_ID=...
YOUTUBE_CLIENT_SECRET=...
OPENAI_API_KEY=...
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
JWT_SECRET=your-secret-key
```

### Frontend `.env`
```bash
VITE_API_URL=http://localhost:3000
```

---

## Security Checklist

### ✅ Backend (Already Implemented)
- HttpOnly cookies (prevents XSS)
- Secure flag in production (HTTPS only)
- SameSite=lax (CSRF protection)
- CSRF state in OAuth (prevents authorization code interception)
- JWT expiry (30 days)
- Rate limiting
- Input validation (Zod schemas)
- Row Level Security on database

### ✅ Frontend (Built-in)
- No localStorage for sensitive data (cookies only)
- HTTPS in production (platform enforced)
- Content Security Policy (add to Vercel config)
- No inline scripts

---

## Performance Considerations

### Frontend Optimizations
- TanStack Query caching (reduce API calls)
- React.lazy for code splitting
- Image optimization (next/image or similar)
- Bundle size monitoring

### Backend Optimizations (Already Implemented)
- Fastify (very fast framework)
- Connection pooling (Supabase)
- Rate limiting (prevents abuse)

### Future Improvements
- Add Redis for caching
- Add CDN for static assets
- Add service worker for offline support
- Add skeleton loaders (instead of spinners)

---

## Known Issues & Resolutions

### Issue 1: "Cookies not working"
**Symptom**: Auth cookie not being set/sent
**Cause**: CORS or cookie settings
**Fix**:
- Verify `credentials: 'include'` in fetch
- Verify `sameSite: 'lax'` in backend
- Verify `FRONTEND_URL` matches exactly

### Issue 2: "CORS error"
**Symptom**: Browser blocks request
**Cause**: Origin not whitelisted
**Fix**:
- Add frontend URL to CORS config
- Include credentials in CORS config

### Issue 3: "OAuth redirect loop"
**Symptom**: Keeps redirecting to login
**Cause**: Cookie not being preserved
**Fix**:
- Check JWT_SECRET is set
- Check cookie domain/path settings
- Verify secure flag matches environment

---

## Testing Checklist

### Manual Testing
- [ ] Sign in with YouTube OAuth
- [ ] View list of videos
- [ ] Analyze comments (free tier: 2/week limit)
- [ ] Generate replies (free tier: 1/day limit)
- [ ] Upgrade to Pro via Stripe
- [ ] Generate unlimited replies (Pro)
- [ ] Manage billing via Stripe portal
- [ ] Log out

### Automated Testing
- [ ] Run backend test suite (584 tests)
- [ ] Add E2E tests with Playwright
- [ ] Run Lighthouse audit (aim for 90+)

---

## Success Metrics

### Technical
- ✅ All 584 backend tests passing
- ✅ Lighthouse score 90+ (all categories)
- ✅ Zero CORS errors
- ✅ Zero auth issues
- ✅ API response times < 500ms

### Business
- ✅ User can complete OAuth flow
- ✅ User can analyze comments
- ✅ User can generate replies
- ✅ User can upgrade to Pro
- ✅ Paywall enforcement works
- ✅ Stripe webhooks update subscription

---

## Next Steps After Integration

1. **Error Tracking**: Add Sentry
2. **Analytics**: Enable PostHog (already configured in backend)
3. **Monitoring**: Add uptime monitoring (Pingdom/UptimeRobot)
4. **SEO**: Add SSR for landing page
5. **Mobile**: Test on mobile devices
6. **Accessibility**: WCAG AA compliance audit
7. **Performance**: Add Redis caching layer
8. **Scaling**: Add queue system for async jobs (Bull/BullMQ)

---

## Contact & Support

For issues during integration:
1. Check `INTEGRATION_GUIDE.md` for detailed steps
2. Review backend assessment for known issues
3. Test endpoints with Postman/curl before frontend integration
4. Use browser DevTools Network tab to debug API calls

---

**TL;DR**: Your backend is solid (7.5/10). Your frontend UI is done. Integration is straightforward:
1. Add CORS + `/api/auth/me` endpoint to backend
2. Build API client + auth hooks in frontend
3. Replace mock data with real API calls
4. Test end-to-end
5. Ship it! 🚀
