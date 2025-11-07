# Vocalytics Frontend-Backend Integration Guide

## Overview

This document outlines how this frontend (reply-sculptor) integrates with the Vocalytics backend.

## Architecture

```
Frontend (Vite + React)  <-->  Backend (Fastify + Supabase)
     Port 8080                      Port 3000
```

### Authentication Flow
- Backend handles YouTube OAuth and issues JWT in HttpOnly cookie
- Frontend reads auth state from `/api/auth/me` endpoint
- All API requests automatically include auth cookie
- Protected routes check auth state before rendering

### API Integration Points

#### 1. Authentication (`/api/auth/*`)
- `GET /api/auth/youtube` - Initiate YouTube OAuth
- `GET /api/auth/youtube/callback` - OAuth callback handler
- `GET /api/auth/me` - Get current user & subscription status
- `POST /api/auth/logout` - Clear auth cookie

#### 2. YouTube Data (`/api/youtube/*`)
- `GET /api/youtube/videos` - List user's YouTube videos
- `GET /api/youtube/comments?videoId=...` - Get comments for video
- Rate limited: 10 requests/minute

#### 3. AI Analysis (`/api/analyze-comments`)
- `POST /api/analyze-comments` - Analyze sentiment of comments
- Request body:
  ```json
  {
    "videoId": "abc123",
    "comments": [
      {
        "id": "comment-id",
        "text": "Great video!",
        "authorChannelId": "UC...",
        "authorDisplayName": "John Doe",
        "likeCount": 5,
        "publishedAt": "2025-01-07T12:00:00Z"
      }
    ]
  }
  ```
- Response includes sentiment, topics, toxicity, intent
- **Quota enforcement**: Free tier = 2/week

#### 4. Reply Generation (`/api/generate-replies`)
- `POST /api/generate-replies` - Generate AI replies
- Request body:
  ```json
  {
    "comments": [
      {
        "id": "comment-id",
        "text": "What mic do you use?",
        "sentiment": "neutral",
        "topics": ["gear question"]
      }
    ],
    "voiceProfile": {
      "tone": "casual",
      "catchphrases": ["More coming soon 🙏"],
      "style": "friendly and authentic"
    }
  }
  ```
- **Quota enforcement**: Free tier = 1/day

#### 5. Reply Posting (`/api/youtube/reply`)
- `POST /api/youtube/reply` - Post reply to YouTube
- Request body:
  ```json
  {
    "commentId": "xyz789",
    "replyText": "Thanks for watching! 🙏"
  }
  ```

#### 6. Billing (`/api/billing/*`)
- `POST /api/billing/checkout` - Create Stripe checkout session
- `POST /api/billing/portal` - Redirect to Stripe customer portal
- `GET /api/billing/subscription` - Get current subscription status

### Data Models

#### User
```typescript
interface User {
  id: string;
  email: string;
  youtubeChannelId: string;
  youtubeChannelName: string;
  plan: 'free' | 'pro';
  stripeCustomerId?: string;
  subscriptionStatus?: 'active' | 'canceled' | 'past_due';
}
```

#### Quota Usage
```typescript
interface QuotaUsage {
  sentimentAnalysesUsed: number;
  sentimentAnalysesLimit: number; // 2 for free, Infinity for pro
  aiRepliesUsed: number;
  aiRepliesLimit: number; // 1 for free, Infinity for pro
  resetsAt: string; // ISO timestamp
}
```

#### Analyzed Comment
```typescript
interface AnalyzedComment {
  id: string;
  text: string;
  authorDisplayName: string;
  authorChannelId: string;
  likeCount: number;
  publishedAt: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  sentimentScore: number; // 0-1
  topics: string[];
  toxicity: number; // 0-1
  intent: 'question' | 'feedback' | 'praise' | 'complaint' | 'other';
  priorityScore: number; // 0-100
}
```

## Frontend Implementation Checklist

### Phase 1: Setup (Backend repo)
- [ ] Add CORS configuration for `http://localhost:8080` (dev) and production URL
- [ ] Ensure cookie settings work: `sameSite: 'lax'`, `secure: true` (prod)
- [ ] Create `GET /api/auth/me` endpoint (returns user + quota + subscription)
- [ ] Test all endpoints with Postman/Thunder Client

### Phase 2: Frontend API Layer (This repo)
- [ ] Create `src/lib/api.ts` - API client with fetch wrapper
- [ ] Create `src/hooks/useAuth.tsx` - Auth context + hooks
- [ ] Create `src/hooks/useYouTube.ts` - TanStack Query hooks for YouTube data
- [ ] Create `src/hooks/useAnalysis.ts` - Hooks for sentiment analysis
- [ ] Create `src/hooks/useBilling.ts` - Hooks for Stripe billing

### Phase 3: Auth Integration
- [ ] Build `AuthProvider` wrapper
- [ ] Add protected route component
- [ ] Update `SignInPage` to redirect to OAuth
- [ ] Add logout functionality
- [ ] Show real user data in header

### Phase 4: Replace Mock Data
- [ ] `DashboardPage` - Fetch real quota, recent comments
- [ ] `VideosPage` - Fetch YouTube videos from API
- [ ] `VideoDetailPage` - Fetch comments + analyze
- [ ] `CommentsPage` - Fetch analyzed comments, enable reply generation
- [ ] `BillingPage` - Connect Stripe checkout + portal
- [ ] `VoiceProfilePage` - Save voice profile to backend

### Phase 5: Error Handling & Polish
- [ ] Add loading skeletons (not just spinners)
- [ ] Add error boundaries
- [ ] Add toast notifications for API errors
- [ ] Add retry logic for failed requests
- [ ] Add optimistic updates where appropriate

### Phase 6: Testing
- [ ] Test full OAuth flow
- [ ] Test paywall enforcement (free tier limits)
- [ ] Test Stripe checkout flow
- [ ] Test reply generation + posting
- [ ] Lighthouse audit (aim for 90+ scores)

## Development Setup

### 1. Clone both repos
```bash
# Backend
cd ~/vocalytics-backend
npm install
npm run dev  # Runs on port 3000

# Frontend
cd ~/reply-sculptor
npm install
npm run dev  # Runs on port 8080
```

### 2. Configure environment variables

**Backend `.env`:**
```
PORT=3000
DATABASE_URL=postgresql://...
YOUTUBE_CLIENT_ID=...
YOUTUBE_CLIENT_SECRET=...
OPENAI_API_KEY=...
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
JWT_SECRET=your-secret-key
FRONTEND_URL=http://localhost:8080
```

**Frontend `.env`:**
```
VITE_API_URL=http://localhost:3000
```

### 3. Test integration
1. Start backend: `npm run dev`
2. Start frontend: `npm run dev`
3. Navigate to `http://localhost:8080`
4. Click "Sign In" → Should redirect to backend OAuth
5. After auth, should redirect back to frontend dashboard

## Deployment

### Option 1: Separate Deployments
- **Frontend**: Vercel/Netlify (static hosting)
- **Backend**: Vercel/Railway (Node.js hosting)
- **Requirement**: CORS properly configured

### Option 2: Monorepo (Recommended)
Move frontend into backend repo as `client/` directory:
```
vocalytics/
├── server/          # Existing backend
├── client/          # This frontend
├── package.json     # Workspace root
└── vercel.json      # Deploy both together
```

Benefits:
- Same-origin cookies (no CORS issues)
- Single deployment
- Easier to maintain

## Known Gotchas

1. **Cookies not working?**
   - Check `sameSite` setting (must be `'lax'` or `'none'`)
   - Check `secure` flag (must be `true` in production)
   - Verify `FRONTEND_URL` matches exactly

2. **CORS errors?**
   - Add frontend URL to CORS whitelist
   - Include `credentials: 'include'` in fetch requests

3. **OAuth redirect loop?**
   - Check JWT secret is set in production
   - Verify cookie domain is correct

4. **Rate limiting?**
   - YouTube API: 10 req/min (per user)
   - Analysis API: Quota-based (2/week free, unlimited pro)

## Next Steps

After basic integration works:
1. Add error tracking (Sentry)
2. Add analytics (PostHog already configured in backend)
3. Add performance monitoring
4. Add E2E tests (Playwright)
5. Run Lighthouse audit
6. Add SSR for landing page (better SEO)
