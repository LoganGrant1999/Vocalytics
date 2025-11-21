# Vocalytics Data Flow Analysis

**Complete trace of data movement from UI to database and back**

---

## Table of Contents

1. [Initial App Load Flow](#1-initial-app-load-flow)
2. [Video Analysis Flow (Main Action)](#2-video-analysis-flow-main-action)
3. [User Authentication Flow](#3-user-authentication-flow)
4. [Payment Processing Flow](#4-payment-processing-flow)
5. [Database Schema & Storage](#5-database-schema--storage)

---

## 1. Initial App Load Flow

**When a user opens the app at `http://localhost:5173` or production URL**

### Step-by-Step Trace

#### 1.1 Browser Loads HTML
```
Browser → /index.html
```
The browser requests the root HTML file served by Vite (dev) or Vercel (prod).

#### 1.2 JavaScript Bootstrapping
**File:** `packages/web/src/main.tsx`

```typescript
// Line 6-10
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

**What happens:**
- React creates a root DOM node
- Renders the `<App />` component inside React.StrictMode

---

#### 1.3 App Component Initialization
**File:** `packages/web/src/App.tsx`

```typescript
// Lines 156-168
const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);
```

**What happens (in order):**
1. **QueryClientProvider** wraps everything for React Query (data fetching/caching)
2. **TooltipProvider** provides tooltip context
3. **Toast components** initialize (for notifications)
4. **BrowserRouter** enables client-side routing
5. **AuthProvider** wraps the routes with authentication context
6. **AppRoutes** component renders (which checks auth status)

---

#### 1.4 AuthProvider Fetches Current User
**File:** `packages/web/src/hooks/useAuth.tsx`

```typescript
// Lines 49-65: useEffect on mount
useEffect(() => {
  const fetchUser = async () => {
    try {
      const data = await api.getCurrentUser();  // ← API CALL HERE
      setUser(data.user);
      setQuota(data.quota || null);
    } catch (error) {
      console.log('Not authenticated');
      setUser(null);
      setQuota(null);
    } finally {
      setIsLoading(false);
    }
  };

  fetchUser();
}, []);
```

**What happens:**
- Immediately on load, `useAuth` calls `api.getCurrentUser()`
- This sends an HTTP request to the backend

---

#### 1.5 Frontend API Call
**File:** `packages/web/src/lib/api.ts`

```typescript
// Lines 107-127
async getCurrentUser() {
  return this.request<{
    user: {
      id: string;
      email: string;
      name: string;
      avatar?: string;
      tier: 'free' | 'pro';
      emailVerified: boolean;
      hasYouTubeConnected: boolean;
      createdAt: string;
    };
    quota?: { ... };
  }>('/auth/me');
}
```

**HTTP Request:**
```
GET /api/auth/me
Headers:
  - Cookie: vocalytics_token=<JWT>
  - Content-Type: application/json
Credentials: include (sends HTTP-only cookies)
```

---

#### 1.6 Backend Receives Request
**File:** `packages/server/src/http/index.ts`

The Fastify server receives the request and runs through middleware:

1. **CORS Plugin** - Validates origin
2. **Cookie Parser** - Extracts cookies from headers
3. **Auth Plugin** (`packages/server/src/http/auth.ts`) - Validates JWT

**File:** `packages/server/src/http/auth.ts` (lines 29-60)

```typescript
fastify.addHook('preHandler', async (request, reply) => {
  const cookieToken = request.cookies?.vocalytics_token;
  const token = cookieToken || bearerToken;

  if (!token) {
    await reply.code(401).send({ error: 'Unauthorized' });
    return;
  }

  const claims = await verifyToken(token);  // Decode JWT
  if (!claims) {
    await reply.code(401).send({ error: 'Unauthorized' });
    return;
  }

  request.auth = {
    userId: claims.userId,
    email: claims.email,
    tier: claims.tier,
  };
});
```

**What happens:**
- Extracts JWT from `vocalytics_token` cookie
- Calls `verifyToken()` to decode and validate JWT
- Extracts `userId`, `email`, `tier` from JWT payload
- Attaches to `request.auth` for route handlers to use

---

#### 1.7 Route Handler Executes
**File:** `packages/server/src/http/routes/auth.ts`

```typescript
// Lines 239-287
fastify.get('/auth/me', async (request: any, reply) => {
  const userId = request.auth?.userId || request.auth?.userDbId;

  if (!userId) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }

  // Fetch user from database
  const { data: user } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (!user) {
    return reply.status(404).send({ error: 'User not found' });
  }

  // Fetch usage stats
  let quota = null;
  try {
    const { getUsageStats } = await import('../../db/rateLimits.js');
    quota = await getUsageStats(userId);
  } catch (error) {
    console.warn('Failed to fetch quota:', error);
  }

  return reply.send({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar_url,
      tier: user.tier,
      emailVerified: user.email_verified,
      hasYouTubeConnected: !!user.youtube_access_token,
      createdAt: user.created_at,
    },
    quota: quota || undefined,
  });
});
```

**Database Queries:**
1. `SELECT * FROM profiles WHERE id = '<userId>'`
2. `SELECT * FROM rate_limit_buckets WHERE user_id = '<userId>'` (for quota)

---

#### 1.8 Response Returns to Frontend
**HTTP Response:**
```json
{
  "user": {
    "id": "abc-123-def",
    "email": "user@example.com",
    "name": "John Doe",
    "tier": "free",
    "emailVerified": true,
    "hasYouTubeConnected": true,
    "createdAt": "2025-01-15T12:00:00Z"
  },
  "quota": {
    "analyze_weekly_count": 1,
    "analyze_weekly_limit": 2,
    "reply_daily_count": 0,
    "reply_daily_limit": 1,
    "period_start": "2025-01-13T00:00:00Z"
  }
}
```

---

#### 1.9 Frontend Updates State
**File:** `packages/web/src/hooks/useAuth.tsx`

```typescript
// Lines 53-54
setUser(data.user);
setQuota(data.quota || null);
```

**State stored in React Context:**
- `user` object with all profile data
- `quota` object with usage limits

---

#### 1.10 Routing Decision
**File:** `packages/web/src/App.tsx`

```typescript
// Lines 45-57
function AppRoutes() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingSpinner />;  // Shows spinner
  }

  const plan = user?.tier || 'free';
  const channelName = user?.name || 'Your Channel';
  const hasYouTubeConnected = user?.hasYouTubeConnected || false;

  return <Routes>...</Routes>;
}
```

**Routing logic:**
- If `isLoading = true` → Show loading spinner
- If `user = null` → Redirect to `/signin` (via ProtectedRoute)
- If `user` exists → Render the requested route
- All `/app/*` routes are wrapped in `<ProtectedRoute>`

**File:** `packages/web/src/App.tsx` (lines 24-43)

```typescript
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/signin" replace />;
  }

  return <>{children}</>;
}
```

---

### Summary: Initial App Load

```
User opens browser
  → Browser loads index.html
    → React initializes
      → App.tsx wraps with AuthProvider
        → useAuth calls api.getCurrentUser()
          → GET /api/auth/me (with JWT cookie)
            → Backend validates JWT
              → Backend queries profiles table
                → Backend queries rate_limit_buckets table
                  → Returns user + quota data
                    → Frontend sets user state
                      → Routes decide where to navigate
```

**Total time:** ~200-500ms
**Network requests:** 1 (GET /api/auth/me)
**Database queries:** 2 (profiles, rate_limit_buckets)

---

## 2. Video Analysis Flow (Main Action)

**When a user clicks "Analyze" on a video in `/app/videos`**

This is the **primary feature** of Vocalytics: analyzing YouTube video comments for sentiment.

### Step-by-Step Trace

#### 2.1 User Navigates to Videos Page
**URL:** `/app/videos`
**File:** `packages/web/src/pages/VideosPage.tsx`

```typescript
// Lines 19-46
useEffect(() => {
  const fetchData = async () => {
    setIsLoading(true);

    // Fetch videos and analyses in parallel
    const [videosData, analysesData] = await Promise.all([
      api.getVideos({ mine: true, limit: 20 }),
      api.listAnalyses().catch(() => []),
    ]);

    setVideos(videosData);
    setAnalyses(analysesData);
    setIsLoading(false);
  };

  fetchData();
}, []);
```

**Two API calls happen on page load:**
1. `GET /api/youtube/videos?mine=true&limit=20` - Fetch user's YouTube videos
2. `GET /api/analysis` - Fetch existing analyses

---

#### 2.2 User Clicks Video to Analyze
**Component:** `VideoListItem` (rendered from VideosPage)
**User Action:** Clicks on a video card

**What happens:**
- User is navigated to `/app/video/:videoId`
- VideoDetailPage component loads

---

#### 2.3 VideoDetailPage Loads
**File:** `packages/web/src/pages/VideoDetailPage.tsx`

On load, the page:
1. Fetches video metadata
2. **Attempts to load existing analysis**
3. If no analysis exists, shows "Analyze" button

**User clicks "Analyze" button** → Triggers this function:

```typescript
const handleAnalyze = async () => {
  setIsAnalyzing(true);
  try {
    const result = await api.analyzeVideo(videoId);
    setAnalysis(result);
    // Show success message
  } catch (error) {
    // Show error
  } finally {
    setIsAnalyzing(false);
  }
};
```

---

#### 2.4 Frontend API Call: analyzeVideo()
**File:** `packages/web/src/lib/api.ts`

```typescript
// Lines 283-321
async analyzeVideo(videoId: string) {
  return this.request<{
    videoId: string;
    analyzedAt: string;
    sentiment: { pos: number; neu: number; neg: number };
    score: number;
    topPositive: Array<Comment>;
    topNegative: Array<Comment>;
    summary: string;
  }>(`/analysis/${videoId}`, {
    method: 'POST',
  });
}
```

**HTTP Request:**
```
POST /api/analysis/<videoId>
Headers:
  - Cookie: vocalytics_token=<JWT>
  - Content-Type: application/json
Body: (empty)
```

---

#### 2.5 Backend Route: POST /analysis/:videoId
**File:** `packages/server/src/http/routes/analysis.ts`

```typescript
// Lines 17-215
app.post('/analysis/:videoId', async (req, reply) => {
  const { videoId } = req.params;
  const userId = req.auth?.userId;

  if (!userId) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }

  // 1. Check usage quota (paywall)
  const enforcement = await enforceAnalyze({
    userDbId: userId,
    incrementBy: 1,
  });

  if (!enforcement.allowed) {
    return reply.code(402).send({ error: 'Payment required' });
  }

  // 2. Fetch ALL comments from YouTube (paginated)
  let allComments = [];
  let nextPageToken = undefined;
  const maxPages = 10;
  let pageCount = 0;

  do {
    const { comments, nextPageToken: newToken } = await fetchComments(
      videoId,
      undefined,
      100,
      nextPageToken,
      true,
      'time',
      userId
    );
    allComments = allComments.concat(comments);
    nextPageToken = newToken;
    pageCount++;
  } while (nextPageToken && pageCount < maxPages);

  // 3. Analyze comments with OpenAI
  const rawAnalysis = await analyzeComments(allComments);
  const analysis = rawAnalysis.filter(a => a !== null);

  // 4. Calculate aggregate sentiment
  const total = analysis.length;
  const sentimentSums = analysis.reduce((acc, a) => ({
    pos: acc.pos + a.sentiment.positive,
    neu: acc.neu + a.sentiment.neutral,
    neg: acc.neg + a.sentiment.negative,
  }), { pos: 0, neu: 0, neg: 0 });

  const sentiment = {
    pos: sentimentSums.pos / total,
    neu: sentimentSums.neu / total,
    neg: sentimentSums.neg / total,
  };

  const score = sentiment.pos - sentiment.neg;

  // 5. Extract top positive/negative comments
  const categoryCounts = { pos: 0, neu: 0, neg: 0 };
  for (const a of analysis) {
    if (a.category === 'positive') categoryCounts.pos++;
    else if (a.category === 'negative') categoryCounts.neg++;
    else categoryCounts.neu++;
  }

  const positiveComments = analysis
    .filter(a => a.category === 'positive')
    .map(a => {
      const comment = allComments.find(c => c.id === a.commentId);
      return {
        commentId: a.commentId,
        text: comment?.text || '',
        author: comment?.author || 'Anonymous',
        publishedAt: comment?.publishedAt,
        likeCount: comment?.likeCount || 0,
        sentiment: { pos: a.sentiment.positive, ... }
      };
    })
    .slice(0, 5);

  const negativeComments = [...]; // Same as above for negative

  // 6. Generate AI summary
  const aiSummary = await generateCommentSummary(
    allComments.map(c => ({ text: c.text })),
    sentiment
  );

  const summary = aiSummary || `Analyzed ${total} comments...`;

  // 7. Insert into database
  const payload = {
    sentiment,
    score,
    topPositive: positiveComments,
    topNegative: negativeComments,
    summary,
    raw: {
      analysis,
      comments: allComments.map(c => c.id),
      categoryCounts,
      totalComments: total,
    },
  };

  const row = await insertAnalysis(userId, videoId, payload);

  // 8. Return result
  return reply.send({
    videoId,
    analyzedAt: row.analyzed_at,
    sentiment,
    score,
    topPositive: positiveComments,
    topNegative: negativeComments,
    summary,
    categoryCounts,
    totalComments: total,
  });
});
```

---

#### 2.6 Database Operation: insertAnalysis()
**File:** `packages/server/src/db/analyses.ts`

```typescript
// Lines 4-38
export async function insertAnalysis(
  userId: string,
  videoId: string,
  payload: {
    sentiment: Sentiment;
    score: number;
    topPositive?: any[];
    topNegative?: any[];
    summary?: string;
    raw?: any;
  }
): Promise<VideoAnalysisRow> {
  const row = {
    user_id: userId,
    video_id: videoId,
    sentiment: payload.sentiment,
    score: payload.score,
    top_positive: payload.topPositive ?? null,
    top_negative: payload.topNegative ?? null,
    summary: payload.summary ?? null,
    raw: payload.raw ?? null,
  };

  const { data, error } = await supabase
    .from('video_analyses')
    .insert(row)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to insert analysis: ${error.message}`);
  }

  return data;
}
```

**SQL Query:**
```sql
INSERT INTO video_analyses (
  user_id,
  video_id,
  sentiment,
  score,
  top_positive,
  top_negative,
  summary,
  raw
) VALUES (
  'user-id-123',
  'dQw4w9WgXcQ',
  '{"pos": 0.65, "neu": 0.25, "neg": 0.10}',
  0.55,
  '[{...}]',
  '[{...}]',
  'Mostly positive comments...',
  '{...}'
)
RETURNING *;
```

---

#### 2.7 External API Calls During Analysis

**YouTube Data API:**
- **Function:** `fetchComments()` in `packages/server/src/tools.ts`
- **API:** `https://www.googleapis.com/youtube/v3/commentThreads`
- **Purpose:** Fetch all comments for the video
- **Rate:** Up to 10 pages × 100 comments = 1,000 comments max

**OpenAI API:**
- **Function:** `analyzeComments()` in `packages/server/src/tools.ts`
- **API:** `https://api.openai.com/v1/chat/completions`
- **Model:** GPT-4 (configurable)
- **Purpose:** Sentiment analysis for each comment
- **Rate:** One request per comment (batched for efficiency)

**OpenAI API (Summary):**
- **Function:** `generateCommentSummary()` in `packages/server/src/llm.ts`
- **API:** `https://api.openai.com/v1/chat/completions`
- **Model:** GPT-4
- **Purpose:** Generate human-readable summary of all comments

---

#### 2.8 Response Returns to Frontend

**HTTP Response:**
```json
{
  "videoId": "dQw4w9WgXcQ",
  "analyzedAt": "2025-01-15T14:30:00Z",
  "sentiment": {
    "pos": 0.65,
    "neu": 0.25,
    "neg": 0.10
  },
  "score": 0.55,
  "topPositive": [
    {
      "commentId": "xyz123",
      "text": "Great video! Thanks!",
      "author": "JohnDoe",
      "publishedAt": "2025-01-10T12:00:00Z",
      "likeCount": 42,
      "sentiment": { "pos": 0.95, "neu": 0.05, "neg": 0.00 }
    },
    // ... 4 more
  ],
  "topNegative": [ /* ... */ ],
  "summary": "Overall positive reception with viewers appreciating the content quality...",
  "categoryCounts": {
    "pos": 130,
    "neu": 50,
    "neg": 20
  },
  "totalComments": 200
}
```

---

#### 2.9 Frontend Displays Results
**File:** `packages/web/src/pages/VideoDetailPage.tsx`

```typescript
setAnalysis(result);
```

The page re-renders with:
- **SentimentChart** component showing pie chart
- **Top positive comments** list
- **Top negative comments** list
- **AI-generated summary** text
- **"Generate Replies"** button (now enabled)

---

### Summary: Video Analysis Flow

```
User clicks "Analyze" button
  → Frontend: api.analyzeVideo(videoId)
    → POST /api/analysis/:videoId
      → Backend: Check quota (paywall)
        → Backend: Fetch comments from YouTube API (up to 1000)
          → Backend: Call OpenAI API to analyze each comment
            → Backend: Call OpenAI API to generate summary
              → Backend: Calculate aggregate sentiment
                → Backend: Extract top 5 positive/negative
                  → Backend: INSERT INTO video_analyses
                    → Backend: Return analysis result
                      → Frontend: Display charts and comments
```

**Total time:** 10-30 seconds (depends on comment count)
**Network requests:**
- 1 POST to backend
- 1-10 requests to YouTube API (pagination)
- 1-200 requests to OpenAI API (comment analysis)
- 1 request to OpenAI API (summary generation)

**Database queries:**
- 1 SELECT (check quota)
- 1 UPDATE (increment quota)
- 1 INSERT (save analysis)

---

## 3. User Authentication Flow

Two main authentication flows:
1. **Registration** (new user signup)
2. **Login** (existing user)

---

### 3.A Registration Flow

#### Step 1: User Fills Registration Form
**Page:** `/register`
**File:** `packages/web/src/pages/RegisterPage.tsx`

User enters:
- First name
- Last name
- Email
- Password

Clicks "Create Account" button

---

#### Step 2: Frontend Validation
**File:** `packages/web/src/pages/RegisterPage.tsx`

Form validates:
- All fields are filled
- Email is valid format
- Password meets requirements (8+ chars, uppercase, lowercase, number)

If valid → calls `register()` from `useAuth` hook

---

#### Step 3: AuthProvider.register()
**File:** `packages/web/src/hooks/useAuth.tsx`

```typescript
// Lines 97-116
const register = async (data: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}) => {
  const response = await api.register(data);
  setUser(response.user);

  // Fetch quota after registration
  try {
    const userData = await api.getCurrentUser();
    setQuota(userData.quota || null);
  } catch (error) {
    console.warn('Failed to fetch quota:', error);
  }

  // Navigate to YouTube connection
  navigate('/connect');
};
```

---

#### Step 4: Frontend API Call
**File:** `packages/web/src/lib/api.ts`

```typescript
// Lines 65-83
async register(data: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}) {
  return this.request<{
    user: {
      id: string;
      email: string;
      name: string;
      tier: 'free' | 'pro';
      emailVerified: boolean;
    };
  }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
```

**HTTP Request:**
```
POST /api/auth/register
Headers:
  - Content-Type: application/json
Body:
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "password": "SecurePass123"
}
```

---

#### Step 5: Backend Route Handler
**File:** `packages/server/src/http/routes/auth.ts`

```typescript
// Lines 32-120
fastify.post('/auth/register', async (request, reply) => {
  // 1. Validate input with Zod schema
  const body = registerSchema.parse(request.body);

  // 2. Check if email already exists
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', body.email)
    .single();

  if (existing) {
    return reply.code(400).send({
      error: 'Email already exists',
      message: 'An account with this email already exists',
    });
  }

  // 3. Hash password with bcrypt
  const password_hash = await bcrypt.hash(body.password, 10);

  // 4. Create user in database
  const { data: newUser, error: createError } = await supabase
    .from('profiles')
    .insert({
      email: body.email,
      name: `${body.firstName} ${body.lastName}`,
      password_hash,
      tier: 'free',
      email_verified: false,
    })
    .select()
    .single();

  if (createError || !newUser) {
    return reply.code(500).send({
      error: 'Registration failed',
      message: 'Failed to create user account',
    });
  }

  // 5. Generate JWT token
  const jwtToken = generateToken({
    userId: newUser.id,
    email: newUser.email,
    tier: newUser.tier as 'free' | 'pro',
  });

  // 6. Set JWT as HTTP-only cookie
  reply.setCookie('vocalytics_token', jwtToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  });

  // 7. Return user data
  return reply.send({
    user: {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      tier: newUser.tier,
      emailVerified: newUser.email_verified,
    },
  });
});
```

**Database Operations:**
1. `SELECT id FROM profiles WHERE email = 'john@example.com'` (check duplicate)
2. `INSERT INTO profiles (...) VALUES (...) RETURNING *` (create user)

---

#### Step 6: JWT Token Generation
**File:** `packages/server/src/lib/jwt.ts`

```typescript
export function generateToken(payload: {
  userId: string;
  email: string;
  tier: 'free' | 'pro';
}): string {
  const secret = process.env.JWT_SECRET!;

  return jwt.sign(
    {
      userId: payload.userId,
      email: payload.email,
      tier: payload.tier,
    },
    secret,
    { expiresIn: '30d' }
  );
}
```

**JWT Payload Example:**
```json
{
  "userId": "abc-123-def",
  "email": "john@example.com",
  "tier": "free",
  "iat": 1705334400,
  "exp": 1707926400
}
```

---

#### Step 7: Response with Cookie
**HTTP Response:**
```
Status: 200 OK
Headers:
  Set-Cookie: vocalytics_token=<JWT>; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000
Body:
{
  "user": {
    "id": "abc-123-def",
    "email": "john@example.com",
    "name": "John Doe",
    "tier": "free",
    "emailVerified": false
  }
}
```

---

#### Step 8: Frontend Stores User State
**File:** `packages/web/src/hooks/useAuth.tsx`

```typescript
setUser(response.user);
```

Browser stores the JWT in an HTTP-only cookie (cannot be accessed by JavaScript - security feature).

---

#### Step 9: Navigate to YouTube Connection
```typescript
navigate('/connect');
```

User is redirected to `/connect` to link their YouTube account.

---

### 3.B Login Flow

#### Step 1: User Enters Credentials
**Page:** `/signin`
**File:** `packages/web/src/pages/SignInPage.tsx`

User enters:
- Email
- Password

Clicks "Sign In" button

---

#### Step 2: AuthProvider.login()
**File:** `packages/web/src/hooks/useAuth.tsx`

```typescript
// Lines 77-95
const login = async (email: string, password: string) => {
  const data = await api.login({ email, password });
  setUser(data.user);

  // Fetch quota after login
  try {
    const userData = await api.getCurrentUser();
    setQuota(userData.quota || null);
  } catch (error) {
    console.warn('Failed to fetch quota:', error);
  }

  // Navigate based on YouTube connection status
  if (data.user.hasYouTubeConnected) {
    navigate('/app/dashboard');
  } else {
    navigate('/connect');
  }
};
```

---

#### Step 3: Backend Route Handler
**File:** `packages/server/src/http/routes/auth.ts`

```typescript
// Lines 126-213
fastify.post('/auth/login', async (request, reply) => {
  // 1. Validate input
  const body = loginSchema.parse(request.body);

  // 2. Find user by email
  const { data: user, error: userError } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', body.email)
    .single();

  if (userError || !user) {
    return reply.code(401).send({
      error: 'Invalid credentials',
      message: 'Invalid email or password',
    });
  }

  // 3. Check if user has password (vs OAuth-only)
  if (!user.password_hash) {
    return reply.code(400).send({
      error: 'OAuth account',
      message: 'This account was created with Google. Please sign in with Google.',
    });
  }

  // 4. Verify password with bcrypt
  const valid = await bcrypt.compare(body.password, user.password_hash);

  if (!valid) {
    return reply.code(401).send({
      error: 'Invalid credentials',
      message: 'Invalid email or password',
    });
  }

  // 5. Update last login timestamp
  await supabase
    .from('profiles')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', user.id);

  // 6. Generate JWT token
  const jwtToken = generateToken({
    userId: user.id,
    email: user.email,
    tier: user.tier as 'free' | 'pro',
  });

  // 7. Set JWT as HTTP-only cookie
  reply.setCookie('vocalytics_token', jwtToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  });

  // 8. Return user data
  return reply.send({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      tier: user.tier,
      emailVerified: user.email_verified,
      hasYouTubeConnected: !!user.youtube_access_token,
    },
  });
});
```

**Database Operations:**
1. `SELECT * FROM profiles WHERE email = 'john@example.com'`
2. `UPDATE profiles SET last_login_at = NOW() WHERE id = 'abc-123'`

---

### Summary: Authentication Flow

**Registration:**
```
User fills form
  → Frontend validates input
    → POST /api/auth/register
      → Check if email exists
        → Hash password (bcrypt)
          → INSERT INTO profiles
            → Generate JWT
              → Set HTTP-only cookie
                → Return user data
                  → Redirect to /connect
```

**Login:**
```
User enters credentials
  → Frontend validates input
    → POST /api/auth/login
      → SELECT user by email
        → Verify password (bcrypt)
          → Update last_login_at
            → Generate JWT
              → Set HTTP-only cookie
                → Return user data
                  → Redirect to /app/dashboard or /connect
```

**Security Features:**
- Passwords hashed with bcrypt (10 rounds)
- JWT stored in HTTP-only cookie (prevents XSS attacks)
- JWT expires after 30 days
- SameSite=Lax (prevents CSRF attacks)
- Secure flag in production (HTTPS only)

---

## 4. Payment Processing Flow

**Stripe integration for Pro subscriptions**

---

### 4.A Checkout Flow (Free → Pro Upgrade)

#### Step 1: User Clicks "Upgrade to Pro"
**Page:** `/app/billing`
**File:** `packages/web/src/pages/BillingPage.tsx`

```typescript
// Lines 16-29
const handleUpgrade = async () => {
  setIsLoading(true);
  setError("");

  try {
    const { url } = await api.createCheckoutSession();
    // Redirect to Stripe checkout
    window.location.href = url;
  } catch (err: any) {
    console.error("Checkout error:", err);
    setError(err.message || "Failed to start checkout");
    setIsLoading(false);
  }
};
```

---

#### Step 2: Frontend API Call
**File:** `packages/web/src/lib/api.ts`

```typescript
// Lines 390-397
async createCheckoutSession() {
  return this.request<{
    sessionId: string;
    url: string;
  }>('/billing/checkout', {
    method: 'POST',
  });
}
```

**HTTP Request:**
```
POST /api/billing/checkout
Headers:
  - Cookie: vocalytics_token=<JWT>
Body: (empty)
```

---

#### Step 3: Backend Creates Stripe Checkout Session
**File:** `packages/server/src/http/routes/billing.ts`

```typescript
// Lines 27-145
fastify.post('/billing/checkout', async (request: any, reply) => {
  const auth = request.auth;
  const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID;

  // 1. Fetch user from database
  const { data: user, error: userError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', auth.userId)
    .single();

  if (!user || userError) {
    return reply.code(404).send({
      error: 'Not Found',
      message: 'User not found'
    });
  }

  let customerId = user.stripe_customer_id;

  // 2. Create or retrieve Stripe customer
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email || undefined,
      metadata: {
        app_user_id: auth.userId,
        user_db_id: user.id
      }
    });
    customerId = customer.id;

    // Save customer ID to database
    await supabase
      .from('profiles')
      .update({ stripe_customer_id: customerId })
      .eq('id', user.id);
  }

  // 3. Check for existing active subscription
  if (user.stripe_subscription_id) {
    const existingSubscription = await stripe.subscriptions.retrieve(
      user.stripe_subscription_id
    );
    if (existingSubscription && ['active', 'trialing'].includes(existingSubscription.status)) {
      return reply.code(400).send({
        error: 'Already Subscribed',
        message: 'You already have an active subscription.'
      });
    }
  }

  // 4. Create Stripe Checkout Session
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [
      {
        price: STRIPE_PRICE_ID,
        quantity: 1
      }
    ],
    success_url: `${baseUrl}/app/billing?success=true`,
    cancel_url: `${baseUrl}/app/billing?canceled=true`,
    client_reference_id: auth.userId,
    metadata: {
      user_id: auth.userId,
      profile_id: user.id
    }
  });

  return reply.send({
    url: session.url
  });
});
```

**Stripe API Call:**
```
POST https://api.stripe.com/v1/checkout/sessions
{
  "customer": "cus_abc123",
  "mode": "subscription",
  "line_items": [{ "price": "price_xyz", "quantity": 1 }],
  "success_url": "https://app.vocalytics.com/app/billing?success=true",
  "cancel_url": "https://app.vocalytics.com/app/billing?canceled=true"
}
```

**Database Operations:**
1. `SELECT * FROM profiles WHERE id = 'user-id'`
2. `UPDATE profiles SET stripe_customer_id = 'cus_abc123' WHERE id = 'user-id'`

---

#### Step 4: User Redirected to Stripe
**Response:**
```json
{
  "url": "https://checkout.stripe.com/pay/cs_test_abc123..."
}
```

Frontend redirects:
```javascript
window.location.href = url;
```

User is now on Stripe's hosted checkout page.

---

#### Step 5: User Completes Payment
User enters:
- Card number
- Expiration date
- CVC
- Billing address

Clicks "Subscribe" on Stripe's page.

Stripe processes payment and creates subscription.

---

#### Step 6: Stripe Redirects Back
**URL:** `https://app.vocalytics.com/app/billing?success=true`

User is back on the billing page with success message.

---

#### Step 7: Stripe Sends Webhook (Background)
**Asynchronously**, Stripe sends a webhook to notify the server:

**HTTP Request to Server:**
```
POST /api/webhook/stripe
Headers:
  - Stripe-Signature: t=1234567890,v1=abc123...
Body:
{
  "id": "evt_abc123",
  "type": "checkout.session.completed",
  "data": {
    "object": {
      "id": "cs_test_abc123",
      "customer": "cus_abc123",
      "subscription": "sub_abc123",
      ...
    }
  }
}
```

---

#### Step 8: Backend Webhook Handler
**File:** `packages/server/src/http/routes/webhook.ts`

```typescript
// Lines 18-94
fastify.post('/webhook/stripe', async (request: any, reply) => {
  const signature = request.headers['stripe-signature'];

  // 1. Verify webhook signature
  let event: Stripe.Event;
  try {
    const rawBody = request.rawBody || request.body;
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecret
    );
  } catch (err) {
    return reply.code(400).send({
      error: 'Webhook Error',
      message: 'Signature verification failed'
    });
  }

  // 2. Record event in database (idempotency)
  const { isNew } = await recordStripeEvent({
    eventId: event.id,
    type: event.type,
    payload: event.data.object
  });

  if (!isNew) {
    console.log('Duplicate event, skipping');
    return reply.send({ received: true, duplicate: true });
  }

  // 3. Process the event
  await processStripeEvent(event);

  // 4. Mark as processed
  await markStripeEventProcessed(event.id);

  return reply.send({ received: true });
});
```

---

#### Step 9: Process checkout.session.completed Event
**File:** `packages/server/src/http/routes/webhook.ts`

```typescript
// Lines 124-181
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const customerId = session.customer as string;

  // 1. Find user by Stripe customer ID
  const { data: user, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!user || error) {
    console.error(`User not found for customer ${customerId}`);
    return;
  }

  // 2. Fetch subscription from Stripe
  if (session.subscription) {
    const subscriptionId = typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription.id;

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    const status = subscription.status;
    const periodEnd = subscription.current_period_end;
    const currentPeriodEnd = periodEnd ? new Date(periodEnd * 1000) : null;

    // 3. Update user in database
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        stripe_subscription_id: subscription.id,
        subscription_status: status,
        subscribed_until: currentPeriodEnd?.toISOString() || null,
        tier: status === 'active' ? 'pro' : user.tier
      })
      .eq('id', user.id);

    if (updateError) {
      throw new Error(`Failed to update user: ${updateError.message}`);
    }

    console.log(`User ${user.id} upgraded to pro`);
  }
}
```

**Database Operations:**
1. `SELECT * FROM profiles WHERE stripe_customer_id = 'cus_abc123'`
2. `UPDATE profiles SET stripe_subscription_id = 'sub_abc123', subscription_status = 'active', subscribed_until = '2025-02-15', tier = 'pro' WHERE id = 'user-id'`

---

#### Step 10: User Refreshes Page
User's quota limits are now updated:
- Free: 2 analyses/week, 1 reply/day
- **Pro: Unlimited analyses, unlimited replies**

---

### 4.B Subscription Update Webhooks

Stripe continuously sends webhooks for subscription events:

**Event Types:**
1. **customer.subscription.updated** - Renewal, plan change
2. **customer.subscription.deleted** - Cancellation
3. **invoice.paid** - Successful payment
4. **invoice.payment_failed** - Failed payment

**Handler:** `handleSubscriptionChange()` and `handleSubscriptionDeleted()`

**File:** `packages/server/src/http/routes/webhook.ts`

```typescript
// Lines 183-233
async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  // Find user
  const { data: user } = await supabase
    .from('profiles')
    .select('*')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!user) {
    console.error(`User not found for customer ${customerId}`);
    return;
  }

  const status = subscription.status;
  const periodEnd = subscription.current_period_end;
  const currentPeriodEnd = periodEnd ? new Date(periodEnd * 1000) : null;

  // Prevent out-of-order webhooks
  if (user.subscribed_until && currentPeriodEnd) {
    const existingUntil = new Date(user.subscribed_until);
    if (existingUntil > currentPeriodEnd) {
      console.log('Skipping out-of-order webhook');
      return;
    }
  }

  // Update user
  const updates = {
    stripe_subscription_id: subscription.id,
    subscription_status: status,
    subscribed_until: currentPeriodEnd?.toISOString() || null,
    tier: status === 'active' ? 'pro' : user.tier
  };

  await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id);

  console.log(`Subscription ${status} for user ${user.id}`);
}
```

---

### Summary: Payment Processing Flow

```
User clicks "Upgrade to Pro"
  → POST /api/billing/checkout
    → Backend: Fetch user from profiles
      → Backend: Create/retrieve Stripe customer
        → Backend: Create Stripe checkout session
          → Stripe API: checkout.sessions.create
            → Backend: Return checkout URL
              → Frontend: Redirect to Stripe
                → User enters payment info
                  → Stripe processes payment
                    → Stripe redirects to success URL
                      → [Background] Stripe sends webhook
                        → POST /api/webhook/stripe
                          → Backend: Verify signature
                            → Backend: Record event (idempotency)
                              → Backend: Fetch subscription from Stripe
                                → Backend: UPDATE profiles SET tier = 'pro'
                                  → User now has Pro access
```

**Security:**
- Webhook signature verification (prevents spoofing)
- Idempotency checks (prevents duplicate processing)
- Out-of-order webhook protection

**Billing Portal:**
Users can also access `/billing/portal` to:
- Cancel subscription
- Update payment method
- View invoices
- Download receipts

---

## 5. Database Schema & Storage

**What data is stored, where, and why**

---

### 5.1 Database Tables

#### Table: `profiles`
**Purpose:** User accounts and subscription status

**File:** `supabase/migrations/20250101_init_profiles.sql`

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  name TEXT,
  password_hash TEXT,
  avatar_url TEXT,

  -- Subscription
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro')),
  subscription_status TEXT,
  subscribed_until TIMESTAMPTZ,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,

  -- YouTube Integration
  youtube_access_token TEXT,
  youtube_refresh_token TEXT,
  youtube_token_expiry TIMESTAMPTZ,
  youtube_scope TEXT,

  -- Metadata
  email_verified BOOLEAN DEFAULT false,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Key Fields:**
- `id` - Primary key (UUID)
- `email` - Login identifier
- `password_hash` - bcrypt hash (never plain text)
- `tier` - 'free' or 'pro' (determines feature access)
- `stripe_customer_id` - Links to Stripe customer
- `stripe_subscription_id` - Active subscription ID
- `youtube_access_token` - OAuth token for YouTube API

**Why:** Central user record. Stores authentication, subscription, and YouTube integration.

---

#### Table: `video_analyses`
**Purpose:** Store sentiment analysis results

**File:** `supabase/migrations/20251015_channel_persistence.sql`

```sql
CREATE TABLE video_analyses (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  video_id TEXT NOT NULL,
  analyzed_at TIMESTAMPTZ DEFAULT NOW(),

  -- Results
  sentiment JSONB NOT NULL,  -- {"pos": 0.65, "neu": 0.25, "neg": 0.10}
  score REAL NOT NULL,        -- -1.0 to 1.0
  top_positive JSONB,         -- Array of top 5 positive comments
  top_negative JSONB,         -- Array of top 5 negative comments
  summary TEXT,               -- AI-generated summary

  -- Raw data
  raw JSONB,                  -- Full analysis + metadata

  PRIMARY KEY (user_id, video_id, analyzed_at)
);
```

**Key Fields:**
- `user_id` - Who analyzed the video
- `video_id` - YouTube video ID
- `sentiment` - Aggregate sentiment scores (JSON)
- `top_positive` / `top_negative` - Highlighted comments (JSON arrays)
- `summary` - Human-readable summary from GPT-4
- `raw` - Complete analysis data (for re-display without re-analysis)

**Why:** Persist analysis results so users don't have to re-analyze. Expensive to regenerate (OpenAI API costs).

---

#### Table: `rate_limit_buckets`
**Purpose:** Track usage quotas (paywall enforcement)

**File:** `supabase/migrations/20251031_rate_limits_FIXED.sql`

```sql
CREATE TABLE rate_limit_buckets (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,

  -- Analyze quota (weekly)
  analyze_weekly_count INTEGER DEFAULT 0,
  analyze_weekly_limit INTEGER DEFAULT 2,
  analyze_period_start TIMESTAMPTZ DEFAULT NOW(),

  -- Reply quota (daily)
  reply_daily_count INTEGER DEFAULT 0,
  reply_daily_limit INTEGER DEFAULT 1,
  reply_period_start TIMESTAMPTZ DEFAULT NOW(),

  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Key Fields:**
- `analyze_weekly_count` - How many analyses used this week
- `analyze_weekly_limit` - Max analyses allowed (2 for free, unlimited for pro)
- `reply_daily_count` - How many replies generated today
- `reply_daily_limit` - Max replies allowed (1 for free, unlimited for pro)

**Why:** Enforce free tier limits. Prevents abuse. Resets weekly/daily via cron job.

---

#### Table: `stripe_events`
**Purpose:** Webhook idempotency and audit log

**File:** `packages/server/src/db/stripe.ts`

```sql
CREATE TABLE stripe_events (
  id SERIAL PRIMARY KEY,
  event_id TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Key Fields:**
- `event_id` - Stripe's unique event ID (e.g., `evt_abc123`)
- `type` - Event type (e.g., `checkout.session.completed`)
- `payload` - Full event data from Stripe
- `processed` - Whether we've handled it

**Why:** Prevent duplicate webhook processing. Stripe may send the same webhook multiple times. This table ensures idempotency.

---

#### Table: `user_videos`
**Purpose:** Cache YouTube video metadata

**File:** `supabase/migrations/20251015_channel_persistence.sql`

```sql
CREATE TABLE user_videos (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  video_id TEXT NOT NULL,
  title TEXT NOT NULL,
  thumbnail_url TEXT,
  published_at TIMESTAMPTZ,
  stats JSONB,  -- {"viewCount": 1000, "likeCount": 50, "commentCount": 10}
  fetched_at TIMESTAMPTZ DEFAULT NOW(),

  PRIMARY KEY (user_id, video_id)
);
```

**Key Fields:**
- `video_id` - YouTube video ID
- `title` - Video title
- `stats` - View/like/comment counts (JSON)

**Why:** Cache video metadata to avoid excessive YouTube API calls. YouTube API has rate limits (10,000 quota units/day).

---

#### Table: `tone_profiles`
**Purpose:** Learn creator's voice/tone from past replies

**File:** `supabase/migrations/20251019_tone_and_priorities.sql`

```sql
CREATE TABLE tone_profiles (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,

  -- Analysis results
  tone VARCHAR(50),           -- casual/professional/enthusiastic
  formality_level VARCHAR(50), -- very_casual/formal
  emoji_usage VARCHAR(50),    -- never/rarely/frequently
  common_emojis TEXT[],       -- ['😊', '❤️']
  avg_reply_length VARCHAR(50), -- short/medium/long
  common_phrases TEXT[],      -- ["Thanks!", "Great question!"]

  -- Metadata
  example_replies TEXT[],     -- Raw examples used for learning
  learned_from_count INTEGER,
  learned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Key Fields:**
- `tone` - Overall tone classification
- `emoji_usage` - How often they use emojis
- `common_phrases` - Phrases they frequently use
- `example_replies` - Their actual past replies

**Why:** AI reply generation matches the creator's unique voice. Makes replies feel authentic.

---

#### Table: `comment_scores`
**Purpose:** Priority scoring for comments (Pro feature)

**File:** `supabase/migrations/20251019_tone_and_priorities.sql`

```sql
CREATE TABLE comment_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  comment_id TEXT NOT NULL,
  video_id TEXT NOT NULL,

  -- Scoring
  priority_score INTEGER,  -- 0-100
  reasons TEXT[],          -- ["From subscriber", "Contains question"]
  should_auto_reply BOOLEAN DEFAULT false,

  -- Comment metadata (cached)
  comment_text TEXT,
  author_name TEXT,
  author_channel_id TEXT,
  is_subscriber BOOLEAN,
  like_count INTEGER,

  -- Analysis
  sentiment VARCHAR(20),
  is_question BOOLEAN,
  is_spam BOOLEAN,

  scored_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, comment_id)
);
```

**Key Fields:**
- `priority_score` - 0-100 score (higher = more important)
- `reasons` - Why this comment is prioritized
- `is_subscriber` - From a channel subscriber
- `is_question` - Contains a question

**Why:** Pro users can auto-prioritize important comments (from subscribers, questions, etc.). Saves time.

---

#### Table: `reply_settings`
**Purpose:** User preferences for comment prioritization

**File:** `supabase/migrations/20251019_tone_and_priorities.sql`

```sql
CREATE TABLE reply_settings (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,

  -- Priority filters (Pro only)
  prioritize_subscribers BOOLEAN DEFAULT true,
  prioritize_questions BOOLEAN DEFAULT true,
  prioritize_negative BOOLEAN DEFAULT true,
  prioritize_verified BOOLEAN DEFAULT false,

  -- Auto-ignore rules
  ignore_spam BOOLEAN DEFAULT true,
  ignore_generic_praise BOOLEAN DEFAULT false,
  ignore_links BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Key Fields:**
- `prioritize_subscribers` - Boost comments from subscribers
- `prioritize_questions` - Boost questions
- `ignore_spam` - Auto-hide spam

**Why:** Let users customize which comments they care about. Pro feature.

---

### 5.2 Data Relationships

```
profiles (user)
  ├─ video_analyses (1-to-many)
  ├─ user_videos (1-to-many)
  ├─ rate_limit_buckets (1-to-1)
  ├─ tone_profiles (1-to-1)
  ├─ reply_settings (1-to-1)
  └─ comment_scores (1-to-many)
```

**Foreign Keys:**
- All tables reference `profiles(id)`
- `ON DELETE CASCADE` - If user is deleted, all their data is deleted

---

### 5.3 Row-Level Security (RLS)

**What is RLS?**
Row-Level Security ensures users can only access their own data.

**Example Policy:**
```sql
CREATE POLICY "video_analyses_select_own"
  ON video_analyses FOR SELECT
  USING (auth.uid() = user_id);
```

**What this means:**
- User with `id = 'abc-123'` can only see rows where `user_id = 'abc-123'`
- Even if they craft a SQL query, Supabase blocks unauthorized rows

**Policies on Every Table:**
- `profiles` - Users can read/update only their own profile
- `video_analyses` - Users can read/insert/update only their own analyses
- `rate_limit_buckets` - Users can read only their own quota
- `tone_profiles` - Users can read/update only their own tone
- `reply_settings` - Users can read/update only their own settings
- `comment_scores` - Users can read/insert only their own scores

**Why:** Multi-tenant security. One database for all users, but each user is isolated.

---

### 5.4 Why Each Piece of Data is Stored

| Data | Table | Why Stored |
|------|-------|------------|
| **Email & Password** | `profiles` | User authentication |
| **Stripe Customer ID** | `profiles` | Link user to Stripe account |
| **Subscription Status** | `profiles` | Enforce paywall (free vs pro) |
| **YouTube Access Token** | `profiles` | Fetch videos/comments from YouTube API |
| **Video Analyses** | `video_analyses` | Expensive to regenerate ($0.10-$1.00 per video in OpenAI costs) |
| **Top Comments** | `video_analyses.top_positive/negative` | Quick display without re-fetching |
| **AI Summary** | `video_analyses.summary` | GPT-4 generation costs $0.03 per summary |
| **Usage Counters** | `rate_limit_buckets` | Enforce free tier limits (2 analyses/week) |
| **Stripe Events** | `stripe_events` | Prevent duplicate webhook processing |
| **Video Metadata** | `user_videos` | Cache to avoid YouTube API rate limits |
| **Tone Profile** | `tone_profiles` | Generate authentic-sounding replies |
| **Comment Scores** | `comment_scores` | Cache priority calculations (expensive AI calls) |
| **Reply Settings** | `reply_settings` | User preferences for prioritization |

---

### 5.5 Data Flow Summary

**Writing Data:**
```
User Action → Frontend → Backend API → Database (INSERT/UPDATE)
```

**Reading Data:**
```
User Loads Page → Frontend → Backend API → Database (SELECT) → Frontend Display
```

**Background Jobs:**
```
Cron Job → Backend Worker → Database (UPDATE)
  - Reset usage counters (daily/weekly)
  - Process queued tasks
```

**Webhooks:**
```
Stripe Event → Backend Webhook → Database (INSERT/UPDATE)
  - Update subscription status
  - Record event for idempotency
```

---

## Quick Reference: Complete Flows

### New User Journey
```
1. User visits site → Loads landing page
2. Clicks "Sign Up" → Fills registration form
3. POST /api/auth/register → User created in profiles table
4. JWT cookie set → User logged in
5. Navigate to /connect → Connects YouTube account
6. OAuth flow → YouTube tokens stored in profiles table
7. Navigate to /app/videos → Fetches videos from YouTube
8. Clicks video → Analyze comments
9. POST /api/analysis/:videoId → Analysis saved in video_analyses table
10. View results → Charts and AI summary displayed
11. Clicks "Upgrade to Pro" → Stripe checkout
12. Completes payment → Webhook updates profiles.tier = 'pro'
13. Unlimited access unlocked
```

### Returning User Journey
```
1. User opens app → GET /api/auth/me (JWT cookie sent)
2. Backend validates JWT → Returns user + quota from database
3. Navigate to /app/dashboard → View recent analyses
4. Navigate to /app/videos → See previously analyzed videos
5. Click analyzed video → GET /api/analysis/:videoId (cached data)
6. Results display instantly (no re-analysis needed)
```

---

## Performance Optimizations

### Caching Strategies
1. **Video Analyses** - Stored in database, never re-analyzed unless user explicitly requests
2. **Video Metadata** - Cached in `user_videos` table to reduce YouTube API calls
3. **React Query** - Frontend caches API responses for 5 minutes
4. **HTTP-only Cookies** - JWT stored in cookie, no localStorage lookup needed

### Cost Optimizations
1. **OpenAI API** - Only called during analysis, results cached forever
2. **YouTube API** - Pagination limits (max 1000 comments per analysis)
3. **Stripe API** - Only called during checkout/portal, not on every request
4. **Database Indexes** - Fast lookups on `user_id`, `video_id`, `stripe_customer_id`

---

## Security Measures

1. **Authentication:**
   - JWT tokens (30-day expiration)
   - HTTP-only cookies (prevents XSS)
   - bcrypt password hashing (10 rounds)

2. **Authorization:**
   - Row-Level Security (users can only see their data)
   - Paywall enforcement (quota checks before expensive operations)

3. **API Security:**
   - CORS restrictions (only allowed origins)
   - Rate limiting (10 requests/minute per user)
   - Webhook signature verification (Stripe)

4. **Data Privacy:**
   - No passwords stored in plain text
   - YouTube tokens encrypted at rest (Supabase handles)
   - Stripe customer data only stored as IDs (no card numbers)

---

**End of Data Flow Analysis**

This document provides a complete trace of data movement through the Vocalytics application, from UI interactions to database storage and back. Each flow includes specific file names, function names, and line numbers for reference.
