import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Session {
  tier: 'free' | 'pro';
  comments_analyzed_count: number;
  replies_generated_count: number;
  scopes?: string[];
  user?: {
    id: string;
    email?: string;
    name?: string;
  };
}

/**
 * Hook to fetch and manage the current user session.
 * Calls GET /api/me/subscription and GET /api/me/usage to retrieve session info.
 * Data is stored in memory only - page refresh will re-fetch.
 */
export function useSession() {
  const query = useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      // Fetch subscription and usage data in parallel
      const [subResult, usageResult] = await Promise.all([
        api.GET('/api/me/subscription', {}),
        api.GET('/api/me/usage', {}),
      ]);

      if (subResult.error || usageResult.error) {
        // If either fails, user is not authenticated
        return null;
      }

      if (!subResult.data || !usageResult.data) {
        return null;
      }

      return {
        tier: subResult.data.tier || 'free',
        comments_analyzed_count: usageResult.data.commentsAnalyzed || 0,
        replies_generated_count: usageResult.data.repliesGenerated || 0,
        scopes: (subResult.data as any).scopes || [],
      } as Session;
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    session: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}

/**
 * Hook to check environment status (dev only).
 * Calls GET /healthz to verify service health.
 */
export function useEnvStatus() {
  const query = useQuery({
    queryKey: ['env-status'],
    queryFn: async () => {
      const { data, error } = await api.GET('/healthz', {});

      if (error) {
        return null;
      }

      return data;
    },
    retry: false,
    staleTime: 60 * 1000, // 1 minute
    enabled: process.env.NODE_ENV === 'development',
  });

  return {
    envStatus: query.data ?? null,
    isLoading: query.isLoading,
  };
}
