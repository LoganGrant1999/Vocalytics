import { createClient } from '@supabase/supabase-js';
import { tryConsumeAnalyze, tryConsumeReply } from '../db/usage.js';
import { getCaps, getPublicUrls } from '../config/env.js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface Profile {
  id: string;
  tier: 'free' | 'pro';
  subscription_status: string | null;
  subscribed_until: string | null;
  comments_analyzed_count: number;
  replies_generated_count: number;
}

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

export function isPro(profile: Profile): boolean {
  // User is pro if:
  // 1. Tier is explicitly 'pro'
  // 2. Subscription status is 'active'
  // 3. Subscribed until date is in the future
  if (profile.tier === 'pro') return true;
  if (profile.subscription_status === 'active') return true;
  if (profile.subscribed_until) {
    const until = new Date(profile.subscribed_until);
    if (until > new Date()) return true;
  }
  return false;
}

export async function enforceAnalyze(params: {
  userDbId: string;
  incrementBy: number;
}): Promise<{ allowed: true } | { allowed: false; error: PaywallError }> {
  const { userDbId, incrementBy } = params;

  console.log('[paywall] enforceAnalyze called:', {
    userDbId,
    hasServiceKey: !!SUPABASE_SERVICE_KEY,
    serviceKeyPrefix: SUPABASE_SERVICE_KEY?.substring(0, 20),
  });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, tier, subscription_status, subscribed_until, comments_analyzed_count, replies_generated_count')
    .eq('id', userDbId)
    .single();

  console.log('[paywall] Query result:', {
    userDbId,
    hasProfile: !!profile,
    profileId: profile?.id,
    tier: profile?.tier,
    errorCode: error?.code,
    errorMessage: error?.message,
    errorDetails: error?.details,
  });

  if (error || !profile) {
    console.error('[paywall] User not found:', {
      userDbId,
      error: error?.message,
      errorCode: error?.code,
      errorDetails: error?.details,
      errorHint: error?.hint,
    });
    throw new Error(`User not found: ${userDbId} - ${error?.message || 'No profile data'}`);
  }

  // Pro users always allowed (no quota tracking needed)
  if (isPro(profile)) {
    return { allowed: true };
  }

  // Try to atomically consume quota for free tier
  const caps = getCaps();
  console.log(`[paywall] enforceAnalyze: userDbId=${userDbId}, cap=${caps.weeklyAnalyze}, incrementBy=${incrementBy}`);

  const result = await tryConsumeAnalyze({
    userDbId,
    cap: caps.weeklyAnalyze,
    incrementBy
  });

  console.log(`[paywall] enforceAnalyze result:`, result);

  if (!result.allowed) {
    // Get current counts for error message
    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('comments_analyzed_count, replies_generated_count')
      .eq('id', userDbId)
      .single();

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
          commentsAnalyzed: currentProfile?.comments_analyzed_count ?? 0,
          repliesGenerated: currentProfile?.replies_generated_count ?? 0
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

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, tier, subscription_status, subscribed_until, comments_analyzed_count, replies_generated_count')
    .eq('id', userDbId)
    .single();

  if (error || !profile) {
    console.error('[paywall] User not found:', { userDbId, error: error?.message });
    throw new Error(`User not found: ${userDbId}`);
  }

  // Pro users always allowed (no quota tracking needed)
  if (isPro(profile)) {
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
    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('comments_analyzed_count, replies_generated_count')
      .eq('id', userDbId)
      .single();

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
          commentsAnalyzed: currentProfile?.comments_analyzed_count ?? 0,
          repliesGenerated: currentProfile?.replies_generated_count ?? 0
        }
      }
    };
  }

  return { allowed: true };
}
