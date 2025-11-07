import KpiCard from "@/components/shared/KpiCard";
import PriorityQueueCard from "@/components/shared/PriorityQueueCard";
import VoiceProfileCard from "@/components/shared/VoiceProfileCard";
import UpgradeBanner from "@/components/shared/UpgradeBanner";
import { Youtube, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

interface DashboardPageProps {
  plan: "free" | "pro";
}

const DashboardPage = ({ plan }: DashboardPageProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const hasYouTubeConnected = user?.hasYouTubeConnected || false;

  const handleConnectYouTube = () => {
    navigate("/connect");
  };

  if (!hasYouTubeConnected) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
          <p className="text-muted-foreground">
            Your engagement control center
          </p>
        </div>
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
          value="482"
          sublabel="+12% vs last video"
        />
        <KpiCard
          label="High-Priority To Reply"
          value="17"
          sublabel="Most valuable fans & questions"
          tone="warning"
        />
        <KpiCard
          label="Replies Ready To Send"
          value="17"
          sublabel="Drafted in your voice"
          tone="success"
        />
        <KpiCard
          label="Time Saved Today"
          value="51 min"
          sublabel="via SmartBatch Reply"
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
