// testAuth.ts — utilities for mocking auth & paywall in route tests
export const TEST_USER = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "test@example.com",
  tier: "pro",
};

export const fakeVerifyToken = async (req: any, _reply: any) => {
  // Set up req.auth to match what the auth plugin does
  req.auth = {
    userId: TEST_USER.id,
    userDbId: TEST_USER.id,
    email: TEST_USER.email,
    tier: TEST_USER.tier
  };
  // Also set req.user for compatibility with older code
  req.user = { id: TEST_USER.id, email: TEST_USER.email, tier: TEST_USER.tier };
};

export const noopQuota = async () => {
  // Allow all requests
};

export const blockingQuota = async (_req: any, reply: any) => {
  // Block all requests with 402
  return reply.code(402).send({
    code: 'PAYWALL',
    reason: 'FREE_TIER_EXCEEDED',
    feature: 'analyze',
    upgradeUrl: 'https://example.com/upgrade',
  });
};

let quotaCallCount = 0;
export const oneShotQuota = async (_req: any, reply: any) => {
  // Useful for 402 tests: allow first call, block subsequent
  quotaCallCount++;
  if (quotaCallCount > 1) {
    return reply.code(402).send({
      code: 'PAYWALL',
      reason: 'FREE_TIER_EXCEEDED',
      feature: 'analyze',
      upgradeUrl: 'https://example.com/upgrade',
    });
  }
};

export function resetQuotaCount() {
  quotaCallCount = 0;
}
