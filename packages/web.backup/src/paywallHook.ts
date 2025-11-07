/**
 * Paywall UI hook for web widgets
 * Renders a simple upgrade prompt when free tier limits are exceeded
 */

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

export function renderPaywallUI(error: PaywallError): string {
  const { feature, upgradeUrl, manageUrl, limits, usage } = error;

  const featureName = feature === 'analyze' ? 'comment analysis' : 'reply generation';
  const limit = feature === 'analyze'
    ? `${limits.weeklyAnalyze} comments/week`
    : `${limits.dailyReply} replies/day`;

  return `
    <div style="
      padding: 24px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 12px;
      color: white;
      font-family: system-ui, -apple-system, sans-serif;
      text-align: center;
    ">
      <div style="font-size: 48px; margin-bottom: 16px;">🚀</div>

      <h2 style="
        margin: 0 0 12px 0;
        font-size: 24px;
        font-weight: 600;
      ">
        Free Limit Reached
      </h2>

      <p style="
        margin: 0 0 8px 0;
        font-size: 16px;
        opacity: 0.95;
      ">
        You've used your free ${featureName} quota (${limit}).
      </p>

      <p style="
        margin: 0 0 24px 0;
        font-size: 14px;
        opacity: 0.85;
      ">
        Current usage: ${usage.commentsAnalyzed} comments analyzed, ${usage.repliesGenerated} replies generated
      </p>

      <div style="
        display: flex;
        gap: 12px;
        justify-content: center;
        flex-wrap: wrap;
      ">
        <a href="${upgradeUrl}" target="_blank" style="
          display: inline-block;
          padding: 12px 24px;
          background: white;
          color: #667eea;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 16px;
          transition: transform 0.2s;
        ">
          ✨ Upgrade to Pro
        </a>

        <a href="${manageUrl}" target="_blank" style="
          display: inline-block;
          padding: 12px 24px;
          background: rgba(255, 255, 255, 0.2);
          color: white;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 500;
          font-size: 16px;
          transition: transform 0.2s;
        ">
          Manage Billing
        </a>
      </div>

      <p style="
        margin: 20px 0 0 0;
        font-size: 12px;
        opacity: 0.75;
      ">
        Pro: Unlimited usage • Priority support • Advanced features
      </p>
    </div>
  `;
}

export function isPaywallError(data: any): data is PaywallError {
  return data && data.code === 'PAYWALL';
}

export function handleApiResponse(data: any, normalRenderFn: (data: any) => string): string {
  if (isPaywallError(data)) {
    return renderPaywallUI(data);
  }
  return normalRenderFn(data);
}
