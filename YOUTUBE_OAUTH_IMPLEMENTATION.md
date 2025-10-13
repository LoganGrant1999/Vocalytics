# YouTube OAuth Implementation Summary

## ✅ Implementation Complete

All YouTube OAuth integration components have been implemented and are ready for testing.

---

## Files Created/Modified

### 1. **Dependencies** ✅
- Added `googleapis@^162.0.0`
- Added `google-auth-library@^10.4.0`

### 2. **Database Migration** ✅
- **File:** `supabase/migrations/20251013_youtube_oauth_tokens.sql`
- **Columns Added to `users` table:**
  - `youtube_access_token` (text)
  - `youtube_refresh_token` (text)
  - `youtube_token_expiry` (timestamptz)
  - `youtube_scope` (text)
  - `youtube_token_type` (text)
- **RLS:** Existing policies allow users to update their own tokens

**⚠️ ACTION REQUIRED:** Apply migration to your database:
```bash
psql "postgresql://postgres:[PASSWORD]@[YOUR_DB].supabase.co:5432/postgres" \
  -f supabase/migrations/20251013_youtube_oauth_tokens.sql
```

### 3. **Google OAuth Helper** ✅
- **File:** `packages/server/src/lib/google.ts`
- **Functions:**
  - `getAuthedYouTubeForUser(userId)` - Returns authenticated YouTube API client
  - `createOAuth2Client()` - Creates OAuth2 client for auth flow
  - `getRedirectUri()` - Returns correct redirect URI based on APP_ENV
- **Features:**
  - Automatic token refresh when expiring within 60 seconds
  - Token persistence to database on refresh
  - Preserves existing refresh_token if not returned by Google

### 4. **YouTube API Routes** ✅
- **File:** `packages/server/src/http/routes/youtube.ts`
- **Routes:**
  - `GET /api/youtube/connect` - Initiates OAuth flow (protected)
  - `GET /api/youtube/callback` - Handles OAuth callback
  - `GET /api/youtube/comments` - Fetches video comments (protected)
  - `POST /api/youtube/reply` - Posts reply to comment (protected)
- **Features:**
  - Simple in-memory rate limiter (10 req/min/user)
  - Handles insufficient permissions gracefully
  - Returns `needsReconnect: true` when write scope missing

### 5. **Server Integration** ✅
- **File:** `packages/server/src/http/index.ts`
- **Changes:** Imported and registered `youtubeRoutes` in protected `/api` scope

### 6. **Environment Variables** ✅
- **File:** `packages/server/.env.example`
- **Added:**
  ```bash
  GOOGLE_CLIENT_ID=
  GOOGLE_CLIENT_SECRET=
  GOOGLE_REDIRECT_URI_LOCAL=http://localhost:3000/api/youtube/callback
  GOOGLE_REDIRECT_URI_PROD=https://your-app.vercel.app/api/youtube/callback
  APP_ENV=local  # or "production"
  ```

### 7. **Dashboard UI** ✅
- **File:** `packages/web/public/dashboard.html`
- **Features:**
  - YouTube connection status indicator
  - Video URL/ID input with automatic parsing
  - Fetch comments from YouTube
  - Select comments with checkboxes
  - Analyze selected comments (sentiment, toxicity, category)
  - Generate AI replies for selected comments
  - Post replies directly to YouTube
  - Toast notifications for success/error
  - Handles `needsReconnect` flow for write permissions

### 8. **Documentation** ✅
- **File:** `docs/youtube-oauth.md`
- **Sections:**
  - Prerequisites and setup
  - Smoke test checklist (8 tests)
  - Important gotchas (5 documented)
  - Troubleshooting guide
  - Production deployment steps

---

## Quick Start

### 1. Apply Database Migration

```bash
cd /Users/logangrant/Desktop/Vocalytics

# Update with your actual Supabase connection string
psql "postgresql://postgres:[YOUR_PASSWORD]@[YOUR_PROJECT].supabase.co:5432/postgres" \
  -f supabase/migrations/20251013_youtube_oauth_tokens.sql
```

### 2. Update Environment Variables

Your `.env` already has the Google OAuth credentials. Ensure these are also added to Vercel:

```bash
# For Vercel production
vercel env add GOOGLE_CLIENT_ID
vercel env add GOOGLE_CLIENT_SECRET
vercel env add GOOGLE_REDIRECT_URI_PROD
vercel env add APP_ENV production

# Don't forget to update the redirect URI in Google Cloud Console:
# https://vocalytics-alpha.vercel.app/api/youtube/callback
```

### 3. Start Development Server

```bash
pnpm --filter server dev:http
```

Server runs at `http://localhost:3000`

### 4. Test OAuth Flow

1. Visit `http://localhost:3000/dashboard` in browser
2. Click "Connect YouTube" button
3. Grant permissions on Google consent screen
4. Get redirected back to dashboard with success message
5. Enter a YouTube video ID (e.g., `dQw4w9WgXcQ`)
6. Click "Fetch Comments"
7. Select comments, analyze them, generate replies
8. Click "Post to YouTube" to publish

---

## API Endpoints

### OAuth Flow

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/youtube/connect` | GET | Required | Redirects to Google OAuth consent screen |
| `/api/youtube/callback` | GET | No | Handles OAuth callback, stores tokens |

### YouTube Operations

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/youtube/comments` | GET | Required | Fetches comments from a video |
| `/api/youtube/reply` | POST | Required | Posts a reply to a comment |

**Query Params for `/comments`:**
- `videoId` (required): YouTube video ID
- `pageToken` (optional): Pagination token
- `includeReplies` (optional): Include reply threads
- `order` (optional): `time` or `relevance`

**Body for `/reply`:**
```json
{
  "parentId": "UgxKRExxxx...",  // Comment thread ID
  "text": "Your reply text (max 220 chars)"
}
```

---

## Important Gotchas

### 1. OAuth Client Type
- ✅ **MUST use "Web application"** type in Google Cloud Console
- ❌ "Desktop" type will NOT deliver refresh tokens

### 2. Refresh Token Handling
- Google only returns `refresh_token` on **first consent**
- Our code preserves existing `refresh_token` if not returned
- To get a new refresh token: revoke access in Google Account, then reconnect

### 3. Comment Thread IDs
- Use `items[].id` (thread ID) as `parentId` for replies
- Do **NOT** use `items[].snippet.topLevelComment.id`

### 4. Write Permissions
- If user only granted `youtube.readonly`, posting fails with 403
- API returns `{ needsReconnect: true }`
- User must reconnect via `/api/youtube/connect` to grant `youtube.force-ssl`

### 5. Rate Limiting
- Current implementation: 10 requests/minute/user (in-memory)
- Not shared across Vercel serverless instances
- Consider Upstash Redis for production

---

## Testing Checklist

Use the smoke test guide in `docs/youtube-oauth.md`:

- [ ] OAuth flow completes and redirects to `/dashboard?yt=connected`
- [ ] Tokens stored in `users` table (access + refresh)
- [ ] Fetch comments returns real YouTube data
- [ ] Post reply publishes to YouTube successfully
- [ ] Token auto-refresh works (test by backdating expiry)
- [ ] Rate limiting triggers at 11th request
- [ ] Dashboard UI allows full workflow
- [ ] Insufficient permissions prompt reconnect

---

## Production Deployment

### 1. Google Cloud Console
- Add production redirect URI: `https://vocalytics-alpha.vercel.app/api/youtube/callback`
- Verify authorized domains include your Vercel domain

### 2. Vercel Environment Variables
```bash
GOOGLE_CLIENT_ID=[your_client_id]
GOOGLE_CLIENT_SECRET=[your_client_secret]
GOOGLE_REDIRECT_URI_PROD=https://vocalytics-alpha.vercel.app/api/youtube/callback
APP_ENV=production
```

### 3. Database Migration
```bash
# Apply to production database
psql "postgresql://postgres:[PROD_PASSWORD]@[PROD_DB].supabase.co:5432/postgres" \
  -f supabase/migrations/20251013_youtube_oauth_tokens.sql
```

### 4. Verify Production
- Visit `https://vocalytics-alpha.vercel.app/api/youtube/connect`
- Complete OAuth flow
- Test comment fetching and reply posting

---

## Architecture Overview

```
User Browser
    ↓
  Dashboard UI (dashboard.html)
    ↓
  POST /api/youtube/connect (protected)
    ↓
  Google OAuth Consent Screen
    ↓
  GET /api/youtube/callback
    ↓
  Store tokens in Supabase users table
    ↓
  Redirect to /dashboard?yt=connected
    ↓
  User fetches comments / posts replies
    ↓
  lib/google.ts auto-refreshes tokens as needed
    ↓
  YouTube Data API v3
```

**Token Flow:**
1. User initiates OAuth → gets `access_token` + `refresh_token`
2. Tokens stored in DB with expiry timestamp
3. On API call, `getAuthedYouTubeForUser()` checks expiry
4. If expiring within 60s → proactively refreshes
5. New tokens auto-persisted via `oauth2.on('tokens')` event
6. YouTube API client uses fresh tokens

---

## Next Steps

1. **Apply database migration** (see Quick Start #1)
2. **Test OAuth flow locally** (see Quick Start #4)
3. **Deploy to Vercel** with production env vars
4. **Test in production** with real YouTube videos
5. **(Optional) Add Upstash Redis** for distributed rate limiting
6. **(Optional) Add YouTube connection status** to `/api/me/subscription` endpoint

---

## File Manifest

```
Vocalytics/
├── packages/
│   ├── server/
│   │   ├── src/
│   │   │   ├── lib/
│   │   │   │   └── google.ts                    ✅ NEW
│   │   │   └── http/
│   │   │       ├── index.ts                     ✅ MODIFIED
│   │   │       └── routes/
│   │   │           └── youtube.ts               ✅ NEW
│   │   └── .env.example                         ✅ MODIFIED
│   └── web/
│       └── public/
│           └── dashboard.html                   ✅ NEW
├── supabase/
│   └── migrations/
│       └── 20251013_youtube_oauth_tokens.sql    ✅ NEW
├── docs/
│   └── youtube-oauth.md                         ✅ NEW
└── YOUTUBE_OAUTH_IMPLEMENTATION.md              ✅ NEW (this file)
```

---

## Support

**Documentation:**
- `docs/youtube-oauth.md` - Comprehensive smoke test guide
- `packages/server/src/lib/google.ts` - Token management (inline comments)
- `packages/server/src/http/routes/youtube.ts` - API routes (inline comments)

**Common Issues:** See troubleshooting table in `docs/youtube-oauth.md`

---

**Implementation Date:** 2024-10-13
**Status:** ✅ Ready for testing
**Next Action:** Apply database migration and test OAuth flow
