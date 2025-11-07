import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import VideoListItem from "@/components/shared/VideoListItem";
import VideoAnalysisInput from "@/components/shared/VideoAnalysisInput";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { AlertCircle, Youtube } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const VideosPage = () => {
  const navigate = useNavigate();
  const [videos, setVideos] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        setIsLoading(true);
        setError("");
        const data = await api.getVideos({ mine: true, limit: 20 });
        setVideos(data);
      } catch (err: any) {
        console.error("Failed to fetch videos:", err);
        if (err.message?.includes("YouTube not connected") || err.message?.includes("YOUTUBE_NOT_CONNECTED")) {
          setError("YouTube not connected. Please connect your YouTube account to see your videos.");
        } else {
          setError(err.message || "Failed to load videos");
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchVideos();
  }, []);

  const handleConnectYouTube = () => {
    navigate("/connect");
  };

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">Your Videos</h1>
        <p className="text-muted-foreground">
          Click a video to view sentiment, priority comments, and suggested replies.
        </p>
      </div>

      {/* Videos grid */}
      <div className="space-y-4">
        {videos.map((video) => (
          <VideoListItem
            key={video.videoId}
            thumbnailUrl={video.thumbnailUrl}
            title={video.title}
            publishedAt={video.publishedAt}
            sentimentSummary="Click to analyze"
            sentiment="Mixed"
            sentimentScore={0}
            newComments={video.stats?.commentCount || 0}
            priorityReplies={0}
          />
        ))}
      </div>

      {/* Analyze Any Video Section */}
      <div className="pt-6">
        <VideoAnalysisInput />
      </div>
    </div>
  );
};

export default VideosPage;
