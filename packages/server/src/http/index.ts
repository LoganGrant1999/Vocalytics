// IMPORTANT: Load .env FIRST, before any other imports
// This ensures all modules see the correct environment variables
// In production (Vercel), environment variables are injected directly
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Only load .env.local file in development (Vercel injects env vars directly)
if (process.env.NODE_ENV !== 'production') {
  // Dynamic import to load dotenv only in dev
  const { config } = await import('dotenv');
  config({ path: resolve(__dirname, '../../.env.local'), override: true });
}

// Now import everything else
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyCookie from '@fastify/cookie';
import corsPlugin from './corsPlugin.js';
import headersPlugin from './headersPlugin.js';
import loggingPlugin from './loggingPlugin.js';
import authPlugin from './auth.js';
import buildVerifyToken from './verifyToken.js';
import { fetchCommentsRoute } from './routes/fetch-comments.js';
import { analyzeCommentsRoute } from './routes/analyze-comments.js';
import { generateRepliesRoute } from './routes/generate-replies.js';
import { summarizeSentimentRoute } from './routes/summarize-sentiment.js';
import { meRoutes } from './routes/me.js';
import { billingRoutes } from './routes/billing.js';
import { webhookRoute } from './routes/webhook.js';
// NOTE: youtubeRoutes moved to youtube-oauth.ts (registered as public OAuth routes)
import { toneRoutes } from './routes/tone.js';
import { commentsRoutes } from './routes/comments.js';
import { createRateLimiter, startRateLimitCleanup } from './rateLimit.js';
import { validateEnv } from './envValidation.js';
import { createClient } from '@supabase/supabase-js';
import type { IncomingMessage, ServerResponse } from 'http';

export async function createHttpServer() {
  const fastify = Fastify({
    logger: true,
    // Body size limit for JSON payloads (1MB max)
    bodyLimit: 1_000_000,
    requestIdHeader: 'x-request-id',
    genReqId: (req) => {
      return (req.headers['x-request-id'] as string) || `req_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    },
  });

  // Register core plugins
  await fastify.register(corsPlugin);
  await fastify.register(headersPlugin);
  await fastify.register(loggingPlugin);

  // Register cookie plugin for JWT session management
  await fastify.register(fastifyCookie, {
    secret: process.env.COOKIE_SECRET || 'dev-cookie-secret-change-in-production',
    parseOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    },
  });

  // Rate limiting (60 req/min default)
  const globalRateLimit = createRateLimiter(60);
  fastify.addHook('onRequest', globalRateLimit);

  // Add raw body support for webhooks
  fastify.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (req: any, body: string, done) => {
      try {
        // Store raw body for webhook verification
        req.rawBody = body;

        // Handle empty body gracefully
        if (!body || body.trim() === '') {
          done(null, {});
          return;
        }

        const json = JSON.parse(body);
        done(null, json);
      } catch (err: any) {
        // Return 400 for malformed JSON
        err.statusCode = 400;
        done(err, undefined);
      }
    }
  );

  // Serve static files (landing pages) at root (only in development)
  if (process.env.NODE_ENV !== 'production') {
    const staticPath = resolve(__dirname, '../../../../packages/web/public');
    await fastify.register(fastifyStatic, {
      root: staticPath,
      prefix: '/',
      decorateReply: false,
    });
  }

  // Root route
  fastify.get('/', async () => {
    return {
      message: 'Vocalytics API',
      endpoints: {
        health: '/healthz',
        api: '/api/*',
        webhook: '/webhook/stripe'
      }
    };
  });

  // Health check (no auth required)
  fastify.get('/healthz', async () => {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // Check DB connectivity (lightweight)
    let dbStatus = 'unknown';
    if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
      try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
        const { error } = await supabase.from('profiles').select('id').limit(1);
        dbStatus = error ? 'error' : 'ok';
      } catch {
        dbStatus = 'error';
      }
    }

    // Check Stripe webhook configuration
    const stripeWebhook = process.env.STRIPE_WEBHOOK_SECRET ? 'configured' : 'not_configured';

    return {
      ok: true,
      version: '1.0.0',
      time: new Date().toISOString(),
      db: dbStatus,
      stripeWebhook,
    };
  });

  // Register webhook route (no auth required)
  await webhookRoute(fastify);

  // Dev-only env inspection route (no auth required)
  if (process.env.NODE_ENV !== 'production') {
    fastify.get('/api/me/env', async (_request, reply) => {
      const { getEnvStatus } = await import('./envValidation.js');
      const envStatus = getEnvStatus();
      return reply.send(envStatus);
    });
  }

  // Build token verifier
  const verifyToken = buildVerifyToken();

  // Register public auth routes (no auth required for register/login/logout)
  await fastify.register(async (publicAuthInstance) => {
    console.log('[index.ts] Registering public auth routes...');
    const { publicAuthRoutes } = await import('./routes/auth.js');
    await publicAuthRoutes(publicAuthInstance);
    console.log('[index.ts] Public auth routes registered successfully');
  }, { prefix: '/api' });

  // Register YouTube OAuth routes (no auth required for connect/callback)
  // These need to be public so users can initiate OAuth without being logged in
  await fastify.register(async (youtubeInstance) => {
    // Import and register only OAuth routes
    const { youtubeOAuthRoutes } = await import('./routes/youtube-oauth.js');
    await youtubeOAuthRoutes(youtubeInstance);
  }, { prefix: '/api' });

  // Register protected /api routes in a scoped context with auth
  await fastify.register(async (apiInstance) => {
    // Apply auth to this scope
    await apiInstance.register(authPlugin, { verifyToken });

    // Register all protected routes in this scope
    const { youtubeApiRoutes } = await import('./routes/youtube-api.js');
    const youtubeVideosRoute = (await import('./routes/youtube-videos.js')).default;
    const analysisRoute = (await import('./routes/analysis.js')).default;
    const debugYoutubeRoute = (await import('./routes/debug-youtube.js')).default;
    const { protectedAuthRoutes } = await import('./routes/auth.js');

    await protectedAuthRoutes(apiInstance);
    await youtubeApiRoutes(apiInstance);
    await youtubeVideosRoute(apiInstance);
    await analysisRoute(apiInstance);
    await fetchCommentsRoute(apiInstance);
    await analyzeCommentsRoute(apiInstance);
    await generateRepliesRoute(apiInstance);
    await summarizeSentimentRoute(apiInstance);
    await meRoutes(apiInstance);
    await billingRoutes(apiInstance);
    await toneRoutes(apiInstance);
    await commentsRoutes(apiInstance);

    // Debug endpoint (development only - TODO: remove before production launch)
    if (process.env.NODE_ENV !== 'production') {
      await debugYoutubeRoute(apiInstance);
    }
  }, { prefix: '/api' });

  return fastify;
}

export async function start() {
  const PORT = Number(process.env.PORT || 3000);
  const HOST = process.env.HOST || '0.0.0.0';

  // Validate environment variables on startup
  validateEnv();

  // Start rate limit cleanup job
  startRateLimitCleanup();

  const server = await createHttpServer();

  try {
    await server.listen({ port: PORT, host: HOST });
    console.log(`\n✅ HTTP server listening on ${HOST}:${PORT}`);
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`   App ENV: ${process.env.APP_ENV || 'local'}\n`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

// Run if main module (local dev)
if (import.meta.url === `file://${process.argv[1]}`) {
  start();
}

// Export for Vercel serverless - NO caching, fresh instance per cold start
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    console.log(`[Vercel Handler] ${req.method} ${req.url}`);
    const app = await createHttpServer();
    await app.ready();

    console.log('[Vercel Handler] Fastify app ready, handling request...');

    // Close after handling to prevent memory leaks
    res.on('finish', () => {
      app.close();
    });

    // Directly pass req/res to Fastify's underlying HTTP server
    app.server.emit('request', req, res);
  } catch (error) {
    console.error('[Vercel Handler] Error:', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }));
  }
}
