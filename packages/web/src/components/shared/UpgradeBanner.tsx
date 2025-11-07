import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

interface UpgradeBannerProps {
  plan: "free" | "pro";
}

const UpgradeBanner = ({ plan }: UpgradeBannerProps) => {
  const handleUpgrade = () => {
    console.log("TODO: POST /api/billing/checkout");
  };

  const handleManageBilling = () => {
    console.log("TODO: POST /api/billing/portal");
  };

  if (plan === "pro") {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">You're on Pro</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Enjoying unlimited AI replies and batch sending
        </p>
        <Button variant="outline" onClick={handleManageBilling}>
          Manage Billing
        </Button>
        {/* TODO: POST /api/billing/portal */}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-8 glow-border">
      <div className="flex items-center justify-center gap-2 mb-3">
        <Sparkles className="w-6 h-6 text-primary" />
        <h3 className="text-2xl font-bold">Unlock SmartBatch Pro</h3>
      </div>
      
      <div className="grid md:grid-cols-3 gap-4 mb-6 text-center">
        <div>
          <div className="text-sm font-semibold mb-1">Batch send replies</div>
          <div className="text-xs text-muted-foreground">Approve once, send hundreds</div>
        </div>
        <div>
          <div className="text-sm font-semibold mb-1">Auto-prioritize top 100</div>
          <div className="text-xs text-muted-foreground">Never miss valuable fans</div>
        </div>
        <div>
          <div className="text-sm font-semibold mb-1">Daily analytics</div>
          <div className="text-xs text-muted-foreground">Track engagement trends</div>
        </div>
      </div>

      <div className="flex justify-center">
        <Button
          onClick={handleUpgrade}
          size="lg"
          className="bg-primary hover:bg-primary/90 glow-accent text-lg px-8"
        >
          Upgrade to Pro
        </Button>
      </div>
      {/* TODO: POST /api/billing/checkout */}
    </div>
  );
};

export default UpgradeBanner;
