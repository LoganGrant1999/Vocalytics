import { useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import {
  Youtube,
  LayoutDashboard,
  Video,
  CreditCard,
  Menu,
  X,
  Crown,
  Bug,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSession } from '@/hooks/useSession';
import { DebugDrawer } from '@/components/DebugDrawer';

const routes = [
  { path: '/app', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/videos', label: 'Videos', icon: Video },
  { path: '/billing', label: 'Billing', icon: CreditCard },
];

/**
 * Main application shell with navbar, sidebar, and content area.
 * Sidebar collapses to a sheet on mobile devices.
 */
export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const location = useLocation();
  const { session } = useSession();

  // Find the current route to display title
  const currentRoute = routes.find((r) => location.pathname.startsWith(r.path));
  const pageTitle = currentRoute?.label || 'Vocalytics';

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center px-4 gap-4">
          {/* Mobile menu button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>

          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <Youtube className="h-6 w-6 text-primary" />
            <span className="font-bold">Vocalytics</span>
          </Link>

          {/* Page title (desktop only) */}
          <div className="flex-1 hidden md:block">
            <h1 className="text-lg font-semibold">{pageTitle}</h1>
          </div>

          {/* Right side actions */}
          <div className="flex items-center gap-2">
            {session?.tier === 'pro' && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                <Crown className="h-3 w-3" />
                PRO
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDebugOpen(true)}
              title="Debug Console"
            >
              <Bug className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm">
              Account
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar - Desktop */}
        <aside className="hidden md:flex w-64 flex-col border-r bg-background min-h-[calc(100vh-3.5rem)]">
          <nav className="flex-1 space-y-1 p-4">
            {routes.map((route) => {
              const Icon = route.icon;
              const isActive = location.pathname.startsWith(route.path);
              return (
                <Link
                  key={route.path}
                  to={route.path}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {route.label}
                </Link>
              );
            })}
          </nav>

          {/* Debug footer */}
          <div className="p-4 border-t text-xs text-muted-foreground">
            <div className="space-y-1">
              <div>Environment: Development</div>
              <div id="debug-request-id" className="truncate">
                Request ID: -
              </div>
            </div>
          </div>
        </aside>

        {/* Sidebar - Mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <aside
              className="fixed left-0 top-14 bottom-0 w-64 border-r bg-background"
              onClick={(e) => e.stopPropagation()}
            >
              <nav className="flex-1 space-y-1 p-4">
                {routes.map((route) => {
                  const Icon = route.icon;
                  const isActive = location.pathname.startsWith(route.path);
                  return (
                    <Link
                      key={route.path}
                      to={route.path}
                      onClick={() => setSidebarOpen(false)}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-accent hover:text-accent-foreground'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {route.label}
                    </Link>
                  );
                })}
              </nav>

              {/* Debug footer mobile */}
              <div className="absolute bottom-0 left-0 right-0 p-4 border-t text-xs text-muted-foreground">
                <div className="space-y-1">
                  <div>Environment: Development</div>
                  <div id="debug-request-id-mobile" className="truncate">
                    Request ID: -
                  </div>
                </div>
              </div>
            </aside>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 p-6">
          {/* Page title mobile */}
          <div className="md:hidden mb-4">
            <h1 className="text-2xl font-bold">{pageTitle}</h1>
          </div>

          <Outlet />
        </main>
      </div>

      {/* Debug Drawer */}
      <DebugDrawer isOpen={debugOpen} onClose={() => setDebugOpen(false)} />
    </div>
  );
}
