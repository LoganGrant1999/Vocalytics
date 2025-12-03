import { Menu, LogOut } from "lucide-react";
import ChannelStatusBadge from "./ChannelStatusBadge";
import { Button } from "@/components/ui/button";
import { useNavigate, useLocation } from "react-router-dom";

interface HeaderBarProps {
  channelName: string;
  hasYouTubeConnected: boolean;
  onMenuClick?: () => void;
}

const HeaderBar = ({ channelName, hasYouTubeConnected, onMenuClick }: HeaderBarProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    console.log("TODO: POST /api/auth/logout");
    navigate("/");
  };

  // Map routes to page titles and descriptions
  const getPageInfo = () => {
    const path = location.pathname;

    if (path === "/app/dashboard") {
      return { title: "Dashboard", subtitle: "Your engagement control center" };
    } else if (path === "/app/comments") {
      return { title: "Comments", subtitle: "Manage your YouTube comments" };
    } else if (path === "/app/videos") {
      return { title: "Videos", subtitle: "Analyze your video performance" };
    } else if (path.startsWith("/app/video/")) {
      return { title: "Video Details", subtitle: "Analyze comments and engagement" };
    } else if (path === "/app/voice") {
      return { title: "Voice Profile", subtitle: "Customize your AI reply tone" };
    } else if (path === "/app/billing") {
      return { title: "Billing", subtitle: "Manage your subscription" };
    } else if (path === "/app/settings") {
      return { title: "Settings", subtitle: "Configure your account" };
    }

    return { title: "Dashboard", subtitle: "Your engagement control center" };
  };

  const pageInfo = getPageInfo();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center justify-between px-6">
        {/* Left: Mobile menu + Page title */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={onMenuClick}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-lg font-semibold">{pageInfo.title}</h2>
            <p className="text-xs text-muted-foreground">{pageInfo.subtitle}</p>
          </div>
        </div>

        {/* Right: Channel info + logout */}
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-xs font-bold text-primary">
                {channelName.charAt(0)}
              </span>
            </div>
            <div className="text-sm">
              <div className="font-semibold">{channelName}</div>
              <ChannelStatusBadge
                status={hasYouTubeConnected ? "YouTube Connected ✅" : "YouTube Not Connected"}
                isConnected={hasYouTubeConnected}
              />
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {/* TODO: channelName, connection status from GET /api/me */}
    </header>
  );
};

export default HeaderBar;
