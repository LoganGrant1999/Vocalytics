import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import PlanBadge from "@/components/shared/PlanBadge";
import api from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

interface BillingPageProps {
  plan: "free" | "pro";
}

const BillingPage = ({ plan }: BillingPageProps) => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleUpgrade = async () => {
    setIsLoading(true);
    setError("");

    try {
      const { url } = await api.createCheckoutSession();
      // Redirect to Stripe checkout
      window.location.href = url;
    } catch (err: any) {
      console.error("Checkout error:", err);
      setError(err.message || "Failed to start checkout");
      setIsLoading(false);
    }
  };

  const handleManageBilling = async () => {
    setIsLoading(true);
    setError("");

    try {
      const { url } = await api.createPortalSession();
      // Redirect to Stripe customer portal
      window.location.href = url;
    } catch (err: any) {
      console.error("Portal error:", err);
      setError(err.message || "Failed to open billing portal");
      setIsLoading(false);
    }
  };

  // Format subscription date
  const formatSubscriptionDate = () => {
    if (!user?.subscribed_until) return null;

    const date = new Date(user.subscribed_until);
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };

    const formattedDate = date.toLocaleDateString('en-US', options);
    const isCancelled = user.subscription_status === 'canceled';

    return isCancelled
      ? `Active until ${formattedDate}`
      : `Next charge on ${formattedDate}`;
  };

  return (
    <div className="max-w-5xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">Billing & Plans</h1>
        <p className="text-muted-foreground">Manage your subscription and billing details.</p>
      </div>

      {/* Error alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Current plan card */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold">Current Plan</h2>
            <PlanBadge plan={plan} />
          </div>
          {plan === "pro" && (
            <Button
              variant="outline"
              onClick={handleManageBilling}
              disabled={isLoading}
            >
              {isLoading ? "Loading..." : "Manage Billing"}
            </Button>
          )}
        </div>

        {plan === "pro" && formatSubscriptionDate() && (
          <p className="text-sm text-muted-foreground mb-4">
            {formatSubscriptionDate()}
          </p>
        )}

        {plan === "free" && (
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-primary" />
              Unlimited video analysis
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-primary" />
              Unlimited AI reply generation
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-primary" />
              Basic voice profile
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-muted" />
              Cannot post replies to YouTube
            </li>
          </ul>
        )}
      </div>

      {/* Plans grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Free plan */}
        <div className="rounded-2xl border border-border bg-card p-6">
          <h3 className="text-xl font-bold mb-2">Free</h3>
          <div className="text-3xl font-bold mb-4">$0<span className="text-lg text-muted-foreground">/mo</span></div>
          <ul className="space-y-3 mb-6 text-sm">
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <span>Unlimited video analysis</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <span>Unlimited AI reply generation</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <span>Basic voice profile</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-muted mt-0.5 flex-shrink-0" />
              <span className="text-muted-foreground">Cannot post replies to YouTube</span>
            </li>
          </ul>
          {plan === "free" ? (
            <Button variant="outline" disabled className="w-full">
              Current Plan
            </Button>
          ) : (
            <Button
              variant="outline"
              className="w-full"
              onClick={handleManageBilling}
              disabled={isLoading}
            >
              {isLoading ? "Loading..." : "Downgrade"}
            </Button>
          )}
        </div>

        {/* Pro plan */}
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-6 glow-border relative">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <span className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">
              RECOMMENDED
            </span>
          </div>
          
          <h3 className="text-xl font-bold mb-2">Pro</h3>
          <div className="text-3xl font-bold mb-4">$10<span className="text-lg text-muted-foreground">/mo</span></div>
          <ul className="space-y-3 mb-6 text-sm">
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <span><strong>Unlimited AI replies</strong></span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <span><strong>Batch send approved replies</strong></span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <span><strong>Auto-prioritize top 100 comments</strong></span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <span><strong>Daily engagement analytics</strong></span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <span>Advanced voice profile customization</span>
            </li>
          </ul>
          {plan === "pro" ? (
            <Button className="w-full bg-primary hover:bg-primary/90" disabled>
              Current Plan
            </Button>
          ) : (
            <Button
              onClick={handleUpgrade}
              className="w-full bg-primary hover:bg-primary/90 glow-accent"
              disabled={isLoading}
            >
              {isLoading ? "Loading..." : "Upgrade to Pro"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default BillingPage;
