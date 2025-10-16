import { vi } from 'vitest';
import { fixtures } from '../fixtures';

// Track analysis cache for POST requests
const analysisCache = new Map<string, any>();

/**
 * Mock API client for testing
 * Replaces the real API client with in-memory fixture data
 */
export const mockApi = {
  youtube: {
    listMyVideos: vi.fn().mockResolvedValue(fixtures.videos),
  },
  analysis: {
    run: vi.fn().mockImplementation(async (videoId: string) => {
      const analysis = fixtures.analysisDetail(videoId);
      analysisCache.set(videoId, {
        videoId,
        analyzedAt: analysis.analyzedAt,
        sentiment: analysis.sentiment,
        score: analysis.score,
      });
      return analysis;
    }),
    get: vi.fn().mockImplementation(async (videoId: string) => {
      if (analysisCache.has(videoId)) {
        return fixtures.analysisDetail(videoId);
      }
      const existing = fixtures.analysesList.find((a) => a.videoId === videoId);
      if (existing) {
        return fixtures.analysisDetail(videoId);
      }
      throw new Error('Not found');
    }),
    list: vi.fn().mockImplementation(async () => {
      const allAnalyses = [
        ...fixtures.analysesList,
        ...Array.from(analysisCache.values()),
      ];
      return allAnalyses;
    }),
    trends: vi.fn().mockResolvedValue(fixtures.trends),
  },
};

export function resetMockApi() {
  analysisCache.clear();
  vi.clearAllMocks();
  mockApi.youtube.listMyVideos.mockResolvedValue(fixtures.videos);
  mockApi.analysis.list.mockImplementation(async () => {
    const allAnalyses = [
      ...fixtures.analysesList,
      ...Array.from(analysisCache.values()),
    ];
    return allAnalyses;
  });
  mockApi.analysis.trends.mockResolvedValue(fixtures.trends);
}
