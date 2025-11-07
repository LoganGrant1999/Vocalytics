import { Button } from '@/components/ui/button';
import { X, Zap, Clock, BarChart3, MessageSquare } from 'lucide-react';
import { useUpgrade } from '@/hooks/useUpgrade';

interface PaywallDialogProps {
  isOpen: boolean;
  onClose: () => void;
  feature: 'analyze' | 'reply';
}

/**
 * Modal dialog shown when free tier limits are hit.
 * Explains Pro benefits and provides upgrade CTA.
 */
export function PaywallDialog({ isOpen, onClose, feature }: PaywallDialogProps) {
  const { startCheckout, isLoading } = useUpgrade();

  if (!isOpen) return null;

  const features = [
    {
      icon: <BarChart3 className="h-5 w-5" />,
      title: 'Unlimited Analysis',
      description: 'Analyze comments on any video, any time',
    },
    {
      icon: <MessageSquare className="h-5 w-5" />,
      title: 'Unlimited AI Replies',
      description: 'Generate personalized replies for every comment',
    },
    {
      icon: <Clock className="h-5 w-5" />,
      title: 'Save Hours Weekly',
      description: 'Automate comment management and engagement',
    },
    {
      icon: <Zap className="h-5 w-5" />,
      title: 'Priority Support',
      description: 'Get help when you need it',
    },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-background rounded-lg shadow-lg z-50 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-2xl font-bold">Upgrade to Pro</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {feature === 'analyze'
                ? "You've reached your weekly analysis limit"
                : "You've reached your daily reply limit"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 hover:bg-accent transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Features Grid */}
          <div className="grid gap-4">
            {features.map((feature, index) => (
              <div key={index} className="flex items-start gap-3">
                <div className="rounded-lg bg-primary/10 p-2 text-primary">
                  {feature.icon}
                </div>
                <div>
                  <h3 className="font-semibold">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Pricing */}
          <div className="rounded-lg border bg-accent/50 p-4">
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-2xl font-bold">$29</span>
              <span className="text-sm text-muted-foreground">/month</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Cancel anytime. No questions asked.
            </p>
          </div>

          {/* CTA */}
          <div className="space-y-3">
            <Button
              size="lg"
              className="w-full"
              onClick={startCheckout}
              disabled={isLoading}
            >
              {isLoading ? 'Loading...' : 'Upgrade to Pro'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={onClose}
            >
              Maybe later
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
