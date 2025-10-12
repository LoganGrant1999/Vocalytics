import { getUserById } from '../db/users.js';
import { tryConsumeAnalyze, tryConsumeReply, recordUsage } from '../db/usage.js';
import type { User } from '../db/client.js';
import { getCaps, getPublicUrls } from '../config/env.js';

export interface PaywallError {
  code: 'PAYWALL';
  reason: 'FREE_TIER_EXCEEDED';
  feature: 'analyze' | 'reply';
  upgradeUrl: string;
  manageUrl: string;
  limits: {
    weeklyAnalyze: number;
    dailyReply: number;
  };
  usage: {
    commentsAnalyzed: number;
    repliesGenerated: number;
  };
}

export function isPro(user: User): boolean {
  // User is pro if:
  // 1. Tier is explicitly 'pro'
  // 2. Subscription status is 'active'
  // 3. Subscribed until date is in the future
  if (user.tier === 'pro') return true;
  if (user.subscription_status === 'active') return true;
  if (user.subscribed_until) {
    const until = new Date(user.subscribed_until);
    if (until > new Date()) return true;
  }
  return false;
}

export async function enforceAnalyze(params: {
  userDbId: string;
  incrementBy: number;
}): Promise<{ allowed: true } | { allowed: false; error: PaywallError }> {
  const { userDbId, incrementBy } = params;

  const user = await getUserById(userDbId);
  if (!user) {
    throw new Error('User not found');
  }

  // Pro users always allowed
  if (isPro(user)) {
    await recordUsage({
      userId: userDbId,
      action: 'analyze',
      count: incrementBy,
      metadata: { tier: 'pro' }
    });
    return { allowed: true };
  }

  // Try to atomically consume quota for free tier
  const caps = getCaps();
  const result = await tryConsumeAnalyze({
    userDbId,
    cap: caps.weeklyAnalyze,
    incrementBy
  });

  if (!result.allowed) {
    // Get current counts for error message
    const currentUser = await getUserById(userDbId);
    const urls = getPublicUrls();
    return {
      allowed: false,
      error: {
        code: 'PAYWALL',
        reason: 'FREE_TIER_EXCEEDED',
        feature: 'analyze',
        upgradeUrl: urls.pricingUrl,
        manageUrl: urls.billingUrl,
        limits: {
          weeklyAnalyze: caps.weeklyAnalyze,
          dailyReply: caps.dailyReply
        },
        usage: {
          commentsAnalyzed: currentUser?.comments_analyzed_count ?? 0,
          repliesGenerated: currentUser?.replies_generated_count ?? 0
        }
      }
    };
  }

  return { allowed: true };
}

export async function enforceReply(params: {
  userDbId: string;
  incrementBy: number;
}): Promise<{ allowed: true } | { allowed: false; error: PaywallError }> {
  const { userDbId, incrementBy } = params;

  const user = await getUserById(userDbId);
  if (!user) {
    throw new Error('User not found');
  }

  // Pro users always allowed
  if (isPro(user)) {
    await recordUsage({
      userId: userDbId,
      action: 'reply',
      count: incrementBy,
      metadata: { tier: 'pro' }
    });
    return { allowed: true };
  }

  // Try to atomically consume quota for free tier
  const caps = getCaps();
  const result = await tryConsumeReply({
    userDbId,
    cap: caps.dailyReply,
    incrementBy
  });

  if (!result.allowed) {
    // Get current counts for error message
    const currentUser = await getUserById(userDbId);
    const urls = getPublicUrls();
    return {
      allowed: false,
      error: {
        code: 'PAYWALL',
        reason: 'FREE_TIER_EXCEEDED',
        feature: 'reply',
        upgradeUrl: urls.pricingUrl,
        manageUrl: urls.billingUrl,
        limits: {
          weeklyAnalyze: caps.weeklyAnalyze,
          dailyReply: caps.dailyReply
        },
        usage: {
          commentsAnalyzed: currentUser?.comments_analyzed_count ?? 0,
          repliesGenerated: currentUser?.replies_generated_count ?? 0
        }
      }
    };
  }

  return { allowed: true };
}
