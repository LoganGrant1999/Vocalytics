import { useState } from "react";
import { LayoutDashboard, MessageSquare, Video, Mic, CreditCard } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import PlanBadge from "./PlanBadge";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";

interface SidebarNavProps {
  plan: "free" | "pro";
  isMobileOpen?: boolean;
  onClose?: () => void;
}

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/app/dashboard" },
  { label: "Comments", icon: MessageSquare, path: "/app/comments" },
  { label: "Videos", icon: Video, path: "/app/videos" },
  { label: "Voice Profile", icon: Mic, path: "/app/voice" },
  { label: "Billing", icon: CreditCard, path: "/app/billing" },
];

const SidebarNav = ({ plan, isMobileOpen = true }: SidebarNavProps) => {
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(false);

  const handleUpgrade = async () => {
    setIsLoading(true);
    try {
      const { url } = await api.createCheckoutSession();
      window.location.href = url;
    } catch (err: any) {
      console.error("Checkout error:", err);
      setIsLoading(false);
    }
  };

  const handleManageBilling = async () => {
    setIsLoading(true);
    try {
      const { url } = await api.createPortalSession();
      window.location.href = url;
    } catch (err: any) {
      console.error("Portal error:", err);
      setIsLoading(false);
    }
  };

  return (
    <aside
      className={`${
        isMobileOpen ? "translate-x-0" : "-translate-x-full"
      } fixed lg:sticky top-0 left-0 h-screen w-64 bg-sidebar border-r border-sidebar-border p-6 flex flex-col transition-transform duration-300 z-50 lg:translate-x-0`}
    >
      {/* Logo */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
          Vocalytics
        </h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 font-medium ${
                isActive
                  ? "bg-primary text-white"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-sidebar-border pt-6 space-y-3">
        <div className="flex items-center justify-between">
          <PlanBadge plan={plan} />
        </div>

        {plan === "free" ? (
          <Button
            onClick={handleUpgrade}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground glow-accent"
            disabled={isLoading}
          >
            {isLoading ? "Loading..." : "Upgrade to Pro"}
          </Button>
        ) : (
          <Button
            onClick={handleManageBilling}
            variant="outline"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? "Loading..." : "Manage Billing"}
          </Button>
        )}
      </div>
    </aside>
  );
};

export default SidebarNav;
