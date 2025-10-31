import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Youtube, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function Onboarding() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // If user already has YouTube connected, redirect to app
  useEffect(() => {
    if (user?.hasYouTubeConnected) {
      navigate('/app');
    }
  }, [user, navigate]);

  const handleConnectYouTube = () => {
    // Store redirect URL in sessionStorage so we can come back after OAuth
    sessionStorage.setItem('oauth_redirect', '/app');
    // Redirect to YouTube OAuth
    // Use current origin to work in both dev and production
    window.location.href = `${window.location.origin}/api/youtube/connect`;
  };

  const handleSkip = () => {
    navigate('/app');
  };

  return (
    <div className="container mx-auto px-4 min-h-screen flex items-center justify-center">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-primary/10 p-4">
              <Youtube className="h-12 w-12 text-primary" />
            </div>
          </div>
          <CardTitle className="text-3xl">Connect Your YouTube Channel</CardTitle>
          <CardDescription className="text-base mt-2">
            Connect your YouTube channel to start analyzing comments and gaining insights
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Access Your Videos</p>
                <p className="text-sm text-muted-foreground">
                  View and analyze all your uploaded videos
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Analyze Comments</p>
                <p className="text-sm text-muted-foreground">
                  Get AI-powered sentiment analysis on your video comments
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Track Trends</p>
                <p className="text-sm text-muted-foreground">
                  Monitor sentiment trends over time across your channel
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              <strong>Note:</strong> We only request read-only access to your YouTube data.
              We never post, delete, or modify your content.
            </p>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          <Button
            onClick={handleConnectYouTube}
            className="w-full"
            size="lg"
          >
            <Youtube className="mr-2 h-5 w-5" />
            Connect YouTube Channel
          </Button>
          <Button
            onClick={handleSkip}
            variant="ghost"
            className="w-full"
          >
            Skip for now
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
