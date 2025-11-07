import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Youtube, User, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";

interface UsageData {
  analyze_weekly_count: number;
  analyze_weekly_limit: number;
  reply_daily_count: number;
  reply_daily_limit: number;
  period_start: string;
}

const SettingsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchUsage = async () => {
      try {
        setIsLoading(true);
        const data = await api.getUsage();
        setUsage(data);
      } catch (err: any) {
        console.error("Failed to fetch usage:", err);
        setError(err.message || "Failed to load usage data");
      } finally {
        setIsLoading(false);
      }
    };

    if (user?.tier === "free") {
      fetchUsage();
    } else {
      setIsLoading(false);
    }
  }, [user]);

  const handleConnectYouTube = () => {
    navigate("/connect");
  };

  const analyzeProgress = usage
    ? (usage.analyze_weekly_count / usage.analyze_weekly_limit) * 100
    : 0;
  const replyProgress = usage
    ? (usage.reply_daily_count / usage.reply_daily_limit) * 100
    : 0;

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account, connections, and usage limits.
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

      {/* Usage Limits (Free tier only) */}
      {user?.tier === "free" && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Usage Limits</h2>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : usage ? (
            <div className="space-y-6">
              {/* Weekly Analysis Limit */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium">Video Analysis</p>
                  <p className="text-sm text-muted-foreground">
                    {usage.analyze_weekly_count} / {usage.analyze_weekly_limit} this week
                  </p>
                </div>
                <Progress value={analyzeProgress} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1">
                  Resets weekly
                </p>
              </div>

              {/* Daily Reply Limit */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium">AI Replies</p>
                  <p className="text-sm text-muted-foreground">
                    {usage.reply_daily_count} / {usage.reply_daily_limit} today
                  </p>
                </div>
                <Progress value={replyProgress} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1">
                  Resets daily
                </p>
              </div>

              {/* Upgrade CTA */}
              <div className="mt-6 p-4 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-sm mb-3">
                  Want unlimited access? Upgrade to Pro for unlimited video analysis and AI replies.
                </p>
                <Button
                  onClick={() => navigate("/app/billing")}
                  className="w-full sm:w-auto"
                >
                  Upgrade to Pro
                </Button>
              </div>
            </div>
          ) : null}
        </Card>
      )}

      {/* Pro Plan Benefits */}
      {user?.tier === "pro" && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Pro Plan Benefits</h2>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-success"></div>
              <p className="text-sm">Unlimited video analysis</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-success"></div>
              <p className="text-sm">Unlimited AI-powered replies</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-success"></div>
              <p className="text-sm">Priority support</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-success"></div>
              <p className="text-sm">Advanced voice profile customization</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default SettingsPage;
