import SentimentPill from "./SentimentPill";
import { useNavigate } from "react-router-dom";

interface VideoListItemProps {
  videoId?: string;
  thumbnailUrl: string;
  title: string;
  publishedAt: string;
  sentimentSummary: string;
  sentiment: "Positive" | "Mixed" | "Negative";
  sentimentScore: number;
  newComments: number;
  priorityReplies: number;
}

const VideoListItem = ({
  videoId = "mock-video-id",
  thumbnailUrl,
  title,
  publishedAt,
  sentiment,
  sentimentScore,
  newComments,
  priorityReplies,
}: VideoListItemProps) => {
  const navigate = useNavigate();
  
  const handleClick = () => {
    navigate(`/app/video/${videoId}`);
  };

  return (
    <div
      onClick={handleClick}
      className="rounded-2xl border border-border bg-card p-4 hover:border-primary/30 hover:glow-border transition-all duration-300 cursor-pointer group"
    >
      <div className="flex gap-4">
        {/* Thumbnail */}
        <div className="flex-shrink-0 w-40 h-24 rounded-xl overflow-hidden bg-muted">
          <img
            src={thumbnailUrl}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold mb-1 truncate group-hover:text-primary transition-colors">
            {title}
          </h3>
          <p className="text-xs text-muted-foreground mb-3">{publishedAt}</p>
          
          <div className="flex items-center gap-3 flex-wrap">
            <SentimentPill sentiment={sentiment} score={sentimentScore} />
            <span className="text-xs text-muted-foreground">
              {newComments} new comments • {priorityReplies} priority replies
            </span>
          </div>
        </div>
      </div>
      {/* TODO: GET /api/youtube/videos + POST /api/analyze-comments per video */}
    </div>
  );
};

export default VideoListItem;
