import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, AlertCircle, RefreshCw } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import SentimentPill from "@/components/shared/SentimentPill";
import SentimentChart from "@/components/shared/SentimentChart";
import CommentWithReply from "@/components/shared/CommentWithReply";
import { Alert, AlertDescription } from "@/components/ui/alert";
import api from "@/lib/api";

interface VideoDetailPageProps {
  plan: "free" | "pro";
}

const VideoDetailPage = ({ plan }: VideoDetailPageProps) => {
  const navigate = useNavigate();
  const { id: videoId } = useParams<{ id: string }>();

  // Fetch video metadata
  const { data: videos, isLoading: videosLoading } = useQuery({
    queryKey: ["videos"],
    queryFn: () => api.getVideos({ mine: true, limit: 50 }),
  });

  // Fetch video analysis with polling when analyzing
  const {
    data: analysis,
    isLoading: analysisLoading,
    error: analysisError,
    refetch: refetchAnalysis,
    isError: hasError,
  } = useQuery({
    queryKey: ["analysis", videoId],
    queryFn: () => api.getVideoAnalysis(videoId!),
    enabled: !!videoId,
    retry: false,
    // Poll every 3 seconds when we're analyzing
    refetchInterval: (query) => {
      const data = query.state.data;
      // Stop polling once we have data
      return data ? false : 3000;
    },
  });

  // Auto-analyze on mount if no analysis exists
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hasTriggeredAnalysis, setHasTriggeredAnalysis] = useState(false);
  const [analysisFailure, setAnalysisFailure] = useState<string | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState<{ progress: number; status: string } | null>(null);

  // Reset state when videoId changes
  React.useEffect(() => {
    setHasTriggeredAnalysis(false);
    setIsAnalyzing(false);
    setAnalysisFailure(null);
    setAnalysisProgress(null);
  }, [videoId]);

  // Poll progress while analyzing
  React.useEffect(() => {
    if (!videoId || !isAnalyzing) {
      setAnalysisProgress(null);
      return;
    }

    const pollProgress = async () => {
      try {
        const result = await api.getAnalysisProgress(videoId);
        if (result.progress !== null && result.progress !== undefined) {
          setAnalysisProgress({ progress: result.progress, status: result.status || '' });
        }
      } catch (error) {
        console.error('[VideoDetailPage] Failed to fetch progress:', error);
      }
    };

    // Poll immediately, then every 500ms
    pollProgress();
    const interval = setInterval(pollProgress, 500);

    return () => clearInterval(interval);
  }, [videoId, isAnalyzing]);

  const video = videos?.find((v) => v.videoId === videoId);

  // Automatically trigger analysis if none exists OR if there are new comments
  React.useEffect(() => {
    console.log("[VideoDetailPage] useEffect check:", {
      videoId,
      hasTriggeredAnalysis,
      isAnalyzing,
      hasError,
      analysisError: !!analysisError,
      analysis: !!analysis,
      analysisLoading,
      videosLoading,
      video: !!video,
      videoCommentCount: video?.stats?.commentCount,
      analysisCommentCount: analysis?.totalComments,
    });

    if (!videoId || hasTriggeredAnalysis || isAnalyzing || analysisLoading || videosLoading) return;

    // Check if we should trigger analysis
    let shouldAnalyze = false;
    let reason = "";

    // Case 1: No analysis exists (404 error)
    if (hasError && !analysis) {
      shouldAnalyze = true;
      reason = "No analysis found";
    }
    // Case 2: Analysis exists but there are new comments
    else if (analysis && video?.stats?.commentCount) {
      const videoCommentCount = video.stats.commentCount;
      const analyzedCommentCount = analysis.totalComments || 0;

      if (videoCommentCount > analyzedCommentCount) {
        shouldAnalyze = true;
        reason = `New comments detected (${videoCommentCount} current vs ${analyzedCommentCount} analyzed)`;
      }
    }

    if (shouldAnalyze) {
      setHasTriggeredAnalysis(true);
      setIsAnalyzing(true);

      console.log(`[VideoDetailPage] ${reason}, auto-analyzing videoId:`, videoId);

      api.analyzeVideo(videoId)
        .then((result) => {
          console.log("[VideoDetailPage] Auto-analysis result:", result);
          setAnalysisFailure(null);
          refetchAnalysis();
        })
        .catch((error) => {
          console.error("[VideoDetailPage] Failed to auto-analyze video:", error);
          const errorMessage = error instanceof Error ? error.message : String(error);
          setAnalysisFailure(errorMessage);
        })
        .finally(() => {
          setIsAnalyzing(false);
        });
    }
  }, [videoId, hasError, analysis, hasTriggeredAnalysis, isAnalyzing, analysisLoading, videosLoading, video, refetchAnalysis]);
  const isLoading = videosLoading || analysisLoading || isAnalyzing;

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/app/videos")}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Videos
        </Button>
        <div className="flex items-center justify-center py-12">
          <div className="text-center max-w-md w-full px-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground mb-4">
              {isAnalyzing ? "Analyzing comments..." : "Loading video details..."}
            </p>
            {isAnalyzing && analysisProgress && (
              <div className="space-y-2">
                <div className="w-full bg-muted rounded-full h-2.5">
                  <div
                    className="bg-primary h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${analysisProgress.progress}%` }}
                  ></div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {analysisProgress.progress}% - {analysisProgress.status}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // If no analysis and we have a failure message, show error
  if (analysisFailure && !analysis) {
    return (
      <div className="space-y-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/app/videos")}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Videos
        </Button>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {analysisFailure}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // If no analysis, show loading (auto-analysis will trigger)
  if (analysisError || !analysis) {
    return (
      <div className="space-y-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/app/videos")}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Videos
        </Button>
        <div className="flex items-center justify-center py-12">
          <div className="text-center max-w-md w-full px-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground mb-4">Analyzing comments...</p>
            {analysisProgress && (
              <div className="space-y-2">
                <div className="w-full bg-muted rounded-full h-2.5">
                  <div
                    className="bg-primary h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${analysisProgress.progress}%` }}
                  ></div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {analysisProgress.progress}% - {analysisProgress.status}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  console.log('[VideoDetailPage] Analysis data:', analysis);
  console.log('[VideoDetailPage] categoryCounts:', analysis.categoryCounts);

  // Use category counts directly (not percentages)
  const sentimentCounts = {
    positive: analysis.categoryCounts?.pos || 0,
    neutral: analysis.categoryCounts?.neu || 0,
    negative: analysis.categoryCounts?.neg || 0,
  };

  // Get sentiment label based on category counts (not sentiment scores)
  const getSentimentLabel = (counts: { positive: number; neutral: number; negative: number }): "Positive" | "Neutral" | "Negative" => {
    if (counts.positive > counts.neutral && counts.positive > counts.negative) {
      return "Positive";
    } else if (counts.negative > counts.positive && counts.negative > counts.neutral) {
      return "Negative";
    } else if (counts.neutral > counts.positive && counts.neutral > counts.negative) {
      return "Neutral";
    }
    // If tied, default to neutral
    return "Neutral";
  };

  const sentimentLabel = getSentimentLabel(sentimentCounts);

  // Calculate percentage for the dominant sentiment to show in the pill
  const total = sentimentCounts.positive + sentimentCounts.neutral + sentimentCounts.negative;
  let sentimentPercentage = 0;
  if (total > 0) {
    if (sentimentLabel === "Positive") {
      sentimentPercentage = (sentimentCounts.positive / total) * 100;
    } else if (sentimentLabel === "Negative") {
      sentimentPercentage = (sentimentCounts.negative / total) * 100;
    } else {
      sentimentPercentage = (sentimentCounts.neutral / total) * 100;
    }
  }

  console.log('[VideoDetailPage] sentimentCounts:', sentimentCounts);

  // Helper function to format timestamp
  const formatTimestamp = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else if (diffDays < 30) {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  // Manual re-analyze handler
  const handleReanalyze = () => {
    if (!videoId) return;

    setIsAnalyzing(true);
    api.analyzeVideo(videoId)
      .then(() => {
        refetchAnalysis();
      })
      .catch((error) => {
        console.error("[VideoDetailPage] Failed to re-analyze:", error);
        alert(`Failed to re-analyze: ${error instanceof Error ? error.message : String(error)}`);
      })
      .finally(() => {
        setIsAnalyzing(false);
      });
  };

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate("/app/videos")}
        className="gap-2"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Videos
      </Button>

      {/* Video header card */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex gap-6">
          {/* Thumbnail */}
          <div className="flex-shrink-0 w-64 h-36 rounded-xl overflow-hidden bg-muted">
            <img
              src={video?.thumbnailUrl || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`}
              alt={video?.title || "Video"}
              className="w-full h-full object-cover"
              onError={(e) => {
                // Fallback to medium quality if maxresdefault doesn't exist
                const target = e.target as HTMLImageElement;
                if (target.src.includes('maxresdefault')) {
                  target.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
                }
              }}
            />
          </div>

          {/* Info */}
          <div className="flex-1">
            <div className="flex items-start justify-between mb-2">
              <h1 className="text-2xl font-bold">{video?.title || "Video Details"}</h1>
              <Button
                variant="outline"
                size="sm"
                onClick={handleReanalyze}
                disabled={isAnalyzing}
                className="ml-4"
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Re-analyzing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Re-analyze
                  </>
                )}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {video ? new Date(video.publishedAt).toLocaleDateString() : ""}
            </p>
            <div className="mb-4">
              <SentimentPill sentiment={sentimentLabel} score={sentimentPercentage / 100} />
            </div>
          </div>
        </div>
      </div>

      {/* Sentiment Analysis - Two Cards Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart Card */}
        <Card className="rounded-2xl border-border">
          <CardHeader>
            <CardTitle>Comment Sentiment</CardTitle>
            <CardDescription>
              Distribution of comment sentiment
              {analysis.totalComments && ` (${analysis.totalComments} comments analyzed)`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SentimentChart
              positive={sentimentCounts.positive}
              neutral={sentimentCounts.neutral}
              negative={sentimentCounts.negative}
            />
          </CardContent>
        </Card>

        {/* AI Summary Card */}
        <Card className="rounded-2xl border-border">
          <CardHeader>
            <CardTitle>AI Summary</CardTitle>
            <CardDescription>
              AI-powered analysis of comments
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {analysis.summary}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Top Positive Comments */}
      {analysis.topPositive.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <span className="text-success">✓</span> Top Positive Comments
          </h2>
          <div className="space-y-3">
            {analysis.topPositive.map((comment) => {
              console.log('[VideoDetailPage] Positive comment:', JSON.stringify(comment, null, 2));
              return (
                <CommentWithReply
                  key={comment.commentId}
                  commenterHandle={comment.author || 'Unknown'}
                  timestamp={comment.publishedAt ? formatTimestamp(comment.publishedAt) : 'Unknown time'}
                  likes={comment.likeCount ?? 0}
                  originalText={comment.text}
                  sentiment="positive"
                  canReply={!!video}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Top Negative Comments */}
      {analysis.topNegative.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <span className="text-destructive">!</span> Top Negative Comments
          </h2>
          <div className="space-y-3">
            {analysis.topNegative.map((comment) => (
              <CommentWithReply
                key={comment.commentId}
                commenterHandle={comment.author}
                timestamp={formatTimestamp(comment.publishedAt)}
                likes={comment.likeCount}
                originalText={comment.text}
                sentiment="negative"
                canReply={!!video}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoDetailPage;
