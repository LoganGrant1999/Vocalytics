import { createClient } from '@supabase/supabase-js';
import { verifyToken as verifyJWT } from '../lib/jwt.js';

export type VerifyTokenFn = (token: string) => Promise<{
  userId: string;
  email?: string;
  userDbId?: string;
  tier?: 'free' | 'pro' | null;
} | null>;

export default function buildVerifyToken(): VerifyTokenFn {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Admin client for DB enrichment (service role)
  const admin = url && serviceKey
    ? createClient(url, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

  return async (token: string) => {
    try {
      // Verify JWT with our own JWT library
      const payload = verifyJWT(token);
      if (!payload) return null;

      // Enrich with DB data if admin client available
      if (admin) {
        try {
          const { data: rows, error: dbError } = await admin
            .from('profiles')
            .select('id, tier, email')
            .eq('id', payload.userId)
            .limit(1)
            .single();

          if (dbError) {
            // User not found in database - JWT is invalid/stale
            console.warn(`[verifyToken] User ${payload.userId} not found in database (JWT is stale/invalid)`);
            return null;
          }

          if (rows) {
            return {
              userId: payload.userId,
              email: rows.email,
              userDbId: rows.id,
              tier: (rows.tier as 'free' | 'pro') ?? null,
            };
          }

          // No rows returned - user doesn't exist
          console.warn(`[verifyToken] No profile found for user ${payload.userId}`);
          return null;
        } catch (dbErr) {
          // Unexpected DB error - reject to be safe
          console.error('[verifyToken] Database error during user lookup:', dbErr);
          return null;
        }
      }

      // No admin client available - fall back to JWT data only (dev mode)
      console.warn('[verifyToken] No admin client available, using JWT data only (not recommended for production)');
      return {
        userId: payload.userId,
        email: payload.email,
        tier: payload.tier,
      };
    } catch (err) {
      console.error('Token verification error:', err);
      return null;
    }
  };
}
