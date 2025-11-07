import { useState } from 'react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Video,
  CreditCard,
  Menu,
  X,
  Crown,
  LogOut,
  Settings,
  User,
  Inbox,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useSession } from '@/hooks/useSession';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const routes = [
  { path: '/app', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/videos', label: 'Videos', icon: Video },
  { path: '/inbox', label: 'Inbox', icon: Inbox },
  { path: '/billing', label: 'Billing', icon: CreditCard },
  { path: '/settings', label: 'Settings', icon: Settings },
];

/**
 * Main application shell with sidebar and content area.
 * Sidebar collapses to a sheet on mobile devices.
 */
export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { session } = useSession();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Logged out successfully');
      navigate('/login');
    } catch (error) {
      toast.error('Failed to logout');
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile menu button - Fixed top-left */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden fixed top-4 left-4 z-50 bg-brand-secondary-light-explicit text-white hover:bg-brand-secondary-ghost"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        {sidebarOpen ? (
          <X className="h-5 w-5" />
        ) : (
          <Menu className="h-5 w-5" />
        )}
      </Button>

      <div className="flex w-full">
        {/* Sidebar - Desktop */}
        <aside className="hidden md:flex w-56 flex-col bg-brand-secondary-light-explicit text-white h-screen sticky top-0">
          {/* Logo at top */}
          <div className="p-3 pb-0 overflow-visible flex justify-center">
            <Link to="/" className="flex items-center">
              <img src="/images/Banner.png" alt="Vocalytics" className="h-28" />
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 p-3 pt-2 overflow-y-auto">
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
                      ? 'text-white font-semibold'
                      : 'text-white/80 hover:bg-brand-secondary-ghost hover:text-white'
                  )}
                  style={isActive ? { backgroundColor: '#E63946' } : undefined}
                >
                  <Icon className="h-4 w-4" />
                  {route.label}
                </Link>
              );
            })}
          </nav>

          {/* User profile footer - sticky at bottom */}
          <div className="p-4 border-t border-white/10 mt-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 w-full rounded-lg px-3 py-2 text-sm text-white/80 hover:bg-brand-secondary-ghost hover:text-white transition-colors">
                  <User className="h-4 w-4" />
                  <div className="flex-1 text-left truncate">
                    <div className="font-medium truncate">{user?.name || 'Account'}</div>
                    {session?.tier === 'pro' && (
                      <div className="flex items-center gap-1 text-xs">
                        <Crown className="h-3 w-3 text-brand-primary" />
                        <span className="text-brand-primary">PRO</span>
                      </div>
                    )}
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user?.name}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user?.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </aside>

        {/* Sidebar - Mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <aside
              className="fixed left-0 top-0 bottom-0 w-56 bg-brand-secondary-light-explicit text-white flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Logo at top */}
              <div className="p-3 pb-0 overflow-visible flex justify-center">
                <Link to="/" className="flex items-center" onClick={() => setSidebarOpen(false)}>
                  <img src="/images/Banner.png" alt="Vocalytics" className="h-28" />
                </Link>
              </div>

              {/* Navigation */}
              <nav className="flex-1 space-y-1 p-3 pt-2 overflow-y-auto">
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
                          ? 'text-white font-semibold'
                          : 'text-white/80 hover:bg-brand-secondary-ghost hover:text-white'
                      )}
                      style={isActive ? { backgroundColor: '#E63946' } : undefined}
                    >
                      <Icon className="h-4 w-4" />
                      {route.label}
                    </Link>
                  );
                })}
              </nav>

              {/* User profile footer - sticky at bottom */}
              <div className="p-4 border-t border-white/10 mt-auto">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-3 w-full rounded-lg px-3 py-2 text-sm text-white/80 hover:bg-brand-secondary-ghost hover:text-white transition-colors">
                      <User className="h-4 w-4" />
                      <div className="flex-1 text-left truncate">
                        <div className="font-medium truncate">{user?.name || 'Account'}</div>
                        {session?.tier === 'pro' && (
                          <div className="flex items-center gap-1 text-xs">
                            <Crown className="h-3 w-3 text-brand-primary" />
                            <span className="text-brand-primary">PRO</span>
                          </div>
                        )}
                      </div>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{user?.name}</p>
                        <p className="text-xs leading-none text-muted-foreground">
                          {user?.email}
                        </p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout}>
                      <LogOut className="mr-2 h-4 w-4" />
                      Log out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </aside>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
