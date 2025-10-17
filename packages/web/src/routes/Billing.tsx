import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PricingTable } from '@/components/PricingTable';
import { UsageMeter } from '@/components/UsageMeter';
import { useSession } from '@/hooks/useSession';
import { CheckCircle2, Loader2, Calendar, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { trackEvent } from '@/lib/analytics';

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

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

  // Get subscription date info
  console.log('[Billing] Session data:', {
    tier: session?.tier,
    subscription_status: session?.subscription_status,
    next_payment_date: session?.next_payment_date,
    cancel_at_period_end: session?.cancel_at_period_end,
    subscribed_until: session?.subscribed_until,
  });

  const showNextPayment = session?.tier === 'pro' &&
    session?.subscription_status === 'active' &&
    !session?.cancel_at_period_end &&
    session?.next_payment_date;

  const showExpirationDate = session?.tier === 'pro' &&
    session?.cancel_at_period_end &&
    (session?.next_payment_date || session?.subscribed_until);

  console.log('[Billing] Show flags:', { showNextPayment, showExpirationDate });

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-2">Choose Your Plan</h2>
        <p className="text-muted-foreground">
          Start free and upgrade when you need more
        </p>
      </div>

      {showNextPayment && (
        <div className="max-w-2xl mx-auto bg-primary/5 border border-primary/20 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Calendar className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-sm">Next Payment</p>
              <p className="text-sm text-muted-foreground">
                Your subscription will renew on {formatDate(session.next_payment_date!)}
              </p>
            </div>
          </div>
        </div>
      )}

      {showExpirationDate && (
        <div className="max-w-2xl mx-auto bg-orange-500/5 border border-orange-500/20 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-sm">Subscription Cancelled</p>
              <p className="text-sm text-muted-foreground">
                You'll have Pro features until {formatDate(session.next_payment_date || session.subscribed_until!)}
              </p>
            </div>
          </div>
        </div>
      )}

      <PricingTable currentTier={session?.tier} />
    </div>
  );
}
