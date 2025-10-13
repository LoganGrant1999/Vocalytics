# YouTube OAuth Integration - Smoke Test Guide

## Prerequisites

1. **Google Cloud Console Setup**
   - Create OAuth 2.0 credentials (type: **Web application**, NOT Desktop)
   - Add authorized redirect URIs:
     - Local: `http://localhost:3000/api/youtube/callback`
     - Production: `https://your-app.vercel.app/api/youtube/callback`
   - Enable YouTube Data API v3
   - Copy Client ID and Client Secret

2. **Environment Variables**
   ```bash
   GOOGLE_CLIENT_ID=your_client_id
   GOOGLE_CLIENT_SECRET=your_client_secret
   GOOGLE_REDIRECT_URI_LOCAL=http://localhost:3000/api/youtube/callback
   GOOGLE_REDIRECT_URI_PROD=https://your-app.vercel.app/api/youtube/callback
   APP_ENV=local  # or "production"

   # Also ensure these are set:
   SUPABASE_URL=...
   SUPABASE_SERVICE_ROLE_KEY=...
   OPENAI_API_KEY=...  # (optional, for AI features)
   ```

3. **Database Migration**
   ```bash
   # Apply the YouTube OAuth migration
   psql "postgresql://postgres:[PASSWORD]@db.xxx.supabase.co:5432/postgres" \
     -f supabase/migrations/20251013_youtube_oauth_tokens.sql
   ```

---

## Smoke Test Checklist

### 1. Start Local Development Server

```bash
cd /path/to/Vocalytics
pnpm --filter server dev:http
```

Server should start at `http://localhost:3000`

---

### 2. Log In to Get JWT

If you don't have a JWT token yet:

```bash
# Get JWT token using your test account
export JWT=$(SUPABASE_URL=$SUPABASE_URL \
  SUPABASE_ANON=$SUPABASE_ANON \
  TEST_EMAIL=your@email.com \
  TEST_PASS=yourpassword \
  node scripts/get-jwt.js)

echo $JWT
```

Or log in via Supabase Auth UI and extract token from `localStorage['supabase.auth.token']`.

---

### 3. Test OAuth Connect Flow

**Manual Browser Test:**

1. Visit `http://localhost:3000/api/youtube/connect` in your browser
2. You should be redirected to Google consent screen
3. Grant permissions:
   - ✅ View your YouTube account
   - ✅ Manage your YouTube account
4. After consent, you should be redirected back to `/dashboard?yt=connected`
5. Dashboard should show success toast

**Verify tokens in DB:**

```sql
SELECT
  id,
  email,
  youtube_access_token IS NOT NULL as has_access_token,
  youtube_refresh_token IS NOT NULL as has_refresh_token,
  youtube_token_expiry,
  youtube_scope
FROM public.users
WHERE email = 'your@email.com';
```

Expected:
- `has_access_token`: `true`
- `has_refresh_token`: `true`
- `youtube_scope`: Contains `youtube.readonly` and `youtube.force-ssl`

---

### 4. Test Fetch Comments Endpoint

```bash
# Replace VIDEO_ID with a real YouTube video ID (e.g., dQw4w9WgXcQ)
curl -X GET "http://localhost:3000/api/youtube/comments?videoId=VIDEO_ID" \
  -H "Authorization: Bearer $JWT" \
  | jq
```

**Expected Response:**
```json
{
  "items": [
    {
      "id": "UgxKRExxxx...",
      "snippet": {
        "topLevelComment": {
          "snippet": {
            "authorDisplayName": "John Doe",
            "textDisplay": "Great video!",
            "publishedAt": "2024-10-12T10:30:00Z",
            "likeCount": 5
          }
        },
        "totalReplyCount": 0
      }
    }
    // ... more comments
  ],
  "nextPageToken": "...",
  "pageInfo": {
    "totalResults": 50,
    "resultsPerPage": 50
  }
}
```

**Common Issues:**

- **403 "YouTube not connected"**: User needs to complete OAuth flow first
- **401 Unauthorized**: Check JWT token
- **400 "videoId required"**: Missing or invalid video ID
- **404**: Video not found or has comments disabled

---

### 5. Test Post Reply Endpoint

**GOTCHA**: Use the comment **thread ID** (items[].id), not the snippet ID!

```bash
# Get a comment ID from the previous step
PARENT_ID="UgxKRExxxx..."  # Comment thread ID from items[].id

curl -X POST "http://localhost:3000/api/youtube/reply" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "parentId": "'$PARENT_ID'",
    "text": "Thanks for watching! 😊"
  }' | jq
```

**Expected Response:**
```json
{
  "success": true,
  "comment": {
    "id": "UgyABCxxx...",
    "snippet": {
      "textOriginal": "Thanks for watching! 😊",
      "parentId": "UgxKRExxxx...",
      "publishedAt": "2024-10-13T15:45:00Z"
    }
  }
}
```

**Common Issues:**

- **403 "Insufficient Permissions"**: User only granted `youtube.readonly` scope
  - Response will include `needsReconnect: true`
  - User needs to reconnect via `/api/youtube/connect` to grant write permissions
- **403 "YouTube not connected"**: Complete OAuth flow first
- **400 "parentId and text required"**: Missing required fields
- **400 Invalid parent ID**: Wrong comment ID format or non-existent comment

---

### 6. Test Token Auto-Refresh

**Simulate token expiry:**

1. Manually set `youtube_token_expiry` to a past date in DB:
   ```sql
   UPDATE public.users
   SET youtube_token_expiry = NOW() - INTERVAL '1 hour'
   WHERE email = 'your@email.com';
   ```

2. Make a new API request (fetch comments or post reply)

3. Check logs for: `[google.ts] Token expires soon, proactively refreshing`

4. Verify new expiry date in DB:
   ```sql
   SELECT youtube_token_expiry FROM public.users WHERE email = 'your@email.com';
   ```

Expected: Token should be refreshed automatically before the request completes.

---

### 7. Test Rate Limiting

```bash
# Rapid-fire 15 requests (limit is 10/minute)
for i in {1..15}; do
  echo "Request $i"
  curl -X GET "http://localhost:3000/api/youtube/comments?videoId=VIDEO_ID" \
    -H "Authorization: Bearer $JWT" \
    -s -o /dev/null -w "Status: %{http_code}\n"
  sleep 0.1
done
```

Expected:
- First 10 requests: `200 OK`
- Requests 11-15: `429 Too Many Requests`

---

### 8. Test Dashboard UI

1. Open `http://localhost:3000/dashboard` in browser
2. Click "Connect YouTube" button → complete OAuth flow
3. Enter a YouTube video ID or URL (e.g., `https://www.youtube.com/watch?v=dQw4w9WgXcQ`)
4. Click "Fetch Comments"
5. Select comments using checkboxes
6. Click "Analyze Selected" → should show sentiment categories
7. Click "Generate Replies" → should show generated reply text
8. Click "Post to YouTube" → should post reply and show success toast

---

## Important Gotchas

### 1. **OAuth Client Type**
- ❌ "Desktop" OAuth client types **will NOT** deliver refresh tokens to web callbacks
- ✅ Use "Web application" type in Google Cloud Console

### 2. **Refresh Token Retention**
- Google only returns `refresh_token` on **first consent**
- On subsequent authorizations, `refresh_token` may be `null`
- Our code preserves the existing `refresh_token` if not returned
- To force a new refresh token: revoke access in Google Account settings, then reconnect

### 3. **Comment Thread IDs**
- Use `items[].id` (the thread ID) as `parentId` for replies
- Do **NOT** use `items[].snippet.topLevelComment.id` (the snippet ID)
- Thread ID format: `Ugx...` or similar
- Snippet ID format: `UgyABC...` (different structure)

### 4. **Write Permissions**
- If user only granted `youtube.readonly`, posting replies will fail with 403
- API returns `{ needsReconnect: true }` to prompt re-authorization
- User must visit `/api/youtube/connect` again to grant `youtube.force-ssl` scope

### 5. **Serverless Rate Limiting**
- Current rate limiter uses in-memory Map (not shared across serverless instances)
- In production with multiple Vercel instances, consider:
  - Upstash Redis for distributed rate limiting
  - Or rely on YouTube API's own rate limits (10,000 units/day)

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "YouTube not connected" | User needs to complete OAuth flow via `/api/youtube/connect` |
| "Failed to refresh token" | Refresh token expired or revoked → user must reconnect |
| 403 on posting reply | User lacks write scope → reconnect with `needsReconnect` prompt |
| Comments not fetching | Check video ID, verify video exists and has comments enabled |
| OAuth redirect loops | Check `APP_ENV` matches redirect URI, verify callback route is registered |
| Tokens not persisting | Check Supabase migration applied, verify service role key has write access |

---

## Production Deployment

Before deploying to Vercel:

1. **Update Environment Variables**
   ```bash
   vercel env add GOOGLE_CLIENT_ID
   vercel env add GOOGLE_CLIENT_SECRET
   vercel env add GOOGLE_REDIRECT_URI_PROD
   vercel env add APP_ENV production
   ```

2. **Update Google OAuth Redirect URIs**
   - Add production URL to authorized redirects in Google Cloud Console
   - Format: `https://your-app.vercel.app/api/youtube/callback`

3. **Apply Migration to Production DB**
   ```bash
   psql "postgresql://postgres:[PROD_PASSWORD]@db.xxx.supabase.co:5432/postgres" \
     -f supabase/migrations/20251013_youtube_oauth_tokens.sql
   ```

4. **Test Production Flow**
   - Visit `https://your-app.vercel.app/api/youtube/connect`
   - Complete OAuth flow
   - Verify tokens stored in production database
   - Test comment fetching and reply posting

---

## Success Criteria

✅ OAuth flow completes successfully and redirects to `/dashboard?yt=connected`
✅ Tokens (access + refresh) stored in `users` table
✅ Fetch comments returns real YouTube data
✅ Post reply successfully publishes to YouTube
✅ Token auto-refresh works without user intervention
✅ Rate limiting prevents abuse
✅ Dashboard UI allows full comment workflow

---

**Last Updated:** 2024-10-13
**Version:** 1.0.0
