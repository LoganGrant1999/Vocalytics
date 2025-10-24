import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { SentimentBar } from '@/components/SentimentBar';
import { ArrowLeft, Loader2, AlertCircle, ThumbsUp, MessageSquare, Eye, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useAuth } from '@/contexts/AuthContext';

interface Video {
  videoId: string;
  title: string;
  thumbnailUrl?: string;
  publishedAt?: string;
  stats?: {
    viewCount?: number;
    likeCount?: number;
    commentCount?: number;
  };
}

interface CommentSentiment {
  commentId: string;
  text: string;
  sentiment: {
    pos: number;
    neu: number;
    neg: number;
  };
}

interface Analysis {
  videoId: string;
  analyzedAt: string;
  sentiment: {
    pos: number;
    neu: number;
    neg: number;
  };
  score: number;
  topPositive: CommentSentiment[];
  topNegative: CommentSentiment[];
  summary: string;
  categoryCounts?: {
    pos: number;
    neu: number;
    neg: number;
  };
  totalComments?: number;
}

export default function Analyze() {
  const { videoId } = useParams<{ videoId: string }>();
  const navigate = useNavigate();
  const analytics = useAnalytics();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const hasAutoStarted = useRef(false);

  // Fetch video metadata and stats - only if YouTube OAuth is connected
  // This is optional nice-to-have data (title, thumbnail, stats)
  const { data: videos, isLoading: isLoadingVideo } = useQuery({
    queryKey: ['youtube-videos'],
    queryFn: async () => {
      const result = await api.GET('/api/youtube/videos', {
        params: { query: { mine: true, limit: 50 } },
      });
      if (result.error) throw new Error('Failed to fetch videos');
      return result.data as Video[];
    },
    enabled: user?.hasYouTubeConnected === true, // Only fetch if OAuth connected
    retry: false,
  });

  const video = videos?.find((v) => v.videoId === videoId);

  // Fetch existing analysis
  const {
    data: analysis,
    isLoading: isLoadingAnalysis,
    error: analysisError,
    refetch: refetchAnalysis,
  } = useQuery({
    queryKey: ['analysis', videoId],
    queryFn: async () => {
      if (!videoId) throw new Error('No video ID');
      const result = await api.GET('/api/analysis/{videoId}', {
        params: { path: { videoId } },
      });

      if (result.error) {
        if (result.response?.status === 404) {
          return null; // No analysis yet
        }
        throw new Error('Failed to fetch analysis');
      }
      return result.data as Analysis;
    },
    enabled: !!videoId,
    retry: false,
  });

  // Run analysis mutation
  const analyzeMutation = useMutation({
    mutationFn: async () => {
      if (!videoId) throw new Error('No video ID');

      analytics.track({ name: 'analyze_started', properties: { videoId } });
      setIsAnalyzing(true);

      const result = await api.POST('/api/analysis/{videoId}', {
        params: { path: { videoId } },
      });

      if (result.error) {
        if (result.response?.status === 402) {
          throw new Error('PAYWALL');
        }
        if (result.response?.status === 403) {
          throw new Error('YOUTUBE_NOT_CONNECTED');
        }
        throw new Error('Failed to analyze video');
      }

      return result.data as Analysis;
    },
    onSuccess: (data) => {
      analytics.track({ name: 'analyze_success', properties: { videoId } });
      queryClient.invalidateQueries({ queryKey: ['analysis', videoId] });
      toast.success('Analysis complete!');
      setIsAnalyzing(false);
    },
    onError: (error: Error) => {
      setIsAnalyzing(false);
      if (error.message === 'PAYWALL') {
        analytics.track({ name: 'paywall_viewed', properties: { context: 'analyze' } });
        toast.error('Upgrade required', {
          description: 'You have reached your free tier limit.',
          action: {
            label: 'Upgrade',
            onClick: () => navigate('/billing'),
          },
        });
      } else if (error.message === 'YOUTUBE_NOT_CONNECTED') {
        toast.error('YouTube not connected', {
          description: 'Please connect your YouTube account first.',
        });
      } else {
        analytics.track({ name: 'analyze_failure', properties: { videoId, error: error.message } });
        toast.error('Failed to analyze video', {
          description: error.message,
        });
      }
    },
  });

  // Sync analysis mutation (rerun on newer comments)
  const syncMutation = useMutation({
    mutationFn: async () => {
      if (!videoId) throw new Error('No video ID');

      analytics.track({ name: 'analyze_sync_started', properties: { videoId } });
      setIsAnalyzing(true);

      const result = await api.POST('/api/analysis/{videoId}', {
        params: { path: { videoId } },
      });

      if (result.error) {
        if (result.response?.status === 402) {
          throw new Error('PAYWALL');
        }
        if (result.response?.status === 403) {
          throw new Error('YOUTUBE_NOT_CONNECTED');
        }
        throw new Error('Failed to sync analysis');
      }

      return result.data as Analysis;
    },
    onSuccess: (data) => {
      analytics.track({ name: 'analyze_sync_success', properties: { videoId } });
      queryClient.invalidateQueries({ queryKey: ['analysis', videoId] });
      toast.success('Analysis synced with latest comments!');
      setIsAnalyzing(false);
    },
    onError: (error: Error) => {
      setIsAnalyzing(false);
      if (error.message === 'PAYWALL') {
        analytics.track({ name: 'paywall_viewed', properties: { context: 'sync' } });
        toast.error('Upgrade required', {
          description: 'You have reached your free tier limit.',
          action: {
            label: 'Upgrade',
            onClick: () => navigate('/billing'),
          },
        });
      } else if (error.message === 'YOUTUBE_NOT_CONNECTED') {
        toast.error('YouTube not connected', {
          description: 'Please connect your YouTube account first.',
        });
      } else {
        analytics.track({ name: 'analyze_sync_failure', properties: { videoId, error: error.message } });
        toast.error('Failed to sync analysis', {
          description: error.message,
        });
      }
    },
  });

  // Auto-start analysis if landing on page with no existing analysis
  useEffect(() => {
    if (!isLoadingAnalysis && !analysis && !isAnalyzing && !hasAutoStarted.current && videoId) {
      hasAutoStarted.current = true;
      analyzeMutation.mutate();
    }
  }, [isLoadingAnalysis, analysis, isAnalyzing, videoId, analyzeMutation]);

  if (!videoId) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">No video ID provided</p>
      </div>
    );
  }

  if (isLoadingVideo || isLoadingAnalysis) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // Classify sentiment based on thresholds for user-friendly display
  const classifySentiment = (pos: number) => {
    if (pos >= 0.6) return 'positive';
    if (pos <= 0.4) return 'negative';
    return 'neutral';
  };

  // For display: classify the overall sentiment into positive/neutral/negative buckets
  const displayClassification = analysis ? classifySentiment(analysis.sentiment.pos) : 'neutral';

  // Extract percentages from sentiment scores (same as used in summary)
  const sentimentCounts = analysis
    ? {
        positive: Math.round((analysis.sentiment.pos || 0) * 100),
        neutral: Math.round((analysis.sentiment.neu || 0) * 100),
        negative: Math.round((analysis.sentiment.neg || 0) * 100),
      }
    : { positive: 0, neutral: 0, negative: 0 };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate('/videos')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Videos
        </Button>
        <div className="flex gap-2">
          {!analysis && !isAnalyzing && (
            <Button onClick={() => analyzeMutation.mutate()} disabled={isAnalyzing}>
              {isAnalyzing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                'Run Analysis'
              )}
            </Button>
          )}
          {analysis && !isAnalyzing && (
            <Button onClick={() => syncMutation.mutate()} disabled={isAnalyzing} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Sync Analysis
            </Button>
          )}
        </div>
      </div>

      {/* Video Info */}
      <div className="rounded-lg border p-6">
        <div className="flex gap-4">
          {video?.thumbnailUrl && (
            <img
              src={video.thumbnailUrl}
              alt={video.title}
              className="w-48 h-27 object-cover rounded"
            />
          )}
          <div className="flex-1">
            <h2 className="text-xl font-bold mb-2">{video?.title || 'Video Analysis'}</h2>
            <p className="text-sm text-muted-foreground mb-4">Video ID: {videoId}</p>

            {/* Video Stats */}
            {video?.stats && (
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Views</p>
                    <p className="font-semibold">{video.stats.viewCount?.toLocaleString() || 0}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ThumbsUp className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Likes</p>
                    <p className="font-semibold">{video.stats.likeCount?.toLocaleString() || 0}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Comments</p>
                    <p className="font-semibold">{video.stats.commentCount?.toLocaleString() || 0}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Analysis Results */}
      {isAnalyzing ? (
        <div className="rounded-lg border p-12 text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
          <h3 className="text-lg font-semibold mb-2">Analyzing Comments...</h3>
          <p className="text-muted-foreground">This may take a minute</p>
        </div>
      ) : !analysis ? (
        <div className="rounded-lg border p-12 text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No Analysis Yet</h3>
          <p className="text-muted-foreground mb-6">
            Click "Run Analysis" to analyze the sentiment of comments on this video.
          </p>
          <Button onClick={() => analyzeMutation.mutate()}>Run Analysis</Button>
        </div>
      ) : (
        <>
          {/* Sentiment Overview */}
          <div className="rounded-lg border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Sentiment Analysis (Model-Weighted)</h3>
              <p className="text-xs text-muted-foreground">
                Analyzed {new Date(analysis.analyzedAt).toLocaleString()}
              </p>
            </div>

            {/* Small sample warning */}
            {analysis.totalComments && analysis.totalComments < 5 && (
              <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded text-sm">
                ⚠️ Low sample size ({analysis.totalComments} comment{analysis.totalComments !== 1 ? 's' : ''}) - results may not be representative
              </div>
            )}

            {/* Side-by-side cards */}
            <div className="grid md:grid-cols-2 gap-4">
              {/* Sentiment Pie Chart Card */}
              <div className="rounded-lg border p-6">
                <h3 className="text-sm font-semibold mb-4">Sentiment Distribution</h3>
                <SentimentBar
                  sentiments={sentimentCounts}
                  totalComments={100}
                />
                <p className="text-xs text-muted-foreground mt-3">
                  Classification: {displayClassification.charAt(0).toUpperCase() + displayClassification.slice(1)}
                  ({(analysis.sentiment.pos * 100).toFixed(0)}% positive score)
                </p>
              </div>

              {/* Summary Card */}
              <div className="rounded-lg border p-6">
                <h3 className="text-sm font-semibold mb-4">Analysis Summary</h3>
                <p className="text-sm text-muted-foreground">
                  {analysis.summary}
                </p>
              </div>
            </div>
          </div>

          {/* Top Positive Comments */}
          {analysis.topPositive.length > 0 && (
            <div className="rounded-lg border p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-500" />
                Top Positive Comments
              </h3>
              <div className="space-y-3">
                {analysis.topPositive.map((comment) => {
                  // Handle both old format (positive/neutral/negative) and new format (pos/neu/neg)
                  const sent = comment.sentiment as any;
                  const pos = sent.pos ?? sent.positive ?? 0;
                  const classification = classifySentiment(pos);
                  const label = classification.charAt(0).toUpperCase() + classification.slice(1);
                  const color = classification === 'positive' ? 'text-green-600' :
                               classification === 'negative' ? 'text-red-600' : 'text-gray-600';

                  return (
                    <div key={comment.commentId} className="border-l-4 border-green-500 pl-4 py-2">
                      <p className="text-sm mb-2">{comment.text}</p>
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span className={color}>Classification: {label}</span>
                        <span>AI Score: {(pos * 100).toFixed(0)}% positive</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Top Negative Comments */}
          {analysis.topNegative.length > 0 && (
            <div className="rounded-lg border p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-red-500" />
                Top Negative Comments
              </h3>
              <div className="space-y-3">
                {analysis.topNegative.map((comment) => {
                  // Handle both old format (positive/neutral/negative) and new format (pos/neu/neg)
                  const sent = comment.sentiment as any;
                  const pos = sent.pos ?? sent.positive ?? 0;
                  const classification = classifySentiment(pos);
                  const label = classification.charAt(0).toUpperCase() + classification.slice(1);
                  const color = classification === 'positive' ? 'text-green-600' :
                               classification === 'negative' ? 'text-red-600' : 'text-gray-600';

                  return (
                    <div key={comment.commentId} className="border-l-4 border-red-500 pl-4 py-2">
                      <p className="text-sm mb-2">{comment.text}</p>
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span className={color}>Classification: {label}</span>
                        <span>AI Score: {(pos * 100).toFixed(0)}% positive</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
