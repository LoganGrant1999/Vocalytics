import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryProvider } from '@/providers/QueryProvider';
import { Toaster } from '@/components/ui/toaster';
import { AppShell } from '@/components/AppShell';
import { CookieBanner } from '@/components/CookieBanner';
import Landing from '@/routes/Landing';
import Dashboard from '@/routes/Dashboard';
import Videos from '@/routes/Videos';
import Analyze from '@/routes/Analyze';
import Billing from '@/routes/Billing';

function App() {
  return (
    <QueryProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Landing />} />

          {/* App routes with shell */}
          <Route element={<AppShell />}>
            <Route path="/app" element={<Dashboard />} />
            <Route path="/videos" element={<Videos />} />
            <Route path="/analyze/:videoId" element={<Analyze />} />
            <Route path="/billing" element={<Billing />} />
          </Route>
        </Routes>
        <Toaster />
        <CookieBanner />
      </BrowserRouter>
    </QueryProvider>
  );
}

export default App;
