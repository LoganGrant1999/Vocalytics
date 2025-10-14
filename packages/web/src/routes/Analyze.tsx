import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { SentimentBar } from '@/components/SentimentBar';
import { CommentList } from '@/components/CommentList';
import { ReplyDraftPanel } from '@/components/ReplyDraftPanel';
import { ArrowLeft, Loader2, AlertCircle, Clock } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { useAnalytics } from '@/hooks/useAnalytics';
import type { components } from '@/types/api';

type Comment = components['schemas']['Comment'];
type Sentiment = components['schemas']['Sentiment'];

interface CommentWithSentiment extends Comment {
  sentiment?: Sentiment;
}

interface Reply {
  commentId?: string;
  text?: string;
}

export default function Analyze() {
  const { videoId } = useParams<{ videoId: string }>();
  const navigate = useNavigate();
  const analytics = useAnalytics();
  const [activeTab, setActiveTab] = useState<'overview' | 'comments' | 'replies'>('overview');
  const [selectedComment, setSelectedComment] = useState<CommentWithSentiment | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);

  // Countdown timer for 429 retry
  useEffect(() => {
    if (retryAfter === null) return;

    const interval = setInterval(() => {
      setRetryAfter((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [retryAfter]);

  // Fetch comments from YouTube
  const {
    data: commentsData,
    isLoading: isLoadingComments,
    error: commentsError,
    refetch: refetchComments,
  } = useQuery({
    queryKey: ['youtube-comments', videoId],
    queryFn: async () => {
      if (!videoId) throw new Error('No video ID');

      const result = await api.GET('/api/youtube/comments', {
        params: {
          query: {
            videoId,
            order: 'relevance',
            includeReplies: false,
          },
        },
      });

      if (result.error) {
        if (result.response?.status === 403) {
          throw new Error('YOUTUBE_NOT_CONNECTED');
        }
        throw new Error('Failed to fetch comments');
      }

      return result.data;
    },
    enabled: !!videoId,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  // Analyze comments with sentiment
  const {
    data: sentimentData,
    isPending: isLoadingSentiments,
    mutate: analyzeSentiments,
  } = useMutation({
    mutationFn: async (comments: Comment[]) => {
      analytics.track({ name: 'analyze_started', properties: { videoId } });

      const result = await api.POST('/api/analyze-comments', {
        body: { comments },
      });

      if (result.error) {
        if (result.response?.status === 429) {
          const retryAfterHeader = result.response.headers.get('Retry-After');
          const seconds = retryAfterHeader ? parseInt(retryAfterHeader) : 60;
          setRetryAfter(seconds);
          throw new Error('RATE_LIMIT');
        }
        if (result.response?.status === 402) {
          throw new Error('PAYWALL');
        }
        throw new Error('Failed to analyze comments');
      }

      return result.data;
    },
    onSuccess: () => {
      analytics.track({ name: 'analyze_success', properties: { videoId } });
    },
    onError: (error: Error) => {
      if (error.message === 'RATE_LIMIT') {
        toast.error('Rate limit exceeded', {
          description: `Please wait ${retryAfter} seconds before trying again.`,
        });
      } else if (error.message === 'PAYWALL') {
        analytics.track({ name: 'paywall_viewed', properties: { context: 'analyze' } });
        toast.error('Upgrade required', {
          description: 'You have reached your free tier limit.',
          action: {
            label: 'Upgrade',
            onClick: () => navigate('/billing'),
          },
        });
      } else {
        analytics.track({ name: 'analyze_failure', properties: { videoId, error: error.message } });
        toast.error('Failed to analyze comments', {
          description: error.message,
        });
      }
    },
  });

  // Generate replies for selected comment
  const {
    isPending: isLoadingReplies,
    mutate: generateReplies,
  } = useMutation({
    mutationFn: async (comment: Comment) => {
      const result = await api.POST('/api/generate-replies', {
        body: {
          comments: [comment],
        },
      });

      if (result.error) {
        if (result.response?.status === 429) {
          const retryAfterHeader = result.response.headers.get('Retry-After');
          const seconds = retryAfterHeader ? parseInt(retryAfterHeader) : 60;
          setRetryAfter(seconds);
          throw new Error('RATE_LIMIT');
        }
        if (result.response?.status === 402) {
          throw new Error('PAYWALL');
        }
        throw new Error('Failed to generate replies');
      }

      return result.data;
    },
    onSuccess: (data) => {
      analytics.track({
        name: 'replies_generated',
        properties: {
          commentId: selectedComment?.id,
          replyCount: data.replies?.length || 0,
        },
      });
      setReplies(data.replies || []);
      setActiveTab('replies');
      toast.success('Replies generated!');
    },
    onError: (error: Error) => {
      if (error.message === 'RATE_LIMIT') {
        toast.error('Rate limit exceeded', {
          description: `Please wait ${retryAfter} seconds before trying again.`,
        });
      } else if (error.message === 'PAYWALL') {
        analytics.track({ name: 'paywall_viewed', properties: { context: 'replies' } });
        toast.error('Upgrade required', {
          description: 'You have reached your free tier limit.',
          action: {
            label: 'Upgrade',
            onClick: () => navigate('/billing'),
          },
        });
      } else {
        toast.error('Failed to generate replies', {
          description: error.message,
        });
      }
    },
  });

  // Parse comments from YouTube API response
  const comments: Comment[] = (commentsData?.items || []).map((item: any) => ({
    id: item.id,
    videoId: videoId || '',
    author: item.snippet?.topLevelComment?.snippet?.authorDisplayName || 'Unknown',
    text: item.snippet?.topLevelComment?.snippet?.textDisplay || '',
    publishedAt: item.snippet?.topLevelComment?.snippet?.publishedAt,
    likeCount: item.snippet?.topLevelComment?.snippet?.likeCount || 0,
    replyCount: item.snippet?.totalReplyCount || 0,
  }));

  // Auto-analyze when comments are fetched
  useEffect(() => {
    if (comments.length > 0 && !sentimentData && !isLoadingSentiments) {
      analyzeSentiments(comments);
    }
  }, [comments.length, sentimentData, isLoadingSentiments]);

  // Merge comments with sentiments
  const commentsWithSentiments: CommentWithSentiment[] = comments.map((comment) => {
    const sentiment = (sentimentData?.sentiments || []).find(
      (s) => s.commentId === comment.id
    );
    return { ...comment, sentiment };
  });

  // Calculate sentiment distribution
  const sentimentCounts = {
    positive: 0,
    neutral: 0,
    negative: 0,
  };

  commentsWithSentiments.forEach((comment) => {
    const label = comment.sentiment?.label || 'neutral';
    sentimentCounts[label as keyof typeof sentimentCounts]++;
  });

  // Get top impactful comments (negative + high engagement)
  const topImpactfulComments = commentsWithSentiments
    .filter((c) => c.sentiment?.label === 'negative')
    .sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0))
    .slice(0, 3);

  const handleSelectComment = (comment: CommentWithSentiment) => {
    setSelectedComment(comment);
    generateReplies(comment);
  };

  if (!videoId) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">No video ID provided</p>
      </div>
    );
  }

  if (commentsError) {
    const errorMessage = (commentsError as Error).message;

    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate('/videos')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Videos
        </Button>

        <div className="rounded-lg border border-destructive/50 p-12 text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
          <h3 className="text-lg font-semibold mb-2">
            {errorMessage === 'YOUTUBE_NOT_CONNECTED'
              ? 'YouTube Not Connected'
              : 'Failed to Load Comments'}
          </h3>
          <p className="text-muted-foreground mb-6">
            {errorMessage === 'YOUTUBE_NOT_CONNECTED'
              ? 'Please connect your YouTube account to fetch comments.'
              : 'There was an error loading comments for this video.'}
          </p>
          <Button onClick={() => refetchComments()}>Try Again</Button>
        </div>
      </div>
    );
  }

  if (isLoadingComments) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading comments...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate('/videos')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Videos
        </Button>
        {retryAfter !== null && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            Retry in {retryAfter}s
          </div>
        )}
      </div>

      {/* Video Info & Sentiment Summary */}
      <div className="rounded-lg border p-6">
        <h2 className="text-xl font-bold mb-1">Video Analysis</h2>
        <p className="text-sm text-muted-foreground mb-6">Video ID: {videoId}</p>

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="font-semibold mb-3">Sentiment Distribution</h3>
            {isLoadingSentiments ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyzing sentiments...
              </div>
            ) : (
              <SentimentBar
                sentiments={sentimentCounts}
                totalComments={comments.length}
              />
            )}
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold mb-3">Statistics</h3>
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Comments:</span>
                <span className="font-medium">{comments.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Analyzed:</span>
                <span className="font-medium">
                  {sentimentData?.sentiments?.length || 0}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-3 px-1 border-b-2 transition-colors ${
              activeTab === 'overview'
                ? 'border-primary text-primary font-medium'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('comments')}
            className={`pb-3 px-1 border-b-2 transition-colors ${
              activeTab === 'comments'
                ? 'border-primary text-primary font-medium'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Comments ({comments.length})
          </button>
          <button
            onClick={() => setActiveTab('replies')}
            className={`pb-3 px-1 border-b-2 transition-colors ${
              activeTab === 'replies'
                ? 'border-primary text-primary font-medium'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            disabled={!selectedComment}
          >
            Replies {selectedComment && `(${replies.length})`}
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="rounded-lg border p-6">
              <h3 className="font-semibold mb-4">Top Insights</h3>
              <ul className="list-disc list-inside space-y-2 text-sm">
                <li>
                  {sentimentCounts.positive} positive comments ({((sentimentCounts.positive / comments.length) * 100).toFixed(1)}%)
                </li>
                <li>
                  {sentimentCounts.negative} negative comments requiring attention
                </li>
                <li>
                  {topImpactfulComments.length} high-engagement negative comments
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-4">
                Most Impactful Comments to Reply To
              </h3>
              <CommentList
                comments={topImpactfulComments}
                onSelectComment={handleSelectComment}
                selectedCommentId={selectedComment?.id}
              />
              {topImpactfulComments.length === 0 && (
                <p className="text-center py-8 text-muted-foreground">
                  No negative high-engagement comments found.
                </p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'comments' && (
          <CommentList
            comments={commentsWithSentiments}
            onSelectComment={handleSelectComment}
            selectedCommentId={selectedComment?.id}
          />
        )}

        {activeTab === 'replies' && selectedComment && (
          <ReplyDraftPanel
            comment={selectedComment}
            replies={replies}
            isLoading={isLoadingReplies}
            onGenerate={() => generateReplies(selectedComment)}
          />
        )}

        {activeTab === 'replies' && !selectedComment && (
          <div className="text-center py-12 text-muted-foreground">
            Select a comment to generate reply suggestions.
          </div>
        )}
      </div>
    </div>
  );
}
