# Web QA Manual Test Script

**Estimated time:** 10 minutes
**Purpose:** Validate the golden path through the Vocalytics web app

## Prerequisites

- Backend server running on `http://localhost:3000`
- Web dev server running on `http://localhost:5173`
- Valid YouTube account for OAuth testing
- Stripe test keys configured (if testing checkout)

## Test Steps

### 1. Landing Page & OAuth Flow

**Action:**
1. Navigate to `http://localhost:5173/`
2. Click "Connect YouTube Account" button
3. Complete Google OAuth consent screen
4. Verify redirect back to `/app`

**Expected:**
- Smooth OAuth flow with no errors
- Successful redirect to `/app` dashboard
- User email/avatar visible in UI

**Screenshot placeholder:** `01-landing-oauth.png`

---

### 2. Tier & Usage Meters

**Action:**
1. On `/app` dashboard, locate tier badge and usage meters
2. Verify display shows current tier (Free/Pro)
3. Check usage metrics:
   - Analyze quota (e.g., "2/2 this week")
   - Reply quota (e.g., "1/1 today")

**Expected:**
- Tier badge displays correctly
- Usage meters show accurate counts
- Progress bars render properly
- Limits are clear (e.g., "2 of 2 used")

**Screenshot placeholder:** `02-dashboard-usage.png`

---

### 3. Video Analysis - Quick Path

**Action:**
1. Click "Analyze my latest upload" button on dashboard
2. Wait for analysis to complete
3. Verify redirect to `/analyze/:videoId`

**Expected:**
- Loading state appears during analysis
- Successful redirect with videoId in URL
- Analysis results display on next page

**Screenshot placeholder:** `03-analyze-quick.png`

---

### 3a. Video Analysis - Manual Path (Alternative)

**Action:**
1. Navigate to `/videos` page
2. Paste a YouTube video ID (e.g., `dQw4w9WgXcQ`)
3. Click "Analyze" button
4. Verify redirect to `/analyze/:videoId`

**Expected:**
- Input field accepts video ID
- Validation works (rejects invalid IDs)
- Analysis initiates successfully

**Screenshot placeholder:** `03a-videos-manual.png`

---

### 4. Analysis Results View

**Action:**
1. On `/analyze/:videoId` page, review:
   - Video title and metadata
   - Comment sentiment distribution (positive/neutral/negative bars)
   - Summary statistics (total comments, sentiment breakdown)
   - List of analyzed comments

**Expected:**
- Video details render correctly
- Sentiment bars show percentage distribution
- Summary matches comment list
- All data is readable and well-formatted

**Screenshot placeholder:** `04-analysis-results.png`

---

### 5. Generate & Copy Replies

**Action:**
1. Select 2-3 comments from the list
2. Click "Generate Reply" button for each
3. Wait for AI-generated reply to appear
4. Click "Copy" button on generated replies
5. Verify clipboard content

**Expected:**
- Reply generation completes within 3-5 seconds
- Generated replies are contextual and appropriate
- Copy button works (clipboard contains reply text)
- Visual feedback on copy (e.g., checkmark or toast)

**Screenshot placeholder:** `05-generate-replies.png`

---

### 6. Quota Limit & Paywall

**Action:**
1. Continue generating replies until quota is exhausted
2. Observe paywall dialog/banner appearance
3. Note error message and upgrade CTA

**Expected:**
- Clear error message: "Daily/Weekly limit reached"
- Paywall UI appears (modal or banner)
- "Upgrade to Pro" button is prominent
- User cannot generate more replies

**Screenshot placeholder:** `06-paywall-dialog.png`

---

### 7. Stripe Checkout Flow

**Action:**
1. Click "Upgrade to Pro" button
2. Complete Stripe Checkout (use test card: `4242 4242 4242 4242`)
3. Verify redirect back to app
4. Check tier badge now shows "Pro"
5. Confirm usage limits removed or increased

**Expected:**
- Stripe Checkout opens in new tab or modal
- Payment processes successfully
- Redirect returns to app dashboard
- Tier updates to "Pro" immediately
- Usage meters reflect new limits (or "unlimited")

**Screenshot placeholder:** `07-stripe-upgrade.png`

---

### 8. Debug Drawer & Request IDs

**Action:**
1. Open debug drawer (click debug icon or use keyboard shortcut)
2. Review last API requests list
3. Verify each request shows:
   - Timestamp
   - Request ID (UUID format)
   - Endpoint path
   - Status code

**Expected:**
- Debug drawer opens smoothly
- Recent requests are listed (5-10 most recent)
- Request IDs are valid UUIDs
- Status codes are accurate (200, 429, etc.)

**Screenshot placeholder:** `08-debug-drawer.png`

---

### 9. Rate Limit Simulation (429)

**Action:**
1. Trigger rate limit (mock or by rapid requests)
2. Observe 429 error response
3. Verify countdown timer UI appears
4. Wait for countdown to complete

**Expected:**
- Error toast/banner shows: "Too many requests"
- Countdown timer displays time remaining (e.g., "Try again in 0:45")
- UI disables actions during countdown
- Actions re-enable after countdown expires

**Screenshot placeholder:** `09-rate-limit-countdown.png`

---

### 10. Posting Toggle (Scope Gating)

**Action:**
1. Stop dev server
2. Add `VITE_ENABLE_POSTING=true` to `.env`
3. Restart dev server
4. Return to `/analyze/:videoId`
5. Locate "Send Reply" button on generated replies
6. Verify button state:
   - Without `youtube.force-ssl` scope: disabled with tooltip
   - With scope: enabled and functional

**Expected:**
- "Send Reply" button appears when `VITE_ENABLE_POSTING=true`
- Button is disabled by default (scope not granted)
- Hover tooltip explains: "Requires additional YouTube permissions"
- If scope is granted (re-auth), button becomes enabled

**Screenshot placeholder:** `10-posting-toggle.png`

---

## Pass Criteria

- [ ] All 10 steps complete without critical errors
- [ ] OAuth flow works end-to-end
- [ ] Usage meters update correctly
- [ ] Analysis and reply generation succeed
- [ ] Paywall appears at correct limit
- [ ] Stripe checkout completes and tier updates
- [ ] Debug drawer shows accurate request history
- [ ] Rate limit countdown functions properly
- [ ] Posting feature gates correctly on scope

## Notes

- Replace screenshot placeholders with actual screenshots during QA
- Document any deviations or bugs in GitHub issues
- Test on both Chrome and Safari for cross-browser compatibility
- Verify mobile responsiveness (optional, but recommended)

---

**Last updated:** 2025-10-13
**Maintained by:** Vocalytics Team
