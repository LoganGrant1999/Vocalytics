/**
 * Environment variable validation and logging
 * Warns about missing critical vars in production
 */

interface EnvCheck {
  key: string;
  required: boolean;
  description: string;
}

const CRITICAL_ENV_VARS: EnvCheck[] = [
  { key: 'SUPABASE_URL', required: true, description: 'Supabase project URL' },
  { key: 'SUPABASE_ANON_KEY', required: true, description: 'Supabase anonymous key' },
  { key: 'SUPABASE_SERVICE_ROLE_KEY', required: true, description: 'Supabase service role key' },
  { key: 'STRIPE_SECRET_KEY', required: true, description: 'Stripe secret key' },
  { key: 'STRIPE_WEBHOOK_SECRET', required: true, description: 'Stripe webhook secret' },
  { key: 'GOOGLE_CLIENT_ID', required: true, description: 'Google OAuth client ID (required for YouTube OAuth)' },
  { key: 'GOOGLE_CLIENT_SECRET', required: true, description: 'Google OAuth client secret (required for YouTube OAuth)' },
  { key: 'GOOGLE_REDIRECT_URI_LOCAL', required: false, description: 'Google OAuth redirect URI (local dev)' },
  { key: 'GOOGLE_REDIRECT_URI_PROD', required: false, description: 'Google OAuth redirect URI (production)' },
  { key: 'CORS_ORIGINS', required: false, description: 'Comma-separated allowed CORS origins' },
  { key: 'OPENAI_API_KEY', required: true, description: 'OpenAI API key for LLM features' },
];

/**
 * Validate environment variables on startup
 * Non-fatal but logs warnings for missing critical vars
 */
export function validateEnv(): void {
  const isProd = process.env.NODE_ENV === 'production';
  const missing: string[] = [];
  const configured: string[] = [];

  for (const check of CRITICAL_ENV_VARS) {
    const value = process.env[check.key];
    const isSet = Boolean(value && value.trim());

    if (isSet) {
      configured.push(check.key);
    } else {
      if (check.required || isProd) {
        missing.push(`${check.key} (${check.description})`);
      }
    }
  }

  // Log results
  console.log('\n🔧 Environment Configuration Check');
  console.log(`   Mode: ${isProd ? 'PRODUCTION' : 'DEVELOPMENT'}`);
  console.log(`   Configured: ${configured.length}/${CRITICAL_ENV_VARS.length} vars`);

  if (configured.length > 0) {
    console.log(`   ✓ ${configured.join(', ')}`);
  }

  if (missing.length > 0) {
    console.warn(`\n⚠️  Missing environment variables:`);
    missing.forEach(m => console.warn(`   - ${m}`));

    if (isProd) {
      console.warn('\n   Production deployment may fail without these!');
    }
  }

  console.log(''); // blank line
}

/**
 * Get environment configuration status (for /api/me/env endpoint)
 * Returns which keys are configured (true/false), NOT the values
 */
export function getEnvStatus(): {
  supabaseUrl: boolean;
  supabaseAnonKey: boolean;
  supabaseServiceRole: boolean;
  stripe: boolean;
  stripeWebhook: boolean;
  google: boolean;
  openai: boolean;
  corsOrigins: string[];
} {
  const corsOriginsRaw = process.env.CORS_ORIGINS || '';
  const corsOrigins = corsOriginsRaw
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

  return {
    supabaseUrl: Boolean(process.env.SUPABASE_URL?.trim()),
    supabaseAnonKey: Boolean(process.env.SUPABASE_ANON_KEY?.trim()),
    supabaseServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
    stripe: Boolean(process.env.STRIPE_SECRET_KEY?.trim()),
    stripeWebhook: Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim()),
    google: Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim()),
    openai: Boolean(process.env.OPENAI_API_KEY?.trim()),
    corsOrigins: corsOrigins.length > 0 ? corsOrigins : ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:5174'],
  };
}
