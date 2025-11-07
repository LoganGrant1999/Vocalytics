import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import LandingPage from "./pages/LandingPage";
import SignInPage from "./pages/SignInPage";
import RegisterPage from "./pages/RegisterPage";
import ConnectYouTubePage from "./pages/ConnectYouTubePage";
import DashboardPage from "./pages/DashboardPage";
import CommentsPage from "./pages/CommentsPage";
import VideosPage from "./pages/VideosPage";
import VideoDetailPage from "./pages/VideoDetailPage";
import VoiceProfilePage from "./pages/VoiceProfilePage";
import BillingPage from "./pages/BillingPage";
import SettingsPage from "./pages/SettingsPage";
import NotFound from "./pages/NotFound";
import AppShell from "./pages/AppShell";

const queryClient = new QueryClient();

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/signin" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const plan = user?.tier || 'free';
  const channelName = user?.name || 'Your Channel';
  const hasYouTubeConnected = user?.hasYouTubeConnected || false;

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/signin" element={<SignInPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/connect"
        element={
          <ProtectedRoute>
            <ConnectYouTubePage />
          </ProtectedRoute>
        }
      />

      {/* Authenticated app routes */}
      <Route
        path="/app/dashboard"
        element={
          <ProtectedRoute>
            <AppShell plan={plan} channelName={channelName} hasYouTubeConnected={hasYouTubeConnected}>
              <DashboardPage plan={plan} />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/comments"
        element={
          <ProtectedRoute>
            <AppShell plan={plan} channelName={channelName} hasYouTubeConnected={hasYouTubeConnected}>
              <CommentsPage plan={plan} />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/videos"
        element={
          <ProtectedRoute>
            <AppShell plan={plan} channelName={channelName} hasYouTubeConnected={hasYouTubeConnected}>
              <VideosPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/video/:id"
        element={
          <ProtectedRoute>
            <AppShell plan={plan} channelName={channelName} hasYouTubeConnected={hasYouTubeConnected}>
              <VideoDetailPage plan={plan} />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/voice"
        element={
          <ProtectedRoute>
            <AppShell plan={plan} channelName={channelName} hasYouTubeConnected={hasYouTubeConnected}>
              <VoiceProfilePage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/billing"
        element={
          <ProtectedRoute>
            <AppShell plan={plan} channelName={channelName} hasYouTubeConnected={hasYouTubeConnected}>
              <BillingPage plan={plan} />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/settings"
        element={
          <ProtectedRoute>
            <AppShell plan={plan} channelName={channelName} hasYouTubeConnected={hasYouTubeConnected}>
              <SettingsPage />
            </AppShell>
          </ProtectedRoute>
        }
      />

      {/* 404 catch-all */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
