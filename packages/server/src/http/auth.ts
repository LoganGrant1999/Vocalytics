import fp from 'fastify-plugin';
import type { FastifyPluginCallback, FastifyReply, FastifyRequest } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    auth?: {
      userId: string;
      userDbId?: string;
      email?: string;
      tier?: 'free' | 'pro' | null;
    };
  }
}

export type VerifyTokenFn = (token: string) => Promise<{
  userId: string;
  email?: string;
  userDbId?: string;
  tier?: 'free' | 'pro' | null;
} | null>;

interface AuthPluginOpts {
  verifyToken: VerifyTokenFn;
}

const authPlugin: FastifyPluginCallback<AuthPluginOpts> = (fastify, opts, done) => {
  const { verifyToken } = opts;

  fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    // Check for JWT in cookie first, then fall back to Bearer token
    const cookieToken = request.cookies?.vocalytics_token;
    const authz = request.headers.authorization;
    const bearerToken = authz?.startsWith('Bearer ') ? authz.slice(7) : undefined;

    const token = cookieToken || bearerToken;

    if (!token) {
      await reply.code(401).send({ error: 'Unauthorized', message: 'Missing authentication token' });
      return; // CRITICAL: stop lifecycle
    }

    try {
      const claims = await verifyToken(token);
      if (!claims) {
        await reply.code(401).send({ error: 'Unauthorized', message: 'Invalid or expired token' });
        return; // CRITICAL: stop lifecycle
      }
      request.auth = {
        userId: claims.userId,
        userDbId: claims.userDbId,
        email: claims.email,
        tier: claims.tier ?? null,
      };
    } catch (err) {
      // Fail closed
      console.error('Auth check failed:', err);
      await reply.code(401).send({ error: 'Unauthorized', message: 'Authentication failed' });
      return; // CRITICAL: stop lifecycle
    }
  });

  done();
};

export default fp(authPlugin, { name: 'auth-plugin' });
