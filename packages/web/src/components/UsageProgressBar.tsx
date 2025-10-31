import { useEffect, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { Infinity } from 'lucide-react';

interface UsageStats {
  plan: 'free' | 'pro';
  monthlyUsed: number;
  monthlyLimit: number | null;
  dailyPosted: number;
  dailyPostCap: number | null;
  queued: number;
  resets: {
    month: string;
    day: string;
  };
}

export function UsageProgressBar() {
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUsage() {
      try {
        const res = await fetch('/api/me/usage', {
          credentials: 'include',
        });

        if (!res.ok) {
          // If 404, user might not have usage data initialized yet
          if (res.status === 404) {
            setError(null);
            setLoading(false);
            return;
          }
          throw new Error('Failed to fetch usage stats');
        }

        const data = await res.json();
        setUsage(data);
      } catch (err: any) {
        console.error('Error fetching usage:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchUsage();
  }, []);

  if (loading) {
    return (
      <div className="rounded-lg border p-4 animate-pulse">
        <div className="h-4 bg-muted rounded w-1/4 mb-2"></div>
        <div className="h-2 bg-muted rounded"></div>
      </div>
    );
  }

  if (error) {
    return null; // Fail silently
  }

  if (!usage) {
    return null;
  }

  const { plan, monthlyUsed, monthlyLimit, dailyPosted, dailyPostCap, queued } = usage;

  // Pro plan with unlimited monthly
  if (plan === 'pro' && monthlyLimit === null) {
    return (
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Infinity className="h-5 w-5 text-primary" />
            <span className="font-semibold">Unlimited AI Replies</span>
          </div>
          <span className="text-sm text-muted-foreground">Pro Plan</span>
        </div>

        {dailyPostCap !== null && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Daily posting</span>
              <span className="font-medium">
                {dailyPosted} / {dailyPostCap}
              </span>
            </div>
            <Progress
              value={(dailyPosted / dailyPostCap) * 100}
              className="h-2"
            />
            <p className="text-xs text-muted-foreground">
              Fair-use cap: {dailyPostCap} posts/day
            </p>
          </div>
        )}

        {queued > 0 && (
          <p className="text-xs text-muted-foreground">
            {queued} {queued === 1 ? 'reply' : 'replies'} queued for tomorrow
          </p>
        )}
      </div>
    );
  }

  // Free plan with monthly limit
  const percentage = monthlyLimit ? (monthlyUsed / monthlyLimit) * 100 : 0;
  const isNearLimit = percentage >= 80;
  const isAtLimit = monthlyLimit !== null && monthlyUsed >= monthlyLimit;

  return (
    <div className={`rounded-lg border p-4 space-y-3 ${isNearLimit ? 'border-warning' : 'bg-card'}`}>
      <div className="flex items-center justify-between">
        <div>
          <span className="font-semibold">AI Replies</span>
          {isAtLimit && (
            <span className="ml-2 text-xs text-destructive font-medium">Limit Reached</span>
          )}
        </div>
        <span className="text-sm font-medium">
          {monthlyUsed} / {monthlyLimit === null ? '∞' : monthlyLimit}
        </span>
      </div>

      <Progress
        value={percentage}
        className={`h-2 ${isNearLimit ? 'bg-warning/20' : ''}`}
      />

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Resets {new Date(usage.resets.month).toLocaleDateString()}</span>
        {isNearLimit && !isAtLimit && plan === 'free' && (
          <a href="/billing" className="text-primary hover:underline">
            Upgrade to Pro
          </a>
        )}
      </div>

      {queued > 0 && (
        <p className="text-xs text-muted-foreground">
          {queued} {queued === 1 ? 'reply' : 'replies'} queued
        </p>
      )}
    </div>
  );
}
