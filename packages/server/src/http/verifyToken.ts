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
          const { data: rows } = await admin
            .from('profiles')
            .select('id, tier, email')
            .eq('id', payload.userId)
            .limit(1)
            .single();

          if (rows) {
            return {
              userId: payload.userId,
              email: rows.email,
              userDbId: rows.id,
              tier: (rows.tier as 'free' | 'pro') ?? null,
            };
          }
        } catch (dbErr) {
          // DB lookup failed, continue with just JWT data
          console.warn('Failed to enrich user from DB:', dbErr);
        }
      }

      // Return JWT data if no DB enrichment
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
