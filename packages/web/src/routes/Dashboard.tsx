import { Button } from '@/components/ui/button';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Video, BarChart3, MessageSquare, TrendingUp, CheckCircle2, Crown, Loader2 } from 'lucide-react';
import { useSession } from '@/hooks/useSession';
import { useChannelData } from '@/hooks/useChannelData';
import { UsageMeter } from '@/components/UsageMeter';
import { ConnectYouTubeButton } from '@/components/ConnectYouTubeButton';
import { VideoCard } from '@/components/VideoCard';
import { TrendsChart } from '@/components/TrendsChart';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export default function Dashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { session, isLoading, refetch } = useSession();
  const { videos, channelTitle, trends, isLoading: isLoadingChannel, isYouTubeNotConnected, analyze, isAnalyzing } = useChannelData();
  const [analyzingVideoId, setAnalyzingVideoId] = useState<string | null>(null);

  // Handle OAuth callback
  useEffect(() => {
    const oauthStatus = searchParams.get('oauth');
    if (oauthStatus === 'success') {
      toast.success('Successfully connected to YouTube!', {
        description: 'Your account is now linked.',
        icon: <CheckCircle2 className="h-4 w-4" />,
      });
      // Refetch session to get updated data
      refetch();
      // Clean up URL
      setSearchParams({});
    } else if (oauthStatus === 'error') {
      const error = searchParams.get('error') || 'Unknown error';
      toast.error('Failed to connect YouTube', {
        description: error,
      });
      setSearchParams({});
    }
  }, [searchParams, refetch, setSearchParams]);

  const FREE_ANALYZE_LIMIT = 2; // per week
  const FREE_REPLY_LIMIT = 1; // per day

  // Handle analyze click
  const handleAnalyze = async (videoId: string) => {
    setAnalyzingVideoId(videoId);
    toast.info('Analyzing...', {
      description: 'Running sentiment analysis on comments',
      icon: <Loader2 className="h-4 w-4 animate-spin" />,
    });

    try {
      await analyze(videoId);
      toast.success('Analysis complete!', {
        description: 'Sentiment analysis has been saved',
        icon: <CheckCircle2 className="h-4 w-4" />,
      });
      // Navigate to analyze page to see results
      navigate(`/analyze/${videoId}`);
    } catch (error: any) {
      toast.error('Analysis failed', {
        description: error.message || 'Failed to analyze video',
      });
    } finally {
      setAnalyzingVideoId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Not logged in
  if (!session) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border p-12 text-center">
          <Video className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-2">Welcome to Vocalytics</h2>
          <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
            Connect your YouTube channel to start analyzing comments and
            generating AI-powered replies.
          </p>
          <ConnectYouTubeButton size="lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Account Status */}
      <div className="rounded-lg border p-4 bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Account Tier:</span>
              <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                {session.tier === 'pro' && <Crown className="h-3 w-3" />}
                {session.tier.toUpperCase()}
              </div>
            </div>
            {session.user?.email && (
              <span className="text-sm text-muted-foreground">
                • {session.user.email}
              </span>
            )}
          </div>
          {session.tier === 'free' && (
            <Button onClick={() => navigate('/billing')} size="sm">
              Upgrade to Pro
            </Button>
          )}
        </div>
      </div>

      {/* Usage Meters */}
      <div className="rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-4">Usage This Period</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <UsageMeter
            label="Sentiment Analyses"
            used={session.comments_analyzed_count}
            limit={session.tier === 'free' ? FREE_ANALYZE_LIMIT : 999999}
            period="this week"
          />
          <UsageMeter
            label="AI Replies"
            used={session.replies_generated_count}
            limit={session.tier === 'free' ? FREE_REPLY_LIMIT : 999999}
            period="today"
          />
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Videos"
          value="0"
          icon={<Video className="h-4 w-4 text-muted-foreground" />}
        />
        <StatCard
          title="Comments Analyzed"
          value={session.comments_analyzed_count.toString()}
          icon={<BarChart3 className="h-4 w-4 text-muted-foreground" />}
        />
        <StatCard
          title="Replies Generated"
          value={session.replies_generated_count.toString()}
          icon={<MessageSquare className="h-4 w-4 text-muted-foreground" />}
        />
        <StatCard
          title="Avg Sentiment"
          value="-"
          icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
        />
      </div>

      {/* Sentiment Trend */}
      {trends.length > 0 && <TrendsChart data={trends} />}
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-muted-foreground">
          {title}
        </span>
        {icon}
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
