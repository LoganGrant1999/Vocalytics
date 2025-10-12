import { createClient } from '@supabase/supabase-js';

export type VerifyTokenFn = (token: string) => Promise<{
  userId: string;
  email?: string;
  userDbId?: string;
  tier?: 'free' | 'pro' | null;
} | null>;

export default function buildVerifyToken(): VerifyTokenFn {
  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON || process.env.SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anon) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON for token verification');
  }

  // Client for token verification (anon key)
  const supabase = createClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Admin client for DB enrichment (service role)
  const admin = serviceKey
    ? createClient(url, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

  return async (token: string) => {
    try {
      // Verify JWT with Supabase
      const { data, error } = await (supabase.auth as any).getUser(token);
      if (error || !data?.user) return null;

      const userId = data.user.id;
      const email = data.user.email ?? undefined;

      // Enrich with DB data if admin client available
      if (admin) {
        try {
          const { data: rows } = await admin
            .from('users')
            .select('id, tier, app_user_id')
            .or(`id.eq.${userId},app_user_id.eq.${userId}`)
            .limit(1)
            .single();

          if (rows) {
            return {
              userId,
              email,
              userDbId: rows.id,
              tier: (rows.tier as 'free' | 'pro') ?? null,
            };
          }
        } catch (dbErr) {
          // DB lookup failed, continue with just auth data
          console.warn('Failed to enrich user from DB:', dbErr);
        }
      }

      // Return basic auth data if no DB enrichment
      return { userId, email };
    } catch (err) {
      console.error('Token verification error:', err);
      return null;
    }
  };
}
