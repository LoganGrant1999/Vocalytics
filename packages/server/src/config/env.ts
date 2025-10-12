/**
 * Centralized environment variable parsing
 * Reads process.env at call time (not at module load) to ensure fresh values
 */

export function getCaps() {
  const weekly = Number(process.env.FREE_LIMIT_ANALYZE_WEEKLY ?? 2);
  const daily = Number(process.env.FREE_LIMIT_REPLY_DAILY ?? 1);

  const weeklyAnalyze = Number.isFinite(weekly) && weekly > 0 ? Math.floor(weekly) : 2;
  const dailyReply = Number.isFinite(daily) && daily > 0 ? Math.floor(daily) : 1;

  return { weeklyAnalyze, dailyReply };
}

export function getPublicUrls() {
  return {
    pricingUrl: process.env.PUBLIC_PRICING_URL || 'https://yourapp.com/pricing',
    billingUrl: process.env.PUBLIC_BILLING_URL || 'https://yourapp.com/billing'
  };
}
