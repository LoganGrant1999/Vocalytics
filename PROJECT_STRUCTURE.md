# Vocalytics Project Structure

This document provides an overview of all files in the Vocalytics project, organized by backend and frontend.

---

## Backend (`packages/server/src/`)

### Root Level Files

- **`index.ts`** - Main MCP server entry point that creates a Model Context Protocol server with resources and tools, along with a Fastify health check server.
- **`index.test.ts`** - Basic placeholder test that always passes.
- **`health.ts`** - Factory function that creates a Fastify health check server with a `/health` endpoint.
- **`health.test.ts`** - Tests the health check endpoint to ensure it returns ok and version.
- **`schemas.ts`** - Zod schemas for validating YouTube comment data, API arguments, and sentiment analysis responses, plus normalization functions for handling diverse input shapes.
- **`tools.contract.test.ts`** - Tests that validate the tool schemas can parse minimal valid payloads.
- **`toolRegistry.ts`** - Registers MCP tools (fetch_comments, analyze_comments, generate_replies, summarize_sentiment) with the server and handles tool invocation with input normalization and error mapping.
- **`types.ts`** - Defines the canonical TWComment type for YouTube comments and provides an HTML-to-text conversion helper.
- **`resources.ts`** - Registers MCP resources (HTML widgets for summary and replies) and serves bundled web components.
- **`tools.ts`** - Core implementations of YouTube comment fetching, sentiment analysis, reply generation, and summary functions using OpenAI and Google APIs.
- **`llm.ts`** - OpenAI API wrapper functions for moderation, chat replies, and sentiment analysis with concurrency control and retry logic.

### Database Layer (`db/`)

- **`client.ts`** - Creates Supabase client with service role key and defines TypeScript types for users, usage events, and Stripe events.
- **`users.ts`** - User CRUD operations including upsert, lookups by ID/appUserId/Stripe customer, and updating Stripe subscription details.
- **`stripe.ts`** - Records and marks Stripe webhook events as processed with idempotency handling.
- **`ensure_functions.ts`** - Checks if Postgres quota consumption functions exist and provides SQL migration if they don't.
- **`usage.ts`** - Atomically consumes analyze/reply quotas using Postgres functions and records usage events.

### HTTP Server (`http/`)

- **`index.ts`** - Main HTTP server factory that creates Fastify app with all routes, middleware, CORS, rate limiting, auth, and Vercel serverless export.
- **`rateLimit.ts`** - Token bucket rate limiter (60 req/min default) with per-user/IP tracking and cleanup job.
- **`cors.ts`** - Strict CORS middleware with origin allowlist from environment config.
- **`envValidation.ts`** - Validates critical environment variables on startup and provides status endpoint for debugging.
- **`auth.ts`** - Fastify auth plugin that verifies JWT from cookie or Bearer token on protected routes.
- **`verifyToken.ts`** - JWT verification function that enriches token claims with user data from Supabase profiles table.
- **`paywall.ts`** - Enforces free tier quotas for analyze and reply features, returning paywall errors when limits exceeded.

### HTTP Routes (`http/routes/`)

- **`fetch-comments.ts`** - POST endpoint that fetches YouTube comments for a video or channel using the tools layer.
- **`analyze-comments.ts`** - POST endpoint that analyzes comments with paywall enforcement and transforms results for frontend.
- **`generate-replies.ts`** - POST endpoint that generates reply suggestions with paywall enforcement based on tone count.
- **`summarize-sentiment.ts`** - POST endpoint that summarizes sentiment analysis results without paywall.
- **`billing.ts`** - Stripe checkout and portal session creation endpoints for subscription management.
- **`webhook.ts`** - Stripe webhook handler that processes subscription events (checkout, created, updated, deleted) with signature verification.
- **`youtube.ts`** - YouTube OAuth flow (connect/callback) and API routes (comments/reply) with rate limiting and scope validation.
- **`me.ts`** - User profile endpoints for subscription status and usage stats.
- **`youtube-oauth.ts`** - Simplified YouTube OAuth routes (connect/callback) that authenticate users via Google and store tokens.
- **`youtube-api.ts`** - Protected YouTube API routes for fetching comments and posting replies with rate limiting.

### Library Functions (`lib/`)

- **`google.ts`** - Creates authenticated YouTube API clients for users by fetching tokens from Supabase, handling refresh, and persisting updated tokens.
- **`jwt.ts`** - JWT token generation and verification for session management.

### Configuration (`config/`)

- **`env.ts`** - Centralized environment variable parsing for quota caps and public URLs.

---

## Frontend (`packages/web/src/`)

### Root Level

- **`tw-summary.ts`** - Browser-only widget that displays comment aggregates (total, positive, negative, spam) from OpenAI tool output for browser extensions.
- **`tw-replies.ts`** - Browser-only widget that renders AI reply suggestions with tone badges for browser extensions.
- **`index.ts`** - Simple console log entry file marking Vocalytics Web initialization.
- **`paywallHook.ts`** - Paywall UI rendering utilities for web widgets that display upgrade prompts when free tier limits are exceeded.
- **`vite-env.d.ts`** - TypeScript reference file for Vite client types.
- **`main.tsx`** - Application entry point that initializes analytics and renders the root React app.
- **`App.tsx`** - Root application component that sets up routing (Landing, Dashboard, Videos, Analyze, Billing) with QueryProvider and AppShell layout.

### Library (`lib/`)

- **`utils.ts`** - Utility function `cn()` for merging Tailwind CSS class names using clsx and tailwind-merge.
- **`errors.ts`** - Error normalization utilities that standardize API error responses into a consistent `ApiErrorResponse` shape.
- **`api.test.ts`** - Example usage tests demonstrating how to use the typed API client for health checks, comment analysis, and reply generation.
- **`api.acceptance.test.ts`** - Acceptance test verifying the API client can be imported and called with full TypeScript type safety.
- **`youtube.ts`** - YouTube video ID validation and extraction utilities supporting URLs and direct IDs.
- **`requestStore.ts`** - In-memory store tracking the last 5 API requests with request IDs for debugging purposes.
- **`analytics.ts`** - PostHog analytics integration with typed event tracking (connect, analyze, replies, paywall, checkout events).
- **`api.ts`** - Typed API client using openapi-fetch with automatic request tracking middleware and cookie-based authentication.

### Types (`types/`)

- **`api.d.ts`** - Auto-generated TypeScript definitions from OpenAPI spec covering all API endpoints, schemas, and response types.

### UI Components (`components/ui/`)

- **`button.tsx`** - Reusable button component with variants (default, destructive, outline, secondary, ghost, link) and size options.
- **`toaster.tsx`** - Toast notification component using Sonner with custom styling for success/error/info messages.

### Components (`components/`)

- **`ConnectYouTubeButton.tsx`** - Button component that initiates YouTube OAuth flow by redirecting to `/api/youtube/connect`.
- **`UsageMeter.tsx`** - Visual progress bar showing usage vs limits with color-coded warnings (green, yellow, red) for weekly/daily quotas.
- **`VideoList.tsx`** - Displays a list of YouTube videos with thumbnails, metadata, and analyze buttons for navigation.
- **`VideoIdInput.tsx`** - Input field with real-time validation for YouTube URLs or video IDs, extracts ID and navigates to analysis page.
- **`SentimentBar.tsx`** - Horizontal bar chart displaying sentiment distribution (positive, neutral, negative) with percentages.
- **`CommentList.tsx`** - Displays comments with sentiment badges, author info, likes, and reply generation buttons.
- **`PaywallDialog.tsx`** - Modal dialog shown when free tier limits are reached, displays Pro features and upgrade CTA.
- **`PricingTable.tsx`** - Pricing comparison table for Free vs Pro tiers with feature lists and upgrade/manage subscription buttons.
- **`ReplyDraftPanel.tsx`** - Panel showing AI-generated reply suggestions with copy/send functionality and OAuth scope warnings.
- **`ErrorCallout.tsx`** - Standardized error display with special handling for 429 rate limits (countdown timer) and 402 paywall errors.
- **`DebugDrawer.tsx`** - Sliding drawer displaying the last 5 API requests with method, status, timestamp, and copyable request IDs.
- **`AppShell.tsx`** - Main application layout with responsive navbar, collapsible sidebar, and routing (Dashboard, Videos, Billing).
- **`CookieBanner.tsx`** - Cookie consent banner shown on first visit, stores user choice in localStorage.

### Providers (`providers/`)

- **`QueryProvider.tsx`** - React Query provider wrapper with default configuration (1-minute stale time, 1 retry) for data fetching.

### Pages (`pages/`)

- **`HomePage.tsx`** - Marketing homepage with hero section, feature cards, and Connect YouTube CTA (appears to be deprecated in favor of Landing route).

### Routes (`routes/`)

- **`Landing.tsx`** - Public landing page with hero section, features showcase (Sentiment Analysis, AI Replies, YouTube Integration), and CTAs.
- **`Videos.tsx`** - Videos page with VideoIdInput component for manually entering YouTube URLs or IDs to analyze.
- **`Dashboard.tsx`** - Main dashboard showing account tier, usage meters, stats, quick actions, and OAuth success/error handling.
- **`Billing.tsx`** - Billing page with PricingTable, current usage display, and Stripe checkout success/cancel handling with polling.
- **`Analyze.tsx`** - Video analysis page showing comments, sentiment analysis, reply generation, with tabs for overview/comments/replies and rate limit handling.

### Hooks (`hooks/`)

- **`useSession.ts`** - Custom hook fetching user session data (tier, usage counts, scopes) from `/api/me/subscription` and `/api/me/usage` endpoints.
- **`useAnalytics.ts`** - Custom hook providing a typed interface for tracking analytics events via PostHog.
- **`useUpgrade.ts`** - Custom hook for Stripe checkout flow, creates checkout session and redirects to Stripe, handles portal access.
