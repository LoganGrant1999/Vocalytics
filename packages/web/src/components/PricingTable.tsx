import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';
import { useUpgrade } from '@/hooks/useUpgrade';

interface PricingTableProps {
  currentTier?: 'free' | 'pro';
}

/**
 * Pricing comparison table for Free vs Pro tiers.
 */
export function PricingTable({ currentTier = 'free' }: PricingTableProps) {
  const { startCheckout, openPortal, isLoading } = useUpgrade();

  const tiers = [
    {
      name: 'Free',
      price: '$0',
      period: 'forever',
      description: 'Perfect for trying out Vocalytics',
      features: [
        '2 sentiment analyses per week',
        '1 AI reply per day',
        'Basic comment insights',
        'Community support',
      ],
      cta: currentTier === 'free' ? 'Current Plan' : null,
      onClick: null,
    },
    {
      name: 'Pro',
      price: '$29',
      period: 'month',
      description: 'For creators who want to save time',
      features: [
        'Unlimited sentiment analyses',
        'Unlimited AI replies',
        'Advanced engagement insights',
        'Priority support',
        'Export reports',
        'Cancel anytime',
      ],
      cta: currentTier === 'pro' ? 'Manage Subscription' : 'Upgrade to Pro',
      onClick: currentTier === 'pro' ? openPortal : startCheckout,
      highlighted: true,
    },
  ];

  return (
    <div className="grid gap-6 md:grid-cols-2 max-w-5xl mx-auto">
      {tiers.map((tier) => (
        <div
          key={tier.name}
          className={`rounded-lg border p-6 ${
            tier.highlighted
              ? 'border-primary shadow-lg relative'
              : 'border-border'
          }`}
        >
          {tier.highlighted && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-semibold">
                RECOMMENDED
              </span>
            </div>
          )}

          <div className="mb-6">
            <h3 className="text-2xl font-bold mb-2">{tier.name}</h3>
            <div className="flex items-baseline gap-1 mb-2">
              <span className="text-4xl font-bold">{tier.price}</span>
              <span className="text-muted-foreground">/{tier.period}</span>
            </div>
            <p className="text-sm text-muted-foreground">{tier.description}</p>
          </div>

          <ul className="space-y-3 mb-6">
            {tier.features.map((feature, index) => (
              <li key={index} className="flex items-start gap-2">
                <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <span className="text-sm">{feature}</span>
              </li>
            ))}
          </ul>

          {tier.cta && tier.onClick && (
            <Button
              size="lg"
              className="w-full"
              variant={tier.highlighted ? 'default' : 'outline'}
              onClick={tier.onClick}
              disabled={isLoading}
            >
              {isLoading ? 'Loading...' : tier.cta}
            </Button>
          )}

          {tier.cta && !tier.onClick && (
            <Button
              size="lg"
              className="w-full"
              variant="outline"
              disabled
            >
              {tier.cta}
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
