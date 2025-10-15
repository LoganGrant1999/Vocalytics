import createClient from 'openapi-fetch';
import type { paths } from '@/types/api';
import { requestStore } from './requestStore';

/**
 * Typed API client for the Vocalytics backend.
 * All requests are made to /api/* which is proxied to the backend server.
 * Automatically tracks requests for debugging.
 */
const client = createClient<paths>({
  baseUrl: '',
  credentials: 'include', // Send cookies with cross-origin requests
});

// Middleware to track all requests
client.use({
  async onResponse({ response, request }) {
    const requestId = response.headers.get('x-request-id');
    const method = request.method;
    const path = new URL(request.url).pathname;

    requestStore.add({
      method,
      path,
      status: response.status,
      requestId,
      timestamp: new Date(),
    });

    return response;
  },
});

/**
 * Helper type for extracting response data from a successful API call
 */
export type ApiResponse<
  Path extends keyof paths,
  Method extends keyof paths[Path],
> = paths[Path][Method] extends { responses: { 200: { content: { 'application/json': infer T } } } }
  ? T
  : never;

/**
 * Helper type for extracting error response from API calls
 */
export type ApiError<
  Path extends keyof paths,
  Method extends keyof paths[Path],
> = paths[Path][Method] extends {
  responses: infer Responses;
}
  ? Responses extends Record<number, unknown>
    ? {
        [K in keyof Responses]: K extends `${4 | 5}${number}`
          ? Responses[K] extends { content: { 'application/json': infer E } }
            ? E
            : never
          : never;
      }[keyof Responses]
    : never
  : never;

/**
 * Typed API wrapper methods for convenience
 */
export const api = {
  /**
   * YouTube API methods
   */
  youtube: {
    /**
     * List user's uploaded videos with stats
     */
    listMyVideos: async ({ limit = 20 }: { limit?: number } = {}) => {
      const result = await client.GET('/api/youtube/videos', {
        params: {
          query: {
            mine: true,
            limit,
          },
        },
      });

      if (result.error) {
        throw new Error(result.error.error || 'Failed to fetch videos');
      }

      return result.data;
    },
  },

  /**
   * Analysis API methods
   */
  analysis: {
    /**
     * Run analysis on a video (triggers sentiment analysis)
     */
    run: async (videoId: string) => {
      const result = await client.POST('/api/analysis/{videoId}', {
        params: {
          path: { videoId },
        },
      });

      if (result.error) {
        throw new Error(result.error.error || 'Failed to run analysis');
      }

      return result.data;
    },

    /**
     * Get latest analysis for a specific video
     */
    get: async (videoId: string) => {
      const result = await client.GET('/api/analysis/{videoId}', {
        params: {
          path: { videoId },
        },
      });

      if (result.error) {
        throw new Error(result.error.error || 'Failed to get analysis');
      }

      return result.data;
    },

    /**
     * List all latest analyses for user
     */
    list: async () => {
      const result = await client.GET('/api/analysis');

      if (result.error) {
        throw new Error(result.error.error || 'Failed to list analyses');
      }

      return result.data;
    },

    /**
     * Get sentiment trends over time
     */
    trends: async ({ days = 90 }: { days?: number } = {}) => {
      const result = await client.GET('/api/analysis/trends', {
        params: {
          query: { days },
        },
      });

      if (result.error) {
        throw new Error(result.error.error || 'Failed to get trends');
      }

      return result.data;
    },
  },
};
