import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import VideoListItem from "@/components/shared/VideoListItem";
import VideoAnalysisInput from "@/components/shared/VideoAnalysisInput";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { AlertCircle, Youtube, Search } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";

const VideosPage = () => {
  const navigate = useNavigate();
  const [videos, setVideos] = useState<any[]>([]);
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError("");

        // Fetch both videos and analyses in parallel
        const [videosData, analysesData] = await Promise.all([
          api.getVideos({ mine: true, limit: 20 }),
          api.listAnalyses().catch(() => []), // Don't fail if no analyses exist
        ]);

        setVideos(videosData);
        setAnalyses(analysesData);
      } catch (err: any) {
        console.error("Failed to fetch data:", err);
        if (err.message?.includes("YouTube not connected") || err.message?.includes("YOUTUBE_NOT_CONNECTED")) {
          setError("YouTube not connected. Please connect your YouTube account to see your videos.");
        } else {
          setError(err.message || "Failed to load videos");
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleConnectYouTube = () => {
    navigate("/connect");
  };

  // Helper to format date as MM/DD/YYYY
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  };

  // Filter videos by search query
  const filteredVideos = videos.filter((video) =>
    video.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Your Videos</h1>
          <p className="text-muted-foreground">
            Loading your videos...
          </p>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Your Videos</h1>
          <p className="text-muted-foreground">
            Click a video to view sentiment, priority comments, and suggested replies.
          </p>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button onClick={handleConnectYouTube}>
          <Youtube className="w-4 h-4 mr-2" />
          Connect YouTube
        </Button>

        {/* Analyze Any Video Section - available even without connection */}
        <div className="pt-6">
          <VideoAnalysisInput />
        </div>
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Your Videos</h1>
          <p className="text-muted-foreground">
            No videos found on your channel.
          </p>
        </div>

        {/* Analyze Any Video Section - available even with no videos */}
        <div className="pt-6">
          <VideoAnalysisInput />
        </div>
      </div>
    );
  }

  // Helper to get sentiment label from categoryCounts
  const getSentimentLabel = (counts: { pos: number; neu: number; neg: number }): "Positive" | "Neutral" | "Negative" => {
    if (counts.pos > counts.neu && counts.pos > counts.neg) {
      return "Positive";
    } else if (counts.neg > counts.pos && counts.neg > counts.neu) {
      return "Negative";
    } else if (counts.neu > counts.pos && counts.neu > counts.neg) {
      return "Neutral";
    }
    // If tied, default to neutral
    return "Neutral";
  };

  // Helper to merge video with its analysis data
  const getVideoWithAnalysis = (video: any) => {
    const analysis = analyses.find((a) => a.videoId === video.videoId);

    // No analysis exists
    if (!analysis) {
      const commentCount = video.stats?.commentCount || 0;
      return {
        ...video,
        sentimentSummary: commentCount === 0 ? "No comments" : "Click to analyze",
        sentiment: "Neutral" as const,
        sentimentScore: 0,
        newComments: commentCount,
        priorityReplies: 0,
      };
    }

    console.log(`[VideosPage] Analysis for ${video.videoId}:`, {
      categoryCounts: analysis.categoryCounts,
      totalComments: analysis.totalComments,
      sentiment: analysis.sentiment,
    });

    // Get sentiment label from category counts (not sentiment scores)
    const categoryCounts = analysis.categoryCounts || { pos: 0, neu: 0, neg: 0 };
    const sentimentLabel = getSentimentLabel(categoryCounts);

    // Calculate percentage for the dominant sentiment
    const total = (analysis.categoryCounts?.pos || 0) + (analysis.categoryCounts?.neu || 0) + (analysis.categoryCounts?.neg || 0);
    let sentimentPercentage = 0;
    if (total > 0) {
      if (sentimentLabel === "Positive") {
        sentimentPercentage = ((analysis.categoryCounts?.pos || 0) / total) * 100;
      } else if (sentimentLabel === "Negative") {
        sentimentPercentage = ((analysis.categoryCounts?.neg || 0) / total) * 100;
      } else {
        sentimentPercentage = ((analysis.categoryCounts?.neu || 0) / total) * 100;
      }
    }

    console.log(`[VideosPage] Calculated for ${video.videoId}:`, {
      sentimentLabel,
      total,
      sentimentPercentage,
    });

    // Calculate new comments since last analysis
    const analyzedComments = analysis.totalComments || 0;
    const currentComments = video.stats?.commentCount || 0;
    const newComments = Math.max(0, currentComments - analyzedComments);

    return {
      ...video,
      sentimentSummary: analysis.summary || "Analysis complete",
      sentiment: sentimentLabel,
      sentimentScore: sentimentPercentage / 100,
      newComments,
      priorityReplies: (analysis.topNegative?.length || 0) + (analysis.topPositive?.length || 0),
    };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">Your Videos</h1>
        <p className="text-muted-foreground">
          Click a video to view sentiment, priority comments, and suggested replies.
        </p>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          type="text"
          placeholder="Search videos by title..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Videos grid */}
      <div className="space-y-4">
        {filteredVideos.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            {searchQuery ? "No videos found matching your search." : "No videos found."}
          </p>
        ) : (
          filteredVideos.map((video) => {
            const videoWithAnalysis = getVideoWithAnalysis(video);
            return (
              <VideoListItem
                key={video.videoId}
                videoId={videoWithAnalysis.videoId}
                thumbnailUrl={videoWithAnalysis.thumbnailUrl}
                title={videoWithAnalysis.title}
                publishedAt={formatDate(videoWithAnalysis.publishedAt)}
                sentimentSummary={videoWithAnalysis.sentimentSummary}
                sentiment={videoWithAnalysis.sentiment}
                sentimentScore={videoWithAnalysis.sentimentScore}
                newComments={videoWithAnalysis.newComments}
                priorityReplies={videoWithAnalysis.priorityReplies}
              />
            );
          })
        )}
      </div>

      {/* Analyze Any Video Section */}
      <div className="pt-6">
        <VideoAnalysisInput />
      </div>
    </div>
  );
};

export default VideosPage;
