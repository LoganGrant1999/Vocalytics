import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Youtube, CheckCircle2, AlertCircle, Moon, Sun } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useSession } from '@/hooks/useSession';
import { UsageMeter } from '@/components/UsageMeter';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export default function Settings() {
  const { user, refreshUser } = useAuth();
  const { isDark, toggle } = useDarkMode();
  const { session } = useSession();
  const navigate = useNavigate();

  const FREE_ANALYZE_LIMIT = 2; // per week
  const FREE_REPLY_LIMIT = 1; // per day

  const handleConnectYouTube = () => {
    // Store current page for redirect after OAuth
    sessionStorage.setItem('oauth_redirect', '/settings');
    window.location.href = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/youtube/connect`;
  };

  const handleDisconnectYouTube = () => {
    // TODO: Implement disconnect functionality
    toast.info('Disconnect functionality coming soon');
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto px-6 py-8">
      {/* Usage - Only show for free tier users */}
      {session?.tier === 'free' && (
        <Card className="hover:translate-y-0 hover:shadow-card rounded-lg">
          <CardHeader>
            <CardTitle>Usage This Period</CardTitle>
            <CardDescription>Monitor your API usage and limits</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {session && (
                <>
                  <UsageMeter
                    label="Sentiment Analyses"
                    used={session.comments_analyzed_count}
                    limit={FREE_ANALYZE_LIMIT}
                    period="this week"
                  />
                  <UsageMeter
                    label="AI Replies"
                    used={session.replies_generated_count}
                    limit={FREE_REPLY_LIMIT}
                    period="today"
                  />
                </>
              )}
            </div>
            <div className="mt-4 pt-4 border-t">
              <Button onClick={() => navigate('/billing')} className="w-full">
                Upgrade to Pro for Unlimited Usage
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Account Information */}
      <Card className="hover:translate-y-0 hover:shadow-card rounded-lg">
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
          <CardDescription>Your account details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">Name</label>
            <p className="text-base">{user?.name}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Email</label>
            <p className="text-base">{user?.email}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Plan</label>
            <p className="text-base capitalize">{user?.tier}</p>
          </div>
        </CardContent>
      </Card>

      {/* Billing Management - Only show for pro tier users */}
      {session?.tier === 'pro' && (
        <Card className="hover:translate-y-0 hover:shadow-card rounded-lg">
          <CardHeader>
            <CardTitle>Subscription Management</CardTitle>
            <CardDescription>Manage your Pro subscription</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium">Pro Plan Active</p>
                <p className="text-sm text-muted-foreground">
                  Unlimited analyses and AI replies. Manage your subscription, update payment method, or cancel anytime.
                </p>
              </div>
              <Button variant="outline" onClick={() => navigate('/billing')}>
                Manage Subscription
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Appearance */}
      <Card className="hover:translate-y-0 hover:shadow-card rounded-lg">
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Customize how Vocalytics looks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-primary/10 p-2">
                {isDark ? (
                  <Moon className="h-6 w-6 text-primary" />
                ) : (
                  <Sun className="h-6 w-6 text-primary" />
                )}
              </div>
              <div>
                <p className="font-medium">Theme</p>
                <p className="text-sm text-muted-foreground">
                  {isDark ? 'Dark mode' : 'Light mode'}
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={toggle}>
              {isDark ? (
                <>
                  <Sun className="mr-2 h-4 w-4" />
                  Light Mode
                </>
              ) : (
                <>
                  <Moon className="mr-2 h-4 w-4" />
                  Dark Mode
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Connected Accounts */}
      <Card className="hover:translate-y-0 hover:shadow-card rounded-lg">
        <CardHeader>
          <CardTitle>Connected Accounts</CardTitle>
          <CardDescription>Manage your connected social accounts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-primary/10 p-2">
                <Youtube className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-medium">YouTube</p>
                <div className="flex items-center gap-2 text-sm">
                  {user?.hasYouTubeConnected ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span className="text-muted-foreground">Connected</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Not connected</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            {user?.hasYouTubeConnected ? (
              <Button variant="outline" onClick={handleDisconnectYouTube}>
                Disconnect
              </Button>
            ) : (
              <Button onClick={handleConnectYouTube}>
                <Youtube className="mr-2 h-4 w-4" />
                Connect
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive hover:translate-y-0 hover:shadow-card rounded-lg">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>Irreversible account actions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Delete Account</p>
              <p className="text-sm text-muted-foreground">
                Permanently delete your account and all associated data
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={() => toast.info('Delete account functionality coming soon')}
            >
              Delete Account
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
