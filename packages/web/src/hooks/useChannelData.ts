import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useAuth } from '@/contexts/AuthContext';

export interface VideoCard {
  videoId: string;
  title: string;
  thumbnailUrl?: string;
  publishedAt?: string;
  stats: {
    viewCount?: number;
    likeCount?: number;
    commentCount?: number;
  };
  sentimentScore?: number;
}

/**
 * Merge videos with their latest analyses to create decorated video cards
 */
function decorateVideoCards(
  videos: Awaited<ReturnType<typeof api.youtube.listMyVideos>>,
  analyses: Awaited<ReturnType<typeof api.analysis.list>>
): VideoCard[] {
  const analysisMap = new Map(
    analyses.map((a) => [a.videoId, a.score])
  );

  return videos.map((video) => ({
    videoId: video.videoId,
    title: video.title,
    thumbnailUrl: video.thumbnailUrl,
    publishedAt: video.publishedAt,
    stats: video.stats || {},
    sentimentScore: analysisMap.get(video.videoId),
  }));
}

/**
 * Hook for fetching and managing channel data (videos, analyses, trends)
 */
export function useChannelData() {
  const queryClient = useQueryClient();
  const analytics = useAnalytics();
  const { user } = useAuth();

  // Fetch user's videos - only if YouTube is connected
  const videosQuery = useQuery({
    queryKey: ['videos'],
    queryFn: async () => {
      const response = await api.GET('/api/youtube/videos', {
        params: { query: { mine: true, limit: 20 } },
      });

      if (response.error) {
        throw new Error(response.error as any);
      }

      const videos = response.data || [];
      const channelTitle = response.response.headers.get('x-youtube-channel') || '';

      analytics.track({
        name: 'videos_listed',
        properties: { count: videos.length },
      });

      return { videos, channelTitle };
    },
    enabled: user?.hasYouTubeConnected === true, // Only fetch if YouTube is connected
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false, // No retries needed since we check connection first
  });

  // Fetch all analyses
  const analysesQuery = useQuery({
    queryKey: ['analyses'],
    queryFn: () => api.analysis.list(),
    staleTime: 1 * 60 * 1000, // 1 minute
  });

  // Fetch trends
  const trendsQuery = useQuery({
    queryKey: ['trends'],
    queryFn: () => api.analysis.trends({ days: 90 }),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Mutation for running analysis
  const analyzeMutation = useMutation({
    mutationFn: async (videoId: string) => {
      analytics.track({
        name: 'analysis_started',
        properties: { videoId },
      });
      const result = await api.analysis.run(videoId);
      return { videoId, result };
    },
    onSuccess: ({ videoId, result }) => {
      analytics.track({
        name: 'analysis_completed',
        properties: { videoId, score: result.score },
      });
      // Invalidate related queries to trigger refetch
      queryClient.invalidateQueries({ queryKey: ['analyses'] });
      queryClient.invalidateQueries({ queryKey: ['trends'] });
    },
  });

  // Check if YouTube is not connected
  const isYouTubeNotConnected = user?.hasYouTubeConnected === false;

  // Extract channel title and videos
  const channelTitle = videosQuery.data?.channelTitle || '';
  const rawVideos = videosQuery.data?.videos || [];

  // Merge videos with analyses
  const videos =
    rawVideos.length > 0 && analysesQuery.data
      ? decorateVideoCards(rawVideos, analysesQuery.data)
      : [];

  const isLoading =
    videosQuery.isLoading || analysesQuery.isLoading || trendsQuery.isLoading;

  return {
    videos,
    channelTitle,
    analyses: analysesQuery.data || [],
    trends: trendsQuery.data || [],
    isLoading,
    isYouTubeNotConnected,
    videosError: videosQuery.error,
    analyze: analyzeMutation.mutateAsync,
    isAnalyzing: analyzeMutation.isPending,
  };
}
