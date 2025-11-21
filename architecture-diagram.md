# Vocalytics Architecture Diagrams

**Visual representation of system architecture using Mermaid**

---

## Table of Contents

1. [High-Level System Architecture](#1-high-level-system-architecture)
2. [Detailed Application Architecture](#2-detailed-application-architecture)
3. [Authentication Flow](#3-authentication-flow)
4. [Video Analysis Flow](#4-video-analysis-flow)
5. [Payment Flow](#5-payment-flow)
6. [Database Schema](#6-database-schema)
7. [Technology Stack](#7-technology-stack)

---

## 1. High-Level System Architecture

```mermaid
graph TB
    subgraph "User Layer"
        User[👤 User Browser]
    end

    subgraph "Vercel Platform"
        subgraph "Frontend Layer"
            React[React SPA<br/>TypeScript + Vite]
            Components[UI Components<br/>68 components]
            Router[React Router<br/>14 pages]
        end

        subgraph "Backend Layer - Serverless Functions"
            API[Fastify API<br/>35+ endpoints]
            Routes[Route Handlers<br/>16 files]
            Services[Business Logic<br/>2 services]
            Workers[Background Workers<br/>2 cron jobs]
        end
    end

    subgraph "Supabase"
        DB[(PostgreSQL<br/>8 tables)]
        Auth[Row-Level Security<br/>RLS Policies]
    end

    subgraph "External Services"
        OpenAI[OpenAI API<br/>GPT-4]
        YouTube[YouTube Data API<br/>v3]
        StripeAPI[Stripe API<br/>Payments]
    end

    User -->|HTTPS| React
    React -->|API Calls| API
    API --> Routes
    Routes --> Services
    Services -->|SQL Queries| DB
    DB -->|Enforces| Auth

    Routes -->|AI Requests| OpenAI
    Routes -->|Fetch Videos/Comments| YouTube
    Routes -->|Billing| StripeAPI

    Workers -->|Daily Reset| DB
    StripeAPI -->|Webhooks| Routes

    style React fill:#61dafb,stroke:#333,stroke-width:2px
    style API fill:#f39c12,stroke:#333,stroke-width:2px
    style DB fill:#3ecf8e,stroke:#333,stroke-width:2px
    style OpenAI fill:#74aa9c,stroke:#333,stroke-width:2px
    style YouTube fill:#ff0000,stroke:#333,stroke-width:2px
    style StripeAPI fill:#635bff,stroke:#333,stroke-width:2px
```

---

## 2. Detailed Application Architecture

```mermaid
graph LR
    subgraph "Frontend - React App"
        subgraph "Pages"
            Landing[LandingPage]
            SignIn[SignInPage]
            Register[RegisterPage]
            Dashboard[DashboardPage]
            Videos[VideosPage]
            VideoDetail[VideoDetailPage]
            Comments[CommentsPage]
            Billing[BillingPage]
        end

        subgraph "State Management"
            AuthContext[useAuth Hook<br/>User + Quota]
            ReactQuery[React Query<br/>API Cache]
        end

        subgraph "API Client"
            APIClient[api.ts<br/>All HTTP calls]
        end
    end

    subgraph "Backend - Fastify API"
        subgraph "Routes - HTTP Endpoints"
            AuthRoutes[auth.ts<br/>register, login, me]
            AnalysisRoutes[analysis.ts<br/>analyze, get, trends]
            YouTubeRoutes[youtube-api.ts<br/>videos, comments]
            BillingRoutes[billing.ts<br/>checkout, portal]
            WebhookRoutes[webhook.ts<br/>stripe events]
        end

        subgraph "Middleware"
            AuthMiddleware[JWT Validation]
            RateLimit[Rate Limiting]
            Paywall[Quota Check]
        end

        subgraph "Services"
            CommentScoring[commentScoring.ts]
            ToneAnalysis[toneAnalysis.ts]
        end

        subgraph "Data Access"
            AnalysesDB[analyses.ts]
            UsersDB[users.ts]
            UsageDB[usage.ts]
            RateLimitsDB[rateLimits.ts]
        end
    end

    subgraph "Database - Supabase PostgreSQL"
        profiles[(profiles<br/>Users)]
        video_analyses[(video_analyses<br/>Results)]
        usage_counters[(usage_counters<br/>Quotas)]
        tone_profiles[(tone_profiles<br/>Voice)]
    end

    Dashboard --> AuthContext
    Videos --> ReactQuery
    ReactQuery --> APIClient
    APIClient -->|POST /auth/login| AuthRoutes
    APIClient -->|POST /analysis/:id| AnalysisRoutes
    APIClient -->|GET /youtube/videos| YouTubeRoutes
    APIClient -->|POST /billing/checkout| BillingRoutes

    AuthRoutes --> AuthMiddleware
    AnalysisRoutes --> RateLimit
    AnalysisRoutes --> Paywall

    AnalysisRoutes --> CommentScoring
    AnalysisRoutes --> AnalysesDB
    AuthRoutes --> UsersDB
    Paywall --> RateLimitsDB

    AnalysesDB --> video_analyses
    UsersDB --> profiles
    RateLimitsDB --> usage_counters
    ToneAnalysis --> tone_profiles

    style Dashboard fill:#61dafb
    style AnalysisRoutes fill:#f39c12
    style profiles fill:#3ecf8e
    style AuthMiddleware fill:#e74c3c
```

---

## 3. Authentication Flow

```mermaid
sequenceDiagram
    actor User
    participant Browser
    participant React as React App
    participant API as Fastify API
    participant Auth as auth.ts
    participant DB as Supabase

    Note over User,DB: User Registration Flow

    User->>Browser: Fill registration form
    Browser->>React: Submit form
    React->>API: POST /auth/register<br/>{email, password, name}
    API->>Auth: registerHandler()
    Auth->>DB: Check if email exists
    DB-->>Auth: No duplicate
    Auth->>Auth: bcrypt.hash(password)
    Auth->>DB: INSERT INTO profiles
    DB-->>Auth: User created
    Auth->>Auth: generateToken(userId, email, tier)
    Auth->>API: Set HTTP-only cookie
    API-->>React: {user: {...}}
    React->>React: setUser(user)
    React-->>Browser: Navigate to /connect

    Note over User,DB: User Login Flow

    User->>Browser: Enter credentials
    Browser->>React: Submit login
    React->>API: POST /auth/login<br/>{email, password}
    API->>Auth: loginHandler()
    Auth->>DB: SELECT * FROM profiles<br/>WHERE email = ?
    DB-->>Auth: User found
    Auth->>Auth: bcrypt.compare(password, hash)
    Auth->>Auth: Valid ✓
    Auth->>Auth: generateToken()
    Auth->>API: Set HTTP-only cookie
    API-->>React: {user: {...}}
    React->>React: setUser(user)
    React-->>Browser: Navigate to /app/dashboard

    Note over User,DB: Subsequent Requests

    User->>Browser: Load page
    Browser->>React: Component mount
    React->>API: GET /auth/me<br/>(Cookie: vocalytics_token)
    API->>Auth: verifyToken(cookie)
    Auth->>Auth: jwt.verify(token)
    Auth->>DB: SELECT * FROM profiles<br/>WHERE id = userId
    DB-->>Auth: User + quota data
    Auth-->>API: {user, quota}
    API-->>React: User data
    React->>React: Update context
    React-->>Browser: Render authenticated UI
```

---

## 4. Video Analysis Flow

```mermaid
sequenceDiagram
    actor User
    participant UI as VideoDetailPage
    participant API as /api/analysis/:videoId
    participant Paywall as enforceAnalyze()
    participant YouTube as YouTube API
    participant OpenAI as OpenAI API
    participant DB as Supabase

    User->>UI: Click "Analyze" button
    UI->>UI: setIsAnalyzing(true)
    UI->>API: POST /analysis/:videoId

    Note over API,DB: Quota Check
    API->>Paywall: Check user quota
    Paywall->>DB: SELECT * FROM usage_counters
    DB-->>Paywall: analyze_weekly_count: 1/2
    Paywall-->>API: Allowed ✓

    Note over API,YouTube: Fetch Comments (up to 1000)
    loop Pagination (max 10 pages)
        API->>YouTube: GET commentThreads<br/>?videoId=X&pageToken=Y
        YouTube-->>API: {items: [...], nextPageToken}
    end
    API->>API: Collected 347 comments

    Note over API,OpenAI: AI Sentiment Analysis
    loop For each comment batch
        API->>OpenAI: POST /chat/completions<br/>Analyze sentiment
        OpenAI-->>API: {positive: 0.8, neutral: 0.1, neg: 0.1}
    end

    API->>API: Aggregate results:<br/>pos: 0.65, neu: 0.25, neg: 0.10
    API->>API: Extract top 5 positive
    API->>API: Extract top 5 negative

    Note over API,OpenAI: Generate Summary
    API->>OpenAI: POST /chat/completions<br/>Summarize comments
    OpenAI-->>API: "Overall positive reception..."

    Note over API,DB: Save Results
    API->>DB: INSERT INTO video_analyses<br/>{sentiment, score, summary...}
    DB-->>API: Analysis saved

    API->>DB: UPDATE usage_counters<br/>SET analyze_weekly_count = 2
    DB-->>API: Quota incremented

    API-->>UI: {videoId, sentiment, topPositive,<br/>topNegative, summary}
    UI->>UI: setAnalysis(result)
    UI-->>User: Display charts & comments

    Note over User: Total time: 10-30 seconds<br/>Cost: ~$0.10-$0.50 per video
```

---

## 5. Payment Flow

```mermaid
sequenceDiagram
    actor User
    participant UI as BillingPage
    participant API as Backend API
    participant Stripe as Stripe API
    participant Webhook as /webhook/stripe
    participant DB as Supabase

    Note over User,DB: Checkout Flow

    User->>UI: Click "Upgrade to Pro"
    UI->>API: POST /billing/checkout
    API->>DB: SELECT * FROM profiles
    DB-->>API: User data

    alt No Stripe customer exists
        API->>Stripe: POST /customers
        Stripe-->>API: {id: "cus_abc123"}
        API->>DB: UPDATE profiles<br/>SET stripe_customer_id = "cus_abc123"
    end

    API->>Stripe: POST /checkout/sessions<br/>{customer, price, success_url}
    Stripe-->>API: {url: "checkout.stripe.com/..."}
    API-->>UI: {url}
    UI->>UI: window.location.href = url
    UI-->>User: Redirect to Stripe

    Note over User,Stripe: User on Stripe Checkout

    User->>Stripe: Enter card details
    User->>Stripe: Click "Subscribe"
    Stripe->>Stripe: Process payment
    Stripe-->>User: Redirect to success_url
    User->>UI: Back on app

    Note over Stripe,DB: Background Webhook

    Stripe->>Webhook: POST /webhook/stripe<br/>event: checkout.session.completed
    Webhook->>Webhook: Verify signature
    Webhook->>DB: INSERT INTO stripe_events<br/>(idempotency check)

    alt Event already processed
        DB-->>Webhook: Duplicate
        Webhook-->>Stripe: 200 OK (duplicate: true)
    else New event
        Webhook->>Stripe: GET /subscriptions/:id
        Stripe-->>Webhook: {status: "active", current_period_end}

        Webhook->>DB: UPDATE profiles SET<br/>tier = 'pro',<br/>subscription_status = 'active',<br/>subscribed_until = period_end
        DB-->>Webhook: Updated

        Webhook->>DB: UPDATE stripe_events<br/>SET processed = true
        Webhook-->>Stripe: 200 OK
    end

    Note over User,DB: User Refreshes Page

    User->>UI: Refresh page
    UI->>API: GET /auth/me
    API->>DB: SELECT * FROM profiles
    DB-->>API: {tier: "pro", subscription_status: "active"}
    API-->>UI: User data
    UI-->>User: Show Pro badge + unlimited features ✓
```

---

## 6. Database Schema

```mermaid
erDiagram
    profiles ||--o{ video_analyses : "has many"
    profiles ||--o| usage_counters : "has one"
    profiles ||--o| tone_profiles : "has one"
    profiles ||--o| reply_settings : "has one"
    profiles ||--o{ comment_scores : "has many"
    profiles ||--o{ user_videos : "has many"
    profiles ||--o{ reply_queue : "has many"
    plans ||--o{ usage_counters : "defines limits"

    profiles {
        uuid id PK
        text email
        text password_hash
        text tier "free or pro"
        text subscription_status
        timestamptz subscribed_until
        text stripe_customer_id
        text stripe_subscription_id
        text youtube_access_token
        text youtube_refresh_token
        timestamptz youtube_token_expiry
    }

    video_analyses {
        uuid user_id FK
        text video_id
        timestamptz analyzed_at
        jsonb sentiment "pos, neu, neg"
        numeric score
        jsonb top_positive
        jsonb top_negative
        text summary
        jsonb raw
    }

    usage_counters {
        uuid user_id PK
        text plan_id FK
        int replies_used_month
        date month_start
        int replies_posted_today
        date day_start
        int queued_replies
    }

    tone_profiles {
        uuid user_id PK
        varchar tone
        varchar formality_level
        varchar emoji_usage
        text_array common_emojis
        text_array common_phrases
        int learned_from_count
    }

    plans {
        text id PK "free or pro"
        int monthly_ai_replies_limit
        int daily_post_cap
    }

    comment_scores {
        uuid id PK
        uuid user_id FK
        text comment_id
        text video_id
        int priority_score "0-100"
        text_array reasons
        boolean is_question
        boolean is_spam
    }

    user_videos {
        uuid user_id FK
        text video_id
        text title
        text thumbnail_url
        jsonb stats
        timestamptz fetched_at
    }

    reply_queue {
        uuid id PK
        uuid user_id FK
        text comment_id
        text reply_text
        text status "pending/posted/failed"
        int attempts
    }
```

---

## 7. Technology Stack

```mermaid
graph TB
    subgraph "Frontend Stack"
        React[React 18.3.1]
        TS1[TypeScript 5.8.3]
        Vite[Vite 5.4.19]
        Router[React Router 6.30.1]
        Query[React Query 5.83.0]
        Tailwind[Tailwind CSS 3.4.17]
        Radix[Radix UI Components]
        Recharts[Recharts 2.15.4]
    end

    subgraph "Backend Stack"
        Fastify[Fastify 4.26.0]
        TS2[TypeScript 5.9.3]
        Node[Node.js 20.x]
        Zod[Zod 3.22.4]
        JWT[jsonwebtoken 9.0.2]
        Bcrypt[bcrypt 6.0.0]
    end

    subgraph "External APIs"
        OpenAISDK[openai 6.5.0]
        GoogleAPIs[googleapis 162.0.0]
        StripeSDK[stripe 19.1.0]
        SupabaseSDK[supabase-js 2.75.0]
    end

    subgraph "Database"
        PostgreSQL[PostgreSQL 15<br/>via Supabase]
    end

    subgraph "Deployment"
        Vercel[Vercel<br/>Serverless Functions]
        Cron[Vercel Cron Jobs]
    end

    subgraph "Testing"
        Vitest[Vitest 1.2.1]
        Tests[38 test files<br/>17,912 lines]
    end

    subgraph "Development"
        pnpm[pnpm 10.18.1<br/>Monorepo]
        ESLint[ESLint + Prettier]
        TSX[tsx 4.20.6]
    end

    React --> Vite
    React --> Router
    React --> Query
    React --> Tailwind
    React --> Radix
    React --> Recharts

    Fastify --> Zod
    Fastify --> JWT
    Fastify --> Bcrypt

    Fastify --> OpenAISDK
    Fastify --> GoogleAPIs
    Fastify --> StripeSDK
    Fastify --> SupabaseSDK

    SupabaseSDK --> PostgreSQL

    Fastify --> Vercel
    Vercel --> Cron

    TS1 --> Tests
    TS2 --> Tests
    Tests --> Vitest

    React --> pnpm
    Fastify --> pnpm
    pnpm --> ESLint

    style React fill:#61dafb
    style Fastify fill:#f39c12
    style PostgreSQL fill:#3ecf8e
    style Vercel fill:#000000,color:#fff
    style OpenAISDK fill:#74aa9c
    style StripeSDK fill:#635bff
```

---

## 8. Request/Response Flow - Complete Lifecycle

```mermaid
graph TD
    A[User Browser] -->|1. HTTPS Request| B[Vercel Edge Network]
    B -->|2. Route to| C{Request Type?}

    C -->|Static files| D[React App<br/>HTML/CSS/JS]
    C -->|API call| E[Serverless Function<br/>/api/*]

    D -->|Load| F[React Hydration]
    F -->|Mount| G[useEffect Hook]
    G -->|Trigger| H[API Call via fetch]

    H -->|POST /api/login| E
    E -->|Initialize| I[Fastify Instance]

    I -->|Run| J[CORS Plugin]
    J -->|Next| K[Cookie Parser]
    K -->|Next| L{Auth Required?}

    L -->|Yes| M[Auth Middleware<br/>Verify JWT]
    L -->|No| N[Public Route]

    M -->|Valid Token| O[Extract userId from JWT]
    M -->|Invalid Token| P[Return 401 Unauthorized]

    O -->|Attach to| Q[request.auth]
    Q -->|Next| R[Rate Limit Check]

    R -->|Within Limit| S[Route Handler]
    R -->|Exceeded| T[Return 429 Too Many Requests]

    S -->|Execute| U{Needs Quota?}
    U -->|Yes| V[Paywall Middleware]
    U -->|No| W[Business Logic]

    V -->|Check DB| X[Query usage_counters]
    X -->|Under Limit| W
    X -->|Over Limit| Y[Return 402 Payment Required]

    W -->|Process| Z{Needs External API?}
    Z -->|OpenAI| AA[Call OpenAI API]
    Z -->|YouTube| AB[Call YouTube API]
    Z -->|Stripe| AC[Call Stripe API]
    Z -->|No| AD[Direct to DB]

    AA -->|Response| AD
    AB -->|Response| AD
    AC -->|Response| AD

    AD -->|Query| AE[Supabase Client]
    AE -->|SQL| AF[(PostgreSQL)]
    AF -->|Result| AE

    AE -->|Data| AG[Format Response]
    AG -->|Return| AH[JSON Response]

    AH -->|Send| AI[Vercel Edge Network]
    AI -->|HTTPS| AJ[User Browser]

    AJ -->|Parse| AK[React Query Cache]
    AK -->|Update| AL[Component State]
    AL -->|Trigger| AM[React Re-render]
    AM -->|Display| AN[Updated UI]

    style M fill:#e74c3c
    style V fill:#e74c3c
    style AF fill:#3ecf8e
    style AA fill:#74aa9c
    style AB fill:#ff0000
    style AC fill:#635bff
```

---

## 9. Background Jobs Architecture

```mermaid
graph LR
    subgraph "Vercel Cron"
        Schedule1[Every 5 minutes]
        Schedule2[Daily at 8:10 AM]
    end

    subgraph "Workers"
        QueueWorker[queueWorker.ts<br/>Process pending replies]
        ResetWorker[resetCounters.ts<br/>Reset usage counters]
    end

    subgraph "Database Operations"
        FetchQueue[SELECT * FROM reply_queue<br/>WHERE status = 'pending']
        UpdateQueue[UPDATE reply_queue<br/>SET status = 'posted']
        ResetCounters[UPDATE usage_counters<br/>SET analyze_weekly_count = 0]
        RollPeriods[CALL roll_usage_counters()]
    end

    subgraph "External Actions"
        PostToYT[POST /youtube/comments<br/>commentThreads.insert]
    end

    Schedule1 -->|Trigger| QueueWorker
    Schedule2 -->|Trigger| ResetWorker

    QueueWorker --> FetchQueue
    FetchQueue --> QueueWorker
    QueueWorker -->|For each| PostToYT
    PostToYT -->|Success| UpdateQueue
    PostToYT -->|Failure| UpdateQueue

    ResetWorker --> RollPeriods
    RollPeriods --> ResetCounters

    style Schedule1 fill:#f39c12
    style Schedule2 fill:#f39c12
    style PostToYT fill:#ff0000
```

---

## 10. Error Handling Flow

```mermaid
graph TD
    A[Request Arrives] --> B{Valid JSON?}
    B -->|No| C[400 Bad Request]
    B -->|Yes| D{Has Auth Header/Cookie?}

    D -->|No| E{Public Route?}
    E -->|No| F[401 Unauthorized]
    E -->|Yes| G[Continue]

    D -->|Yes| H{Valid JWT?}
    H -->|No| I[401 Unauthorized]
    H -->|Yes| J{User Exists?}

    J -->|No| K[404 User Not Found]
    J -->|Yes| L{Rate Limit OK?}

    L -->|No| M[429 Too Many Requests]
    L -->|Yes| N{Quota Available?}

    N -->|No| O[402 Payment Required]
    N -->|Yes| P{Input Valid - Zod?}

    P -->|No| Q[400 Validation Error]
    P -->|Yes| R[Execute Business Logic]

    R --> S{External API Call?}
    S -->|Yes| T{API Success?}
    S -->|No| U{Database Query?}

    T -->|No| V{Retry?}
    T -->|Yes| U

    V -->|Yes| T
    V -->|No| W[503 Service Unavailable]

    U -->|Yes| X{Query Success?}
    U -->|No| Y[Return Response]

    X -->|No| Z[500 Database Error]
    X -->|Yes| Y

    G --> P
    Y --> AA[200 OK / 201 Created]

    style C fill:#e74c3c
    style F fill:#e74c3c
    style I fill:#e74c3c
    style K fill:#e74c3c
    style M fill:#e74c3c
    style O fill:#e74c3c
    style Q fill:#e74c3c
    style W fill:#e74c3c
    style Z fill:#e74c3c
    style AA fill:#27ae60
```

---

## Notes for Technical Interviews

### Key Talking Points

**1. Architecture Pattern:**
- Client-server with serverless backend
- Three-layer backend (routes → services → database)
- RESTful API design
- Event-driven (webhooks)

**2. Scalability:**
- Serverless auto-scales (0 to 10,000+ requests/sec)
- Database connection pooling via Supabase
- Caching: React Query (frontend), video analyses (backend)
- Stateless backend (no server-side sessions)

**3. Security:**
- JWT tokens in HTTP-only cookies (prevents XSS)
- bcrypt password hashing (10 rounds)
- Row-Level Security (RLS) in database
- Rate limiting on all endpoints
- Input validation with Zod schemas
- CORS restrictions

**4. Performance:**
- Code splitting with Vite
- React Query caching (5-minute default)
- Database indexes on all foreign keys
- Aggressive caching of expensive operations (AI analysis)
- Pagination on large datasets (100 items/page)

**5. Reliability:**
- Webhook idempotency (stripe_events table)
- Graceful degradation (OpenAI fallback)
- Error boundaries in React
- Comprehensive test coverage (2:1 ratio)
- Database backups (daily)

**6. Cost Optimization:**
- Serverless = pay per request (no idle costs)
- Cache AI results (never re-analyze)
- Batch OpenAI requests when possible
- Free tier for YouTube API (10k quota/day)
- ~$0.01-0.03 per user per month at scale

**7. Trade-offs Made:**
- Serverless (scalability) vs Containers (control)
- Supabase (speed) vs Self-hosted PostgreSQL (flexibility)
- OpenAI (quality) vs Open-source models (cost)
- Monorepo (shared code) vs Separate repos (isolation)
- Heavy use of third-party services (speed to market) vs Building in-house (more control)

---

**Created:** November 21, 2025
**For:** Technical interviews, architecture reviews, team onboarding
**Maintained By:** Engineering team
