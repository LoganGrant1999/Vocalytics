import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import type { VideoCard as VideoCardType } from '@/hooks/useChannelData';

interface VideoCardProps {
  video: VideoCardType;
  onAnalyze?: (videoId: string) => void;
  isAnalyzing?: boolean;
}

/**
 * Get color class for sentiment score badge
 */
function getSentimentColor(score: number): string {
  if (score >= 0.6) return 'bg-green-500 hover:bg-green-600';
  if (score >= 0.4) return 'bg-yellow-500 hover:bg-yellow-600';
  return 'bg-red-500 hover:bg-red-600';
}

/**
 * Format date to relative time (e.g., "2 days ago")
 */
function formatRelativeDate(dateString?: string): string {
  if (!dateString) return '';

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

/**
 * Format number with K/M suffix
 */
function formatCount(count?: number): string {
  if (!count) return '0';
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return count.toString();
}

export function VideoCard({ video, onAnalyze, isAnalyzing }: VideoCardProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (onAnalyze) {
      onAnalyze(video.videoId);
    } else {
      navigate(`/analyze/${video.videoId}`);
    }
  };

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
      <div className="aspect-video bg-muted relative" onClick={handleClick}>
        {video.thumbnailUrl ? (
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            className="object-cover w-full h-full"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            No thumbnail
          </div>
        )}
      </div>

      <CardContent className="p-4 space-y-2">
        <h3 className="font-semibold line-clamp-2 min-h-[3rem]" onClick={handleClick}>
          {video.title}
        </h3>

        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          {video.stats.viewCount !== undefined && (
            <span>{formatCount(video.stats.viewCount)} views</span>
          )}
          {video.stats.commentCount !== undefined && (
            <span>{formatCount(video.stats.commentCount)} comments</span>
          )}
          {video.publishedAt && (
            <span>{formatRelativeDate(video.publishedAt)}</span>
          )}
        </div>

        <div>
          {video.sentimentScore !== undefined ? (
            <Badge className={getSentimentColor(video.sentimentScore)}>
              Score: {video.sentimentScore.toFixed(2)}
            </Badge>
          ) : (
            <Badge variant="outline">Not analyzed</Badge>
          )}
        </div>
      </CardContent>

      <CardFooter className="p-4 pt-0">
        <Button
          onClick={handleClick}
          disabled={isAnalyzing}
          variant="outline"
          className="w-full"
        >
          {isAnalyzing ? 'Analyzing...' : video.sentimentScore !== undefined ? 'View Analysis' : 'Analyze'}
        </Button>
      </CardFooter>
    </Card>
  );
}
