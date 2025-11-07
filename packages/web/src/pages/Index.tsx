import { useState } from "react";
import AppShell from "./AppShell";
import LandingPage from "./LandingPage";
import DashboardPage from "./DashboardPage";
import CommentsPage from "./CommentsPage";
import VideosPage from "./VideosPage";
import VideoDetailPage from "./VideoDetailPage";
import VoiceProfilePage from "./VoiceProfilePage";
import BillingPage from "./BillingPage";

// Demo component to showcase the app with mock data
const Index = () => {
  const [currentView, setCurrentView] = useState<"landing" | "app">("app");
  const [currentPage, setCurrentPage] = useState<"dashboard" | "comments" | "videos" | "video-detail" | "voice" | "billing">("dashboard");

  if (currentView === "landing") {
    return <LandingPage />;
  }

  // Render different pages inside AppShell
  const renderPage = () => {
    switch (currentPage) {
      case "dashboard":
        return <DashboardPage plan="free" />;
      case "comments":
        return <CommentsPage plan="free" />;
      case "videos":
        return <VideosPage />;
      case "video-detail":
        return <VideoDetailPage plan="free" videoTitle="How I Film Cinematic B-Roll in 10 Minutes" publishedAt="2 days ago" sentimentSummary="Mostly positive. Viewers love the mic quality and editing." />;
      case "voice":
        return <VoiceProfilePage />;
      case "billing":
        return <BillingPage plan="free" />;
      default:
        return <DashboardPage plan="free" />;
    }
  };

  return (
    <AppShell plan="free" channelName="TechByDylan">
      {renderPage()}
    </AppShell>
  );
};

export default Index;
