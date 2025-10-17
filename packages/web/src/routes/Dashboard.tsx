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
    <div className="px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight mb-1 text-brand-text-primary">Dashboard</h1>
        <p className="text-brand-text-secondary">
          Monitor your channel performance and sentiment trends.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard
          title="Total Videos"
          value="0"
          icon={<Video className="h-4 w-4 text-brand-text-secondary" />}
        />
        <StatCard
          title="Comments Analyzed"
          value={session.comments_analyzed_count.toString()}
          icon={<BarChart3 className="h-4 w-4 text-brand-text-secondary" />}
        />
        <StatCard
          title="Replies Generated"
          value={session.replies_generated_count.toString()}
          icon={<MessageSquare className="h-4 w-4 text-brand-text-secondary" />}
        />
        <StatCard
          title="Avg Sentiment"
          value="-"
          icon={<TrendingUp className="h-4 w-4 text-brand-text-secondary" />}
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
    <div className="rounded-xl border border-brand-border bg-brand-surface p-6 shadow-card transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-brand-text-secondary">
          {title}
        </span>
        {icon}
      </div>
      <div className="text-2xl font-bold text-brand-text-primary">{value}</div>
    </div>
  );
}
