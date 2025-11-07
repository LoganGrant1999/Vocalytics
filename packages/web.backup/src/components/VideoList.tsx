import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Play, Calendar, Eye, BarChart3 } from 'lucide-react';

interface Video {
  id: string;
  title: string;
  thumbnail?: string;
  publishedAt?: string;
  viewCount?: number | string;
  commentCount?: number | string;
}

interface VideoListProps {
  videos: Video[];
  isLoading?: boolean;
}

/**
 * Component to display a list of YouTube videos with analyze buttons.
 * Fetched from /api/youtube/videos endpoint.
 */
export function VideoList({ videos, isLoading }: VideoListProps) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading videos...</p>
        </div>
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="rounded-lg border p-12 text-center">
        <Play className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-semibold mb-2">No videos found</h3>
        <p className="text-muted-foreground">
          We couldn't find any videos on your channel.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {videos.map((video) => (
        <div
          key={video.id}
          className="rounded-lg border p-4 flex gap-4 hover:bg-accent/50 transition-colors"
        >
          {/* Thumbnail */}
          {video.thumbnail ? (
            <div className="flex-shrink-0">
              <img
                src={video.thumbnail}
                alt={video.title}
                className="w-40 h-24 object-cover rounded"
              />
            </div>
          ) : (
            <div className="flex-shrink-0 w-40 h-24 bg-muted rounded flex items-center justify-center">
              <Play className="h-8 w-8 text-muted-foreground" />
            </div>
          )}

          {/* Details */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold mb-2 line-clamp-2">{video.title}</h3>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              {video.publishedAt && (
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(video.publishedAt).toLocaleDateString()}
                </div>
              )}
              {video.viewCount !== undefined && (
                <div className="flex items-center gap-1">
                  <Eye className="h-3 w-3" />
                  {typeof video.viewCount === 'number'
                    ? video.viewCount.toLocaleString()
                    : video.viewCount}{' '}
                  views
                </div>
              )}
              {video.commentCount !== undefined && (
                <div className="flex items-center gap-1">
                  <BarChart3 className="h-3 w-3" />
                  {typeof video.commentCount === 'number'
                    ? video.commentCount.toLocaleString()
                    : video.commentCount}{' '}
                  comments
                </div>
              )}
            </div>
          </div>

          {/* Action */}
          <div className="flex-shrink-0 flex items-center">
            <Button onClick={() => navigate(`/analyze/${video.id}`)}>
              <BarChart3 className="mr-2 h-4 w-4" />
              Analyze
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
