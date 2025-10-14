import { FastifyRequest, FastifyReply } from 'fastify';

/**
 * CORS middleware with strict allowlist (no wildcard)
 * Origins configured via CORS_ORIGINS environment variable (comma-separated)
 */

const CORS_ORIGINS_ENV = process.env.CORS_ORIGINS || '';
const ALLOWED_ORIGINS = CORS_ORIGINS_ENV
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

// If no config, default to localhost for development
if (ALLOWED_ORIGINS.length === 0 && process.env.NODE_ENV !== 'production') {
  ALLOWED_ORIGINS.push('http://localhost:3000', 'http://localhost:5173', 'http://localhost:5174');
}

/**
 * CORS hook - strict origin checking
 */
export async function corsMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const origin = request.headers.origin;

  // No CORS headers if no origin (same-origin request)
  if (!origin) {
    return;
  }

  // Check if origin is allowed
  const isAllowed = ALLOWED_ORIGINS.some(allowed => {
    // Exact match
    if (allowed === origin) return true;

    // Pattern match for wildcard subdomains (e.g., *.vercel.app)
    if (allowed.includes('*')) {
      const pattern = allowed.replace(/\*/g, '.*');
      const regex = new RegExp(`^${pattern}$`);
      return regex.test(origin);
    }

    return false;
  });

  if (isAllowed) {
    reply.header('Access-Control-Allow-Origin', origin);
    reply.header('Access-Control-Allow-Credentials', 'true');
    reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-Id');
    reply.header('Access-Control-Max-Age', '86400'); // 24 hours
  }

  // Handle preflight
  if (request.method === 'OPTIONS') {
    reply.code(204).send();
  }
}

/**
 * Get configured CORS origins (for logging/debugging)
 */
export function getCorsOrigins(): string[] {
  return [...ALLOWED_ORIGINS];
}
