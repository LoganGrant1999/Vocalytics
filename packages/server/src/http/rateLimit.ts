import { FastifyRequest, FastifyReply } from 'fastify';

/**
 * Token bucket rate limiter for API requests
 * Per-user (JWT id) + IP address
 * Default: 60 req/min, configurable per-route
 */

interface RateLimitBucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, RateLimitBucket>();

// Default config (overridable per route)
const DEFAULT_RATE_LIMIT = Number(process.env.RATE_LIMIT_PER_MINUTE ?? 60);
const WINDOW_MS = 60_000; // 1 minute

/**
 * Rate limit middleware factory
 * @param maxRequests Maximum requests per minute (default: 60)
 * @returns Fastify hook function
 */
export function createRateLimiter(maxRequests: number = DEFAULT_RATE_LIMIT) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // Build key from user ID (if authenticated) + IP
    const userId = (request as any).auth?.userId || (request as any).auth?.userDbId;
    const ip = request.ip || request.headers['x-forwarded-for'] || 'unknown';
    const key = userId ? `user:${userId}` : `ip:${ip}`;

    const now = Date.now();
    let bucket = buckets.get(key);

    // Initialize or refill bucket
    if (!bucket) {
      bucket = { tokens: maxRequests, lastRefill: now };
      buckets.set(key, bucket);
    } else {
      // Refill tokens based on elapsed time (token bucket algorithm)
      const elapsedMs = now - bucket.lastRefill;
      if (elapsedMs >= WINDOW_MS) {
        // Full refill after window
        bucket.tokens = maxRequests;
        bucket.lastRefill = now;
      } else {
        // Partial refill proportional to elapsed time
        const tokensToAdd = Math.floor((elapsedMs / WINDOW_MS) * maxRequests);
        bucket.tokens = Math.min(maxRequests, bucket.tokens + tokensToAdd);
        if (tokensToAdd > 0) {
          bucket.lastRefill = now;
        }
      }
    }

    // Check if request can proceed
    if (bucket.tokens < 1) {
      const resetMs = WINDOW_MS - (now - bucket.lastRefill);
      const retryAfterSec = Math.ceil(resetMs / 1000);

      reply.header('X-RateLimit-Limit', maxRequests.toString());
      reply.header('X-RateLimit-Remaining', '0');
      reply.header('Retry-After', retryAfterSec.toString());

      return reply.code(429).send({
        error: 'Rate Limit Exceeded',
        message: `Too many requests. Please wait ${retryAfterSec} seconds.`,
        retryAfter: retryAfterSec,
      });
    }

    // Consume 1 token
    bucket.tokens -= 1;

    // Set rate limit headers
    reply.header('X-RateLimit-Limit', maxRequests.toString());
    reply.header('X-RateLimit-Remaining', Math.floor(bucket.tokens).toString());
  };
}

/**
 * Cleanup old buckets periodically (prevent memory leak)
 * Call this from server startup
 */
export function startRateLimitCleanup() {
  const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
  const MAX_AGE = 10 * 60 * 1000; // 10 minutes

  setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets.entries()) {
      if (now - bucket.lastRefill > MAX_AGE) {
        buckets.delete(key);
      }
    }
  }, CLEANUP_INTERVAL);
}
