import { useState } from "react";
import SidebarNav from "@/components/shared/SidebarNav";
import HeaderBar from "@/components/shared/HeaderBar";

interface AppShellProps {
  plan: "free" | "pro";
  channelName: string;
  hasYouTubeConnected: boolean;
  children: React.ReactNode;
}

const AppShell = ({ plan, channelName, hasYouTubeConnected, children }: AppShellProps) => {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const toggleMobileSidebar = () => {
    setIsMobileSidebarOpen(!isMobileSidebarOpen);
  };

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Sidebar */}
      <SidebarNav
        plan={plan}
        isMobileOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
      />

      {/* Mobile overlay */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-0">
        <HeaderBar
          channelName={channelName}
          hasYouTubeConnected={hasYouTubeConnected}
          onMenuClick={toggleMobileSidebar}
        />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
};

export default AppShell;
