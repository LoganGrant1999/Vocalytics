import { Menu, LogOut } from "lucide-react";
import ChannelStatusBadge from "./ChannelStatusBadge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface HeaderBarProps {
  channelName: string;
  hasYouTubeConnected: boolean;
  onMenuClick?: () => void;
}

const HeaderBar = ({ channelName, hasYouTubeConnected, onMenuClick }: HeaderBarProps) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    console.log("TODO: POST /api/auth/logout");
    navigate("/");
  };

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
            <h2 className="text-lg font-semibold">Dashboard</h2>
            <p className="text-xs text-muted-foreground">Your engagement control center</p>
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
