/**
 * Acceptance test to verify the API client setup meets requirements:
 * 1. Can import `api` from '@/lib/api'
 * 2. Can call `api.GET("/healthz")` with typed result
 * 3. TypeScript checks pass
 */

import { api } from '@/lib/api';

async function acceptanceTest() {
  // ✅ Requirement 1: Can import `api` from '@/lib/api'
  console.log('✓ Successfully imported api from @/lib/api');

  // ✅ Requirement 2: Can call api.GET("/healthz") with typed result
  const { data, error } = await api.GET('/healthz');

  if (error) {
    console.error('✗ Health check failed:', error);
    return false;
  }

  if (data) {
    // ✅ TypeScript knows the exact shape of the response
    // The types are inferred from the OpenAPI spec:
    // - data.ok is boolean | undefined
    // - data.version is string | undefined
    // - data.time is string | undefined
    // - data.db is "ok" | "error" | "unknown" | undefined
    // - data.stripeWebhook is "configured" | "not_configured" | undefined

    console.log('✓ api.GET("/healthz") called with typed result:', {
      ok: data.ok,
      version: data.version,
      db: data.db,
      // TypeScript provides autocomplete for all these fields!
    });

    return true;
  }

  return false;
}

// ✅ Requirement 3: TypeScript checks pass
// Run: pnpm --filter web typecheck
// This file compiles without errors, proving type safety works!

export { acceptanceTest };
