# YouTube OAuth - Smoke Test Checklist

## Prerequisites

1. **Google Cloud Console** - OAuth credentials created (type: Web application)
2. **Environment variables** - All Google OAuth vars set in `.env`
3. **Supabase** - Database migration applied
4. **Dependencies** - `googleapis` and `google-auth-library` installed

---

## Step 1: Install & Build

```bash
cd /path/to/Vocalytics

# Install dependencies
pnpm -w install

# Build all packages
pnpm -w build
```

**Expected:** Build completes without errors.

---

## Step 2: Apply Database Migration

Apply the migration via Supabase Dashboard or `psql`:

```bash
# Option A: Supabase Dashboard SQL Editor
# Copy/paste contents of supabase/migrations/20251013_youtube_oauth_tokens.sql

# Option B: psql
psql "postgresql://postgres:[PASSWORD]@[PROJECT].supabase.co:5432/postgres" \
  -f supabase/migrations/20251013_youtube_oauth_tokens.sql
```

**Expected:** Migration runs successfully. Verify columns exist:

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND column_name LIKE 'youtube_%';
```

Should return: `youtube_access_token`, `youtube_refresh_token`, `youtube_token_expiry`, `youtube_scope`, `youtube_token_type`

---

## Step 3: Start Local Dev Server

```bash
# Start HTTP server in development mode
pnpm --filter server dev:http

# Server should start on http://localhost:3000
```

**Expected:** Server starts without errors. You should see Fastify startup logs.

---

## Step 4: Get JWT Token

Log into your app (Supabase Auth) to obtain a JWT token.

**Option A: Use existing script:**
```bash
export JWT=$(SUPABASE_URL=$SUPABASE_URL \
  SUPABASE_ANON=$SUPABASE_ANON \
  TEST_EMAIL=test@vocalytics.dev \
  TEST_PASS=TestPass123! \
  node scripts/get-jwt.js)

echo "JWT: $JWT"
```

**Option B: Extract from browser:**
- Log in via your web app
- Open DevTools → Application → Local Storage
- Find `supabase.auth.token`
- Copy `access_token` value

---

## Step 5: Test OAuth Connect Flow

**Browser Test:**

1. Visit `http://localhost:3000/api/youtube/connect` in browser
   - **Expected:** Redirects to Google OAuth consent screen

2. Sign in with Google account and grant permissions:
   - ✅ View your YouTube account (`youtube.readonly`)
   - ✅ Manage your YouTube account (`youtube.force-ssl`)

3. After consent, redirected to `/dashboard?yt=connected`
   - **Expected:** Dashboard loads with success message

---

## Step 6: Verify Tokens Stored

Check that tokens were written to `profiles` table:

```sql
SELECT
  id,
  youtube_access_token IS NOT NULL as has_access_token,
  youtube_refresh_token IS NOT NULL as has_refresh_token,
  youtube_token_expiry,
  youtube_scope
FROM public.profiles
WHERE id = '<your-auth-user-id>';
```

**Expected:**
- `has_access_token`: `true`
- `has_refresh_token`: `true`
- `youtube_scope`: Contains `youtube.readonly` and `youtube.force-ssl`
- `youtube_token_expiry`: Timestamp ~1 hour in future

---

## Step 7: Test Fetch Comments

```bash
# Replace VIDEO_ID with a real YouTube video (e.g., dQw4w9WgXcQ)
VIDEO_ID="dQw4w9WgXcQ"

curl -X GET "http://localhost:3000/api/youtube/comments?videoId=$VIDEO_ID" \
  -H "Authorization: Bearer $JWT" \
  | jq '.items[0]'
```

**Expected Response:**
```json
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
```

**Common Issues:**
- `403 "YouTube not connected"` → Complete OAuth flow first
- `400 "videoId required"` → Check query param
- `404` → Video not found or comments disabled

---

## Step 8: Test Post Reply

**IMPORTANT:** Use the comment **thread ID** (`items[].id`), not the snippet ID!

```bash
# Get a thread ID from previous step
PARENT_ID="UgxKRExxxx..."

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
- `403 "Insufficient Permissions"` → Only granted `readonly` scope
  - Response includes `{ needsReconnect: true }`
  - Re-visit `/api/youtube/connect` to grant write permissions
- `400 "parentId and text required"` → Missing body fields
- `400 Invalid parent ID` → Wrong ID format

---

## Step 9: Test needsReconnect Flow

If user only granted `youtube.readonly` (without `youtube.force-ssl`), posting replies will fail with 403 and `{ needsReconnect: true }`.

**To test:**
1. Revoke access in [Google Account Permissions](https://myaccount.google.com/permissions)
2. Re-visit `/api/youtube/connect` but **only** grant "View" permission
3. Try posting a reply → should get `403` with `needsReconnect: true`
4. Dashboard should show "Re-connect to enable posting" button
5. Click it → `/api/youtube/connect` → grant both permissions
6. Try posting again → should succeed

---

## Smoke Test Checklist Summary

- [ ] 1. `pnpm -w install` runs successfully
- [ ] 2. `pnpm -w build` compiles without errors
- [ ] 3. Database migration applies successfully
- [ ] 4. `pnpm --filter server dev:http` starts server
- [ ] 5. Log in to get JWT token
- [ ] 6. Visit `/api/youtube/connect` → Google consent → back to `/dashboard?yt=connected`
- [ ] 7. Verify `profiles.youtube_*` columns populated in DB
- [ ] 8. `GET /api/youtube/comments?videoId=VIDEO_ID` returns items + `nextPageToken`
- [ ] 9. `POST /api/youtube/reply` with valid `parentId` posts successfully
- [ ] 10. If `403` with `needsReconnect: true`, repeat connect flow to grant write scope

---

## Production Deployment

Before deploying to Vercel:

### 1. Add Environment Variables

```bash
vercel env add GOOGLE_CLIENT_ID
# Paste your client ID

vercel env add GOOGLE_CLIENT_SECRET
# Paste your client secret

vercel env add GOOGLE_REDIRECT_URI_PROD
# Value: https://vocalytics-alpha.vercel.app/api/youtube/callback

vercel env add APP_ENV
# Value: production
```

### 2. Update Google Cloud Console

Add production redirect URI to authorized redirects:
- `https://vocalytics-alpha.vercel.app/api/youtube/callback`

### 3. Apply Migration to Production DB

```bash
psql "postgresql://postgres:[PROD_PASSWORD]@[PROD_PROJECT].supabase.co:5432/postgres" \
  -f supabase/migrations/20251013_youtube_oauth_tokens.sql
```

### 4. Deploy

```bash
git add .
git commit -m "Add YouTube OAuth integration"
git push origin main

# Vercel auto-deploys on push
```

### 5. Test Production

- Visit `https://vocalytics-alpha.vercel.app/api/youtube/connect`
- Complete OAuth flow
- Verify tokens in production database
- Test comment fetching and reply posting

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "YouTube not connected" | Complete OAuth flow via `/api/youtube/connect` |
| "Failed to refresh token" | Refresh token expired/revoked → reconnect |
| 403 on posting reply | User lacks write scope → show `needsReconnect` prompt |
| Comments not fetching | Check video ID, verify video exists and has comments enabled |
| OAuth redirect loops | Verify `APP_ENV` matches redirect URI in Google Console |
| Tokens not persisting | Check migration applied, verify `profiles` table has columns |
| Rate limit (429) | Wait 1 minute, or temporarily increase limit in code |

---

## Important Gotchas

### 1. OAuth Client Type
- ❌ "Desktop" OAuth clients **do NOT** deliver refresh tokens to web callbacks
- ✅ Use "Web application" type in Google Cloud Console

### 2. Refresh Token Handling
- Google only returns `refresh_token` on **first consent**
- On subsequent authorizations, `refresh_token` may be `null`
- Our code preserves existing `refresh_token` if not returned
- To force new refresh token: revoke access in Google Account, then reconnect

### 3. Comment Thread IDs
- Use `items[].id` (thread ID) as `parentId` for replies
- Do **NOT** use `items[].snippet.topLevelComment.id` (snippet ID)
- Thread ID format: `Ugx...`

### 4. Write Permissions
- If user only granted `youtube.readonly`, posting fails with 403
- API returns `{ needsReconnect: true }` to prompt re-authorization
- User must visit `/api/youtube/connect` again to grant `youtube.force-ssl`

### 5. Rate Limiting
- Current: 10 requests/minute/user (in-memory, not shared across serverless instances)
- In production with multiple Vercel instances, consider Upstash Redis
- Or rely on YouTube API's own rate limits (10,000 units/day)

---

**Last Updated:** 2024-10-13
**Version:** 1.0.0
