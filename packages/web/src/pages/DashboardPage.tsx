import KpiCard from "@/components/shared/KpiCard";
import PriorityQueueCard from "@/components/shared/PriorityQueueCard";
import VoiceProfileCard from "@/components/shared/VoiceProfileCard";
import UpgradeBanner from "@/components/shared/UpgradeBanner";
import { Youtube, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

interface DashboardPageProps {
  plan: "free" | "pro";
}

const DashboardPage = ({ plan }: DashboardPageProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const hasYouTubeConnected = user?.hasYouTubeConnected || false;

  // Fetch dashboard stats (only from user's own videos)
  const { data: stats } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: () => api.getDashboardStats(),
    enabled: hasYouTubeConnected,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const handleConnectYouTube = () => {
    navigate("/connect");
  };

  if (!hasYouTubeConnected) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            YouTube account not connected. Please connect to view dashboard.
          </AlertDescription>
        </Alert>
        <Button onClick={handleConnectYouTube}>
          <Youtube className="w-4 h-4 mr-2" />
          Connect YouTube
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="New Comments (24h)"
          value={stats?.newComments24h?.toString() || "0"}
        />
        <KpiCard
          label="High-Priority To Reply"
          value={stats?.highPriorityToReply?.toString() || "0"}
          tone="warning"
        />
        <KpiCard
          label="Replies Ready To Send"
          value={stats?.repliesReady?.toString() || "0"}
          tone="success"
        />
        <KpiCard
          label="Time Saved Today"
          value={stats?.timeSavedMinutes ? `${stats.timeSavedMinutes} min` : "0 min"}
        />
      </div>
      {/* TODO: GET /api/youtube/comments + POST /api/analyze-comments */}

      {/* Main content: Priority Queue + Voice Profile */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <PriorityQueueCard plan={plan} />
        </div>
        <div>
          <VoiceProfileCard />
        </div>
      </div>

      {/* Upgrade Banner */}
      <UpgradeBanner plan={plan} />
    </div>
  );
};

export default DashboardPage;
