import KpiCard from "@/components/shared/KpiCard";
import PriorityQueueCard from "@/components/shared/PriorityQueueCard";
import VoiceProfileCard from "@/components/shared/VoiceProfileCard";
import UpgradeBanner from "@/components/shared/UpgradeBanner";

interface DashboardPageProps {
  plan: "free" | "pro";
}

const DashboardPage = ({ plan }: DashboardPageProps) => {
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
