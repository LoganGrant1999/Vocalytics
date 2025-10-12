// IMPORTANT: Load .env FIRST, before any other imports
// This ensures all modules see the correct environment variables
import { config } from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, '../../../../.env') });

// Now import everything else
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import authPlugin from './auth.js';
import buildVerifyToken from './verifyToken.js';
import { fetchCommentsRoute } from './routes/fetch-comments.js';
import { analyzeCommentsRoute } from './routes/analyze-comments.js';
import { generateRepliesRoute } from './routes/generate-replies.js';
import { summarizeSentimentRoute } from './routes/summarize-sentiment.js';
import { meRoutes } from './routes/me.js';
import { billingRoutes } from './routes/billing.js';
import { webhookRoute } from './routes/webhook.js';

export async function createHttpServer() {
  const fastify = Fastify({
    logger: true,
    // Body size limit - must trigger before paywall
    bodyLimit: 5 * 1024 * 1024, // 5MB
  });

  // Add security headers and request ID tracking
  fastify.addHook('onSend', async (request, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    reply.header('X-Frame-Options', 'DENY');

    // Echo back request ID (use custom header if provided, otherwise use Fastify's generated ID)
    const requestId = request.headers['x-request-id'] || request.id;
    reply.header('X-Request-Id', requestId);
  });

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

  // Serve static files (landing pages) at root
  const staticPath = resolve(__dirname, '../../../../packages/web/public');
  await fastify.register(fastifyStatic, {
    root: staticPath,
    prefix: '/',
    decorateReply: false,
  });

  // Health check (no auth required)
  fastify.get('/healthz', async () => {
    return { status: 'ok', service: 'vocalytics-http' };
  });

  // Register webhook route (no auth required)
  await webhookRoute(fastify);

  // Build token verifier
  const verifyToken = buildVerifyToken();

  // Register protected /api routes in a scoped context with auth
  await fastify.register(async (apiInstance) => {
    // Apply auth to this scope
    await apiInstance.register(authPlugin, { verifyToken });

    // Register all protected routes in this scope
    await fetchCommentsRoute(apiInstance);
    await analyzeCommentsRoute(apiInstance);
    await generateRepliesRoute(apiInstance);
    await summarizeSentimentRoute(apiInstance);
    await meRoutes(apiInstance);
    await billingRoutes(apiInstance);
  }, { prefix: '/api' });

  return fastify;
}

export async function start() {
  const PORT = Number(process.env.PORT || 3000);
  const HOST = process.env.HOST || '0.0.0.0';

  const server = await createHttpServer();

  try {
    await server.listen({ port: PORT, host: HOST });
    console.log(`HTTP server listening on ${HOST}:${PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

// Run if main module
if (import.meta.url === `file://${process.argv[1]}`) {
  start();
}
