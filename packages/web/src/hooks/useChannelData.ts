import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

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

  // Fetch user's videos
  const videosQuery = useQuery({
    queryKey: ['videos'],
    queryFn: () => api.youtube.listMyVideos({ limit: 20 }),
    staleTime: 5 * 60 * 1000, // 5 minutes
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
    mutationFn: (videoId: string) => api.analysis.run(videoId),
    onSuccess: () => {
      // Invalidate related queries to trigger refetch
      queryClient.invalidateQueries({ queryKey: ['analyses'] });
      queryClient.invalidateQueries({ queryKey: ['trends'] });
    },
  });

  // Merge videos with analyses
  const videos =
    videosQuery.data && analysesQuery.data
      ? decorateVideoCards(videosQuery.data, analysesQuery.data)
      : [];

  const isLoading =
    videosQuery.isLoading || analysesQuery.isLoading || trendsQuery.isLoading;

  return {
    videos,
    analyses: analysesQuery.data || [],
    trends: trendsQuery.data || [],
    isLoading,
    analyze: analyzeMutation.mutateAsync,
    isAnalyzing: analyzeMutation.isPending,
  };
}
