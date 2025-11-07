import { useState } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { trackEvent } from '@/lib/analytics';

/**
 * Hook for handling Stripe checkout and upgrade flow.
 * Creates checkout session and redirects to Stripe.
 */
export function useUpgrade() {
  const [isLoading, setIsLoading] = useState(false);

  const startCheckout = async () => {
    setIsLoading(true);
    trackEvent({ name: 'checkout_started' });

    try {
      const result = await api.POST('/api/billing/checkout', {});

      if (result.error || !result.data?.url) {
        throw new Error('Failed to create checkout session');
      }

      // Redirect to Stripe checkout
      window.location.href = result.data.url;
    } catch (error) {
      setIsLoading(false);
      trackEvent({ name: 'checkout_failure', properties: { error: String(error) } });
      toast.error('Failed to start checkout', {
        description: 'Please try again or contact support.',
        action: {
          label: 'Retry',
          onClick: () => startCheckout(),
        },
      });
    }
  };

  const openPortal = async () => {
    setIsLoading(true);

    try {
      const result = await api.POST('/api/billing/portal', {});

      if (result.error || !result.data?.url) {
        throw new Error('Failed to create portal session');
      }

      // Redirect to Stripe customer portal
      window.location.href = result.data.url;
    } catch (error) {
      setIsLoading(false);
      toast.error('Failed to open billing portal', {
        description: 'Please try again or contact support.',
      });
    }
  };

  return {
    startCheckout,
    openPortal,
    isLoading,
  };
}
