# Next Steps: Frontend-Backend Integration

## What I've Done ✅

Your frontend repo is now prepared for backend integration:

1. **Created Integration Documentation**:
   - `INTEGRATION_OVERVIEW.md` - High-level architecture and data flow (READ THIS FIRST)
   - `INTEGRATION_GUIDE.md` - Detailed technical implementation guide
   - `BACKEND_MIGRATION_PROMPT.md` - Ready-to-use prompt for backend prep
   - Updated `README.md` - Added integration instructions

2. **Created Environment Template**:
   - `.env.example` - Environment variable template
   - Documents required `VITE_API_URL` configuration

3. **Documented All Integration Points**:
   - Auth flow (YouTube OAuth + JWT)
   - YouTube data fetching (videos, comments)
   - Sentiment analysis (with quota enforcement)
   - Reply generation (with quota enforcement)
   - Billing (Stripe checkout + portal)

---

## Your Next Steps 🚀

### Step 1: Review Integration Overview (5 minutes)
```bash
cd /Users/logangrant/Desktop/reply-sculptor
cat INTEGRATION_OVERVIEW.md
```

**Key takeaways**:
- Understand the architecture (React → Fastify → Supabase)
- Review API endpoints your backend needs to expose
- Understand auth flow (OAuth + JWT cookies)
- See data flow examples

### Step 2: Prepare Backend (1-2 hours)

1. Navigate to your backend repo:
   ```bash
   cd ~/path/to/vocalytics-backend
   ```

2. Open Claude Code in that repo

3. Copy the entire contents of `BACKEND_MIGRATION_PROMPT.md` from this repo

4. Paste it to Claude in your backend repo

5. Claude will:
   - Add CORS configuration
   - Create `/api/auth/me` endpoint
   - Standardize error responses
   - Verify all endpoints match expected format
   - Run tests to ensure nothing breaks

6. Verify changes:
   ```bash
   npm test  # Should see 584 tests pass
   npm run dev  # Start backend on port 3000
   ```

### Step 3: Frontend Integration (4-6 hours)

Once backend is ready, return to this repo and implement:

#### 3.1 Create API Client Layer
```bash
src/lib/api.ts              # Fetch wrapper with credentials
src/lib/queryClient.ts      # TanStack Query config
```

#### 3.2 Create Auth System
```bash
src/hooks/useAuth.tsx       # Auth context + hooks
src/components/ProtectedRoute.tsx  # Auth guard
```

#### 3.3 Create API Hooks
```bash
src/hooks/useYouTube.ts     # YouTube data queries
src/hooks/useAnalysis.ts    # Sentiment analysis mutations
src/hooks/useReplies.ts     # Reply generation mutations
src/hooks/useBilling.ts     # Stripe billing mutations
```

#### 3.4 Replace Mock Data
Update these pages to use real API data:
- `src/pages/DashboardPage.tsx`
- `src/pages/VideosPage.tsx`
- `src/pages/VideoDetailPage.tsx`
- `src/pages/CommentsPage.tsx`
- `src/pages/BillingPage.tsx`
- `src/pages/VoiceProfilePage.tsx`

#### 3.5 Update Auth Pages
- `src/pages/SignInPage.tsx` - Redirect to backend OAuth
- `src/pages/RegisterPage.tsx` - Same as sign in (OAuth only)
- `src/App.tsx` - Wrap authenticated routes with `ProtectedRoute`

### Step 4: Test Integration (1 hour)

```bash
# Terminal 1: Backend
cd ~/path/to/vocalytics-backend
npm run dev

# Terminal 2: Frontend
cd ~/Desktop/reply-sculptor
cp .env.example .env
# Edit .env: VITE_API_URL=http://localhost:3000
npm run dev

# Browser
open http://localhost:8080
```

**Test checklist**:
- [ ] Sign in with YouTube OAuth
- [ ] View videos list
- [ ] Analyze comments (free tier: 2/week limit)
- [ ] Generate replies (free tier: 1/day limit)
- [ ] Upgrade to Pro (Stripe test mode)
- [ ] Generate unlimited replies (Pro)
- [ ] Manage billing via Stripe portal
- [ ] Log out

### Step 5: Deploy (30 minutes)

**Option A: Separate Deployments**
```bash
# Backend: Vercel/Railway
# Frontend: Vercel/Netlify
# Remember to update FRONTEND_URL and VITE_API_URL env vars
```

**Option B: Monorepo (Recommended)**
Move frontend into backend repo:
```bash
# In backend repo
mkdir client
cp -r ~/Desktop/reply-sculptor/* client/
# Update vercel.json to serve both
```

---

## Time Estimates

| Phase | Time | Difficulty |
|-------|------|------------|
| Backend Prep | 1-2 hours | Easy (Claude does it) |
| Frontend API Layer | 2-3 hours | Medium |
| Replace Mock Data | 2-3 hours | Easy |
| Testing & Polish | 1-2 hours | Medium |
| **Total** | **6-10 hours** | **Medium** |

---

## Integration Complexity: MEDIUM 🟡

**Why Medium (not Hard)?**
- ✅ Backend is already production-ready (7.5/10)
- ✅ Frontend UI is complete
- ✅ TanStack Query already installed
- ✅ Clear API contract defined
- ✅ Detailed migration docs provided

**Why Medium (not Easy)?**
- ⚠️ OAuth flow can be tricky (CORS, cookies)
- ⚠️ Quota enforcement logic on frontend
- ⚠️ Error handling across multiple endpoints
- ⚠️ Testing paywall flows

---

## Key Files to Review

### 1. Start Here 📖
`INTEGRATION_OVERVIEW.md` - Big picture understanding

### 2. Backend Preparation 🔧
`BACKEND_MIGRATION_PROMPT.md` - Copy/paste to Claude in backend repo

### 3. Implementation Details 📝
`INTEGRATION_GUIDE.md` - Step-by-step technical guide

### 4. API Reference 🔌
See API endpoints section in `INTEGRATION_OVERVIEW.md`

---

## Common Issues & Solutions

### Issue: "Cookies not working in development"
**Solution**:
- Ensure `credentials: 'include'` in fetch
- Ensure `sameSite: 'lax'` in backend cookies
- Use `http://localhost:8080` (not `127.0.0.1`)

### Issue: "CORS error"
**Solution**:
- Backend CORS origin must be exact: `http://localhost:8080`
- Backend must include `credentials: true` in CORS config

### Issue: "OAuth redirect loop"
**Solution**:
- Verify `JWT_SECRET` is set in backend `.env`
- Check cookie is being set (DevTools → Application → Cookies)

### Issue: "Quota not updating"
**Solution**:
- Backend uses atomic operations (already implemented)
- Check `/api/auth/me` returns correct quota values

---

## Success Criteria ✅

You'll know integration is successful when:

1. **Auth Works**:
   - Click "Sign In" → Redirects to YouTube → Redirects back authenticated
   - Header shows real YouTube channel name
   - Logout clears cookie

2. **Data Loads**:
   - Videos page shows real YouTube videos
   - Comments page shows real comments
   - Dashboard shows real quota usage

3. **AI Works**:
   - Analyze comments → Shows sentiment, topics, badges
   - Generate replies → Shows drafted replies (max 220 chars)
   - Post reply → Appears on YouTube

4. **Paywall Works**:
   - Free user hits 2 analyses/week limit → Shows upgrade banner
   - Free user hits 1 reply/day limit → Shows upgrade banner
   - Upgrade to Pro → Removes limits

5. **Billing Works**:
   - Click "Upgrade" → Stripe checkout opens
   - Complete payment → Subscription activates
   - Click "Manage Billing" → Stripe portal opens

---

## Get Help 🆘

If you get stuck during integration:

1. **Check browser DevTools**:
   - Network tab: See API requests/responses
   - Console: See errors
   - Application tab: Check cookies

2. **Check backend logs**:
   - Look for CORS errors
   - Look for auth errors
   - Look for API errors

3. **Review integration docs**:
   - `INTEGRATION_OVERVIEW.md` for architecture
   - `INTEGRATION_GUIDE.md` for implementation
   - Backend assessment doc for known issues

4. **Test endpoints manually**:
   ```bash
   # Test CORS
   curl -H "Origin: http://localhost:8080" \
        -H "Access-Control-Request-Method: POST" \
        -X OPTIONS http://localhost:3000/api/auth/me

   # Test auth endpoint
   curl -b "token=YOUR_JWT" \
        http://localhost:3000/api/auth/me
   ```

---

## What You'll Have After Integration ✨

A **fully functional SaaS application** with:

- ✅ **YouTube OAuth** - Real authentication
- ✅ **Sentiment Analysis** - AI-powered insights
- ✅ **Reply Generation** - GPT-4 drafts
- ✅ **Stripe Billing** - Real monetization
- ✅ **Quota Enforcement** - Free/Pro tiers working
- ✅ **Professional UI** - Complete design system
- ✅ **Rate Limiting** - Abuse prevention
- ✅ **Security** - HttpOnly cookies, CSRF protection

**Backend Quality**: 7.5/10 (Production-ready with minor fixes)
**Frontend Quality**: 8/10 (Professional UI, needs API integration)
**Combined App**: 8/10 (Solid B+ SaaS product)

---

## Ready to Start? 🚀

1. **Read**: `INTEGRATION_OVERVIEW.md` (5 min)
2. **Prepare Backend**: Use `BACKEND_MIGRATION_PROMPT.md` (1-2 hours)
3. **Integrate Frontend**: Follow `INTEGRATION_GUIDE.md` (4-6 hours)
4. **Test**: Full user flows (1 hour)
5. **Deploy**: Ship it! (30 min)

**Total time**: 6-10 hours spread over 1-2 days.

Good luck! 🎉
