import { VideoIdInput } from '@/components/VideoIdInput';
import { useChannelData } from '@/hooks/useChannelData';
import { VideoCard } from '@/components/VideoCard';
import { ConnectYouTubeButton } from '@/components/ConnectYouTubeButton';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Video, Loader2, Search, Grid3x3, List } from 'lucide-react';
import { useState, useMemo } from 'react';

type ViewMode = 'grid' | 'list';
type SortOption = 'recent' | 'oldest' | 'most-viewed' | 'most-liked' | 'most-comments';

interface VideoWithStats {
  videoId: string;
  title?: string;
  description?: string;
  publishedAt?: string;
  thumbnailUrl?: string;
  stats?: {
    viewCount?: number;
    likeCount?: number;
    commentCount?: number;
  };
}

export default function Videos() {
  const { videos, channelTitle, isLoading, isYouTubeNotConnected } = useChannelData();

  // Filter and view state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // Filtered and sorted videos
  const filteredVideos = useMemo(() => {
    let filtered = [...videos] as VideoWithStats[];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((video: VideoWithStats) =>
        video.title?.toLowerCase().includes(query) ||
        video.description?.toLowerCase().includes(query)
      );
    }

    // Sort
    filtered.sort((a: VideoWithStats, b: VideoWithStats) => {
      switch (sortBy) {
        case 'recent':
          return new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime();
        case 'oldest':
          return new Date(a.publishedAt || 0).getTime() - new Date(b.publishedAt || 0).getTime();
        case 'most-viewed':
          return (b.stats?.viewCount || 0) - (a.stats?.viewCount || 0);
        case 'most-liked':
          return (b.stats?.likeCount || 0) - (a.stats?.likeCount || 0);
        case 'most-comments':
          return (b.stats?.commentCount || 0) - (a.stats?.commentCount || 0);
        default:
          return 0;
      }
    });

    return filtered;
  }, [videos, searchQuery, sortBy]);

  return (
    <div className="px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight mb-1 text-brand-text-primary">Videos Dashboard</h1>
        <p className="text-brand-text-secondary">
          Analyze your recent uploads and track sentiment across comments.
        </p>
      </div>

      {/* Your Uploads Grid */}
      {isLoading ? (
        <div className="rounded-xl border border-brand-border bg-brand-surface p-6 shadow-card mb-6">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-brand-text-secondary" />
              <p className="text-brand-text-secondary">Loading your videos...</p>
            </div>
          </div>
        </div>
      ) : isYouTubeNotConnected ? (
        <div className="rounded-xl border border-brand-border bg-brand-surface p-6 shadow-card mb-6">
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <Video className="h-16 w-16 mb-4 text-brand-text-secondary" />
            <h3 className="text-xl font-semibold mb-2 text-brand-text-primary">Connect Your YouTube Channel</h3>
            <p className="text-brand-text-secondary text-center mb-6 max-w-md">
              Connect your YouTube account to see your uploads here. You can still analyze any video using the form below.
            </p>
            <ConnectYouTubeButton size="lg" />
          </div>
        </div>
      ) : videos.length > 0 ? (
        <div className="mb-6">
          {/* Header with channel info */}
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-brand-text-primary">Your Uploads</h3>
              {channelTitle && (
                <p className="text-sm text-brand-text-secondary mt-1">
                  Connected as <span className="font-medium">{channelTitle}</span> • {filteredVideos.length} {filteredVideos.length === 1 ? 'video' : 'videos'}
                  {searchQuery && ` matching "${searchQuery}"`}
                </p>
              )}
            </div>

            {/* View mode toggle */}
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('grid')}
              >
                <Grid3x3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="mb-6 space-y-4">
            <div className="flex gap-3">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search videos by title or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Sort */}
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Sort by..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Most Recent</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="most-viewed">Most Viewed</SelectItem>
                  <SelectItem value="most-liked">Most Liked</SelectItem>
                  <SelectItem value="most-comments">Most Comments</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Results count */}
            {searchQuery && (
              <div className="text-sm text-muted-foreground">
                {filteredVideos.length === 0 ? (
                  <span>No videos found matching "{searchQuery}"</span>
                ) : (
                  <span>Showing {filteredVideos.length} of {videos.length} videos</span>
                )}
              </div>
            )}
          </div>

          {/* Videos Grid/List */}
          {filteredVideos.length === 0 ? (
            <div className="text-center py-12 rounded-xl border border-brand-border bg-brand-surface">
              <Video className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
              <p className="text-muted-foreground">No videos found</p>
              {searchQuery && (
                <Button
                  variant="link"
                  onClick={() => setSearchQuery('')}
                  className="mt-2"
                >
                  Clear search
                </Button>
              )}
            </div>
          ) : (
            <div className={
              viewMode === 'grid'
                ? 'grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-6'
                : 'space-y-4'
            }>
              {filteredVideos.map((video: VideoWithStats) => (
                <VideoCard
                  key={video.videoId}
                  video={video as any}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}

      {/* Manual Input (always available as fallback) */}
      <div className="rounded-xl border border-brand-border bg-brand-bg-alt p-6 shadow-card">
        <h3 className="text-lg font-semibold mb-2 text-brand-text-primary">Analyze Any Video</h3>
        <p className="text-sm text-brand-text-secondary mb-4">
          Enter a YouTube video URL or ID to analyze its comments.
        </p>
        <VideoIdInput />
      </div>
    </div>
  );
}
