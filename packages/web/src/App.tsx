import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryProvider } from '@/providers/QueryProvider';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Toaster } from '@/components/ui/toaster';
import { AppShell } from '@/components/AppShell';
import { CookieBanner } from '@/components/CookieBanner';
import Landing from '@/routes/Landing';
import Login from '@/routes/Login';
import Register from '@/routes/Register';
import Onboarding from '@/routes/Onboarding';
import Dashboard from '@/routes/Dashboard';
import Videos from '@/routes/Videos';
import Analyze from '@/routes/Analyze';
import Billing from '@/routes/Billing';
import Settings from '@/routes/Settings';

function App() {
  return (
    <QueryProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Protected routes - require authentication */}
            <Route element={<ProtectedRoute />}>
              {/* Onboarding (no shell) */}
              <Route path="/onboarding" element={<Onboarding />} />

              {/* App routes with shell */}
              <Route element={<AppShell />}>
                <Route path="/app" element={<Dashboard />} />
                <Route path="/videos" element={<Videos />} />
                <Route path="/analyze/:videoId" element={<Analyze />} />
                <Route path="/billing" element={<Billing />} />
                <Route path="/settings" element={<Settings />} />
              </Route>
            </Route>
          </Routes>
          <Toaster />
          <CookieBanner />
        </BrowserRouter>
      </AuthProvider>
    </QueryProvider>
  );
}

export default App;
