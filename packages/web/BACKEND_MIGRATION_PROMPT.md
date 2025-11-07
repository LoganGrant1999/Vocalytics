# Backend Migration Prompt

Copy and paste this prompt to Claude in your Vocalytics backend repository:

---

I have a React frontend (reply-sculptor) that I need to integrate with this backend. The frontend is already built with all UI components and uses TanStack Query for data fetching. I need you to prepare this backend for integration by implementing the following changes:

## 1. CORS Configuration

Add CORS middleware to allow requests from the frontend:
- Development: `http://localhost:8080`
- Production: Will be provided later (update FRONTEND_URL env var)
- Must allow credentials (cookies)
- Allow methods: GET, POST, PUT, DELETE, OPTIONS
- Allow headers: Content-Type, Authorization

**Location**: Likely in main server file (e.g., `server/index.ts` or `server/server.ts`)

**Requirements**:
```typescript
// Add to fastify plugins
fastify.register(cors, {
  origin: process.env.FRONTEND_URL || 'http://localhost:8080',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
})
```

## 2. Create `/api/auth/me` Endpoint

The frontend needs a single endpoint to get current user state, subscription, and quota usage.

**Endpoint**: `GET /api/auth/me`

**Response format**:
```typescript
{
  user: {
    id: string;
    email: string;
    youtubeChannelId: string;
    youtubeChannelName: string;
    youtubeProfileImageUrl?: string;
  },
  subscription: {
    plan: 'free' | 'pro';
    status: 'active' | 'canceled' | 'past_due' | 'trialing' | null;
    stripeCustomerId?: string;
    subscriptionId?: string;
    currentPeriodEnd?: string; // ISO date
  },
  quota: {
    sentimentAnalyses: {
      used: number;
      limit: number; // 2 for free, 999999 for pro
      resetsAt: string; // ISO date (next Monday)
    },
    aiReplies: {
      used: number;
      limit: number; // 1 for free, 999999 for pro
      resetsAt: string; // ISO date (tomorrow)
    }
  }
}
```

**If not authenticated**: Return `401 Unauthorized`

**Implementation notes**:
- Verify JWT from cookie
- Query user from database
- Get subscription status from Stripe (or cached in DB)
- Get quota usage from database
- Return combined object

## 3. Review YouTube API Endpoints

Ensure these endpoints exist and return data in a frontend-friendly format:

### `GET /api/youtube/videos`
**Purpose**: List user's YouTube videos

**Response**:
```typescript
{
  videos: [
    {
      id: string;
      title: string;
      description: string;
      thumbnailUrl: string;
      publishedAt: string; // ISO date
      viewCount: number;
      commentCount: number;
    }
  ]
}
```

### `GET /api/youtube/comments?videoId={videoId}`
**Purpose**: Get comments for a specific video

**Response**:
```typescript
{
  comments: [
    {
      id: string;
      text: string;
      authorDisplayName: string;
      authorChannelId: string;
      authorProfileImageUrl?: string;
      likeCount: number;
      publishedAt: string; // ISO date
      parentId?: string; // If it's a reply
    }
  ],
  nextPageToken?: string; // For pagination
}
```

## 4. Review Sentiment Analysis Endpoint

### `POST /api/analyze-comments`

**Request body**:
```typescript
{
  videoId: string;
  comments: [
    {
      id: string;
      text: string;
      authorChannelId: string;
      authorDisplayName: string;
      likeCount: number;
      publishedAt: string;
    }
  ]
}
```

**Response**:
```typescript
{
  results: [
    {
      commentId: string;
      sentiment: 'positive' | 'negative' | 'neutral';
      sentimentScore: number; // 0-1
      topics: string[];
      toxicity: number; // 0-1
      intent: 'question' | 'feedback' | 'praise' | 'complaint' | 'other';
      priorityScore: number; // 0-100
      badges: string[]; // e.g., ["Top Fan", "Question", "Sponsor mention"]
    }
  ],
  quotaUsed: {
    sentimentAnalysesUsed: number;
    sentimentAnalysesLimit: number;
  }
}
```

**Paywall enforcement**:
- Free tier: 2 analyses per week (resets Monday)
- Pro tier: Unlimited
- Return `402 Payment Required` if quota exceeded

## 5. Review Reply Generation Endpoint

### `POST /api/generate-replies`

**Request body**:
```typescript
{
  comments: [
    {
      id: string;
      text: string;
      sentiment: string;
      topics: string[];
      authorDisplayName: string;
    }
  ],
  voiceProfile: {
    tone: string; // "casual", "professional", "friendly", etc.
    catchphrases: string[];
    style: string;
    examples?: string[]; // Example replies in creator's voice
  }
}
```

**Response**:
```typescript
{
  replies: [
    {
      commentId: string;
      generatedReply: string; // Max 220 chars for YouTube
      confidence: number; // 0-1
    }
  ],
  quotaUsed: {
    aiRepliesUsed: number;
    aiRepliesLimit: number;
  }
}
```

**Paywall enforcement**:
- Free tier: 1 reply per day (resets at midnight UTC)
- Pro tier: Unlimited
- Return `402 Payment Required` if quota exceeded

## 6. Review Reply Posting Endpoint

### `POST /api/youtube/reply`

**Request body**:
```typescript
{
  commentId: string;
  replyText: string;
}
```

**Response**:
```typescript
{
  success: boolean;
  replyId: string;
  message: string;
}
```

**Error handling**:
- `400` - Invalid comment ID or reply text
- `401` - Not authenticated
- `403` - YouTube OAuth token expired/invalid
- `429` - Rate limit exceeded (10 req/min)

## 7. Review Billing Endpoints

### `POST /api/billing/checkout`

**Request body**:
```typescript
{
  priceId?: string; // Optional, defaults to Pro plan
}
```

**Response**:
```typescript
{
  sessionId: string;
  url: string; // Stripe checkout URL
}
```

**Behavior**:
- Create Stripe checkout session
- Set success_url to `${FRONTEND_URL}/app/billing?success=true`
- Set cancel_url to `${FRONTEND_URL}/app/billing?canceled=true`
- Return session URL for redirect

### `POST /api/billing/portal`

**Response**:
```typescript
{
  url: string; // Stripe customer portal URL
}
```

**Behavior**:
- Create Stripe customer portal session
- Set return_url to `${FRONTEND_URL}/app/billing`
- Return portal URL for redirect

## 8. Add Logout Endpoint

### `POST /api/auth/logout`

**Behavior**:
- Clear JWT cookie
- Return `200 OK`

**Response**:
```typescript
{
  success: true,
  message: "Logged out successfully"
}
```

## 9. Environment Variables

Ensure `.env.example` includes:
```bash
# Server
PORT=3000
NODE_ENV=development

# Frontend (for CORS and redirects)
FRONTEND_URL=http://localhost:8080

# Database
DATABASE_URL=postgresql://...

# YouTube OAuth
YOUTUBE_CLIENT_ID=...
YOUTUBE_CLIENT_SECRET=...
YOUTUBE_REDIRECT_URI=http://localhost:3000/api/auth/youtube/callback

# OpenAI
OPENAI_API_KEY=...

# Stripe
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
STRIPE_PRICE_ID_PRO=...

# Auth
JWT_SECRET=...
```

## 10. Cookie Configuration

Ensure JWT cookies are set with these properties:
```typescript
{
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production', // true in prod
  sameSite: 'lax', // Important for OAuth flow
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  path: '/',
}
```

## 11. Error Response Format

Standardize all error responses:
```typescript
{
  error: {
    code: string; // e.g., "QUOTA_EXCEEDED", "UNAUTHORIZED"
    message: string; // User-friendly message
    details?: any; // Optional additional context
  }
}
```

**Common error codes**:
- `UNAUTHORIZED` - Not logged in
- `FORBIDDEN` - Logged in but not allowed
- `QUOTA_EXCEEDED` - Hit free tier limit
- `INVALID_INPUT` - Bad request data
- `YOUTUBE_API_ERROR` - YouTube API failed
- `OPENAI_API_ERROR` - OpenAI API failed
- `STRIPE_ERROR` - Stripe operation failed
- `RATE_LIMIT_EXCEEDED` - Too many requests

## 12. Rate Limiting

Ensure rate limiting is applied:
- `/api/youtube/*` endpoints: 10 requests/minute per user
- `/api/analyze-comments`: Quota-based (not time-based rate limit)
- `/api/generate-replies`: Quota-based
- All other endpoints: Reasonable limits (e.g., 100 req/min)

## Testing Checklist

After making changes, please:

1. **Test CORS**:
   ```bash
   curl -H "Origin: http://localhost:8080" \
        -H "Access-Control-Request-Method: POST" \
        -H "Access-Control-Request-Headers: Content-Type" \
        -X OPTIONS http://localhost:3000/api/auth/me
   ```
   Should return CORS headers.

2. **Test /api/auth/me endpoint**:
   - Without auth cookie → 401
   - With valid auth → User + subscription + quota data

3. **Test quota enforcement**:
   - Free user should hit limits after 2 analyses / 1 reply
   - Pro user should have unlimited access

4. **Test OAuth flow**:
   - Navigate to `/api/auth/youtube`
   - Complete YouTube OAuth
   - Should redirect to `FRONTEND_URL` with auth cookie set

5. **Test Stripe checkout**:
   - POST to `/api/billing/checkout`
   - Should return Stripe checkout URL
   - Complete checkout in Stripe test mode
   - Webhook should upgrade user to Pro

6. **Run existing test suite**:
   ```bash
   npm test
   ```
   All 584 tests should still pass (fix the 6 failing rate limit tests if possible).

## Success Criteria

✅ CORS configured for localhost:8080
✅ `/api/auth/me` endpoint returns user + subscription + quota
✅ All YouTube endpoints return data in expected format
✅ Sentiment analysis enforces free tier quota
✅ Reply generation enforces free tier quota
✅ Stripe checkout/portal endpoints work
✅ Logout endpoint clears cookie
✅ Error responses follow standard format
✅ All existing tests pass
✅ Documentation updated in README

## Notes

- **DO NOT** change the database schema unless absolutely necessary
- **DO NOT** break existing functionality
- **DO** add TypeScript types for all new endpoints
- **DO** add tests for new endpoints
- **DO** update API documentation

Once complete, report back with:
1. List of changes made
2. Any issues encountered
3. Updated API documentation
4. Test results

---

## Additional Context

**Frontend stack**: React 18, Vite, TanStack Query, React Router, Tailwind CSS
**Backend stack**: Fastify, Supabase, Stripe, OpenAI, YouTube API
**Auth flow**: YouTube OAuth → JWT in HttpOnly cookie
**Deployment plan**: Monorepo on Vercel (frontend + backend together)

The frontend is ready to integrate - it just needs these backend endpoints to be available and properly formatted. All UI is built, routing is done, and TanStack Query is configured. Once these backend changes are complete, the integration should be straightforward.
