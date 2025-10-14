import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PricingTable } from '@/components/PricingTable';
import { UsageMeter } from '@/components/UsageMeter';
import { useSession } from '@/hooks/useSession';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { trackEvent } from '@/lib/analytics';

export default function Billing() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { session, isLoading, refetch } = useSession();

  // Handle Stripe return
  useEffect(() => {
    const status = searchParams.get('checkout');

    if (status === 'success') {
      // Poll for tier update
      let pollCount = 0;
      const maxPolls = 10;

      const checkTier = async () => {
        const result = await refetch();

        if (result.data?.tier === 'pro') {
          trackEvent({ name: 'checkout_success' });
          toast.success('Pro activated!', {
            description: 'Your account has been upgraded to Pro.',
            icon: <CheckCircle2 className="h-4 w-4" />,
            duration: 5000,
          });
          setSearchParams({});
          return true;
        }

        pollCount++;
        if (pollCount < maxPolls) {
          setTimeout(checkTier, 2000);
        } else {
          toast.info('Upgrade processing', {
            description: 'Your upgrade is being processed. Refresh in a moment.',
          });
          setSearchParams({});
        }
      };

      checkTier();
    } else if (status === 'canceled') {
      toast.info('Checkout canceled', {
        description: 'No charges were made.',
      });
      setSearchParams({});
    }
  }, [searchParams, refetch, setSearchParams]);

  const FREE_ANALYZE_LIMIT = 2; // per week
  const FREE_REPLY_LIMIT = 1; // per day

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-2">Choose Your Plan</h2>
        <p className="text-muted-foreground">
          Start free and upgrade when you need more
        </p>
      </div>

      <PricingTable currentTier={session?.tier} />

      {/* Current Usage */}
      {session && (
        <div className="rounded-lg border p-6 max-w-5xl mx-auto">
          <h3 className="text-lg font-semibold mb-4">Current Usage</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <UsageMeter
              label="Sentiment Analyses"
              used={session.comments_analyzed_count}
              limit={session.tier === 'free' ? FREE_ANALYZE_LIMIT : 999999}
              period="this week"
            />
            <UsageMeter
              label="AI Replies"
              used={session.replies_generated_count}
              limit={session.tier === 'free' ? FREE_REPLY_LIMIT : 999999}
              period="today"
            />
          </div>
        </div>
      )}
    </div>
  );
}
