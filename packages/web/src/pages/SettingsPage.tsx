import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Youtube, User, AlertCircle, Crown, Check, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

const SettingsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleConnectYouTube = () => {
    navigate("/connect");
  };

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and connections.
        </p>
      </div>

      {/* User Information */}
      <Card className="p-6">
        <div className="flex items-start gap-4">
          <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center">
            <User className="h-8 w-8 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold mb-1">{user?.name || "User"}</h2>
            <p className="text-muted-foreground mb-3">{user?.email}</p>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium">
              {user?.tier === "pro" ? "Pro" : "Free"} Plan
            </div>
          </div>
        </div>
      </Card>

      {/* YouTube Connection */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">YouTube Connection</h2>

        {user?.hasYouTubeConnected ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-success/10 border border-success/20">
              <Youtube className="h-6 w-6 text-success" />
              <div className="flex-1">
                <p className="font-medium text-success">YouTube Connected</p>
                <p className="text-sm text-muted-foreground">
                  Your YouTube account is connected and active
                </p>
              </div>
            </div>
            <Button
              onClick={handleConnectYouTube}
              variant="outline"
              className="w-full sm:w-auto"
            >
              <Youtube className="w-4 h-4 mr-2" />
              Reconnect YouTube
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                YouTube account not connected. Connect your account to start managing comments.
              </AlertDescription>
            </Alert>
            <Button
              onClick={handleConnectYouTube}
              className="w-full sm:w-auto"
            >
              <Youtube className="w-4 h-4 mr-2" />
              Connect YouTube
            </Button>
          </div>
        )}

        <div className="mt-6 p-4 rounded-lg bg-muted">
          <p className="text-sm text-muted-foreground">
            <strong>Note:</strong> Currently supports one YouTube account. Multiple account support coming soon!
          </p>
        </div>
      </Card>

      {/* Upgrade to Pro (Free tier only) */}
      {user?.tier === "free" && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Unlock Pro Features</h2>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
              <Crown className="w-3 h-3" />
              Pro Only
            </div>
          </div>

          <p className="text-sm text-muted-foreground mb-6">
            You're on the Free plan. Upgrade to Pro for just $10/month to unlock these powerful features:
          </p>

          <div className="space-y-4 mb-6">
            {/* Features you have */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase">What you have now</p>
              <div className="space-y-2">
                <div className="flex items-start gap-3">
                  <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Unlimited video analysis</span>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Unlimited AI reply generation</span>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Basic voice profile</span>
                </div>
              </div>
            </div>

            {/* Features missing */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase">Missing Pro features</p>
              <div className="space-y-2">
                <div className="flex items-start gap-3">
                  <X className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-muted-foreground"><strong className="text-foreground">Post replies to YouTube</strong> - Free users can only generate, not post</span>
                </div>
                <div className="flex items-start gap-3">
                  <X className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-muted-foreground"><strong className="text-foreground">Batch send approved replies</strong> - Select and post multiple replies at once</span>
                </div>
                <div className="flex items-start gap-3">
                  <X className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-muted-foreground"><strong className="text-foreground">Auto-prioritize top 100 comments</strong> - Get instant priority scoring</span>
                </div>
                <div className="flex items-start gap-3">
                  <X className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-muted-foreground"><strong className="text-foreground">Daily engagement analytics</strong> - Track trends and insights</span>
                </div>
                <div className="flex items-start gap-3">
                  <X className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-muted-foreground"><strong className="text-foreground">Advanced voice profile customization</strong> - Fine-tune AI reply tone</span>
                </div>
              </div>
            </div>
          </div>

          {/* Upgrade CTA */}
          <div className="pt-4 border-t border-border">
            <Button
              onClick={() => navigate("/app/billing")}
              className="w-full bg-primary hover:bg-primary/90"
            >
              <Crown className="w-4 h-4 mr-2" />
              Upgrade to Pro - $10/month
            </Button>
          </div>
        </Card>
      )}

      {/* Pro Plan Benefits */}
      {user?.tier === "pro" && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Your Pro Benefits</h2>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
              <Crown className="w-3 h-3" />
              Pro
            </div>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            You have full access to all Vocalytics features.
          </p>
          <div className="space-y-2">
            <div className="flex items-start gap-3">
              <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span className="text-sm"><strong>Post replies to YouTube</strong> - Publish AI-generated replies instantly</span>
            </div>
            <div className="flex items-start gap-3">
              <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span className="text-sm"><strong>Batch send approved replies</strong> - Select and post multiple replies at once</span>
            </div>
            <div className="flex items-start gap-3">
              <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span className="text-sm"><strong>Auto-prioritize top 100 comments</strong> - Get instant priority scoring</span>
            </div>
            <div className="flex items-start gap-3">
              <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span className="text-sm"><strong>Daily engagement analytics</strong> - Track trends and insights</span>
            </div>
            <div className="flex items-start gap-3">
              <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span className="text-sm"><strong>Advanced voice profile customization</strong> - Fine-tune AI reply tone</span>
            </div>
            <div className="flex items-start gap-3">
              <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span className="text-sm">Unlimited video analysis</span>
            </div>
            <div className="flex items-start gap-3">
              <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span className="text-sm">Unlimited AI reply generation</span>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-border">
            <Button
              onClick={() => navigate("/app/billing")}
              variant="outline"
              className="w-full sm:w-auto"
            >
              Manage Billing
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};

export default SettingsPage;
