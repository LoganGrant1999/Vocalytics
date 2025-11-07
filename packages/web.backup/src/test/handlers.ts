import { http, HttpResponse } from 'msw';
import { fixtures } from './fixtures';

// Track POST requests for analysis
const analysisCache = new Map<string, any>();

export const handlers = [
  // GET /api/youtube/videos
  http.get('/api/youtube/videos', ({ request }) => {
    console.log('[MSW] Intercepted GET /api/youtube/videos', request.url);
    return HttpResponse.json(fixtures.videos);
  }),

  // GET /api/analysis (list all analyses)
  http.get('/api/analysis', ({ request }) => {
    console.log('[MSW] Intercepted GET /api/analysis', request.url);
    // Return both fixture analyses and any created via POST
    const allAnalyses = [
      ...fixtures.analysesList,
      ...Array.from(analysisCache.values()),
    ];
    return HttpResponse.json(allAnalyses);
  }),

  // GET /api/analysis/trends
  http.get('/api/analysis/trends', ({ request }) => {
    console.log('[MSW] Intercepted GET /api/analysis/trends', request.url);
    return HttpResponse.json(fixtures.trends);
  }),

  // POST /api/analysis/:videoId (run analysis)
  http.post('/api/analysis/:videoId', async ({ params }) => {
    const { videoId } = params;
    const analysis = fixtures.analysisDetail(videoId as string);

    // Cache this analysis so it appears in list
    analysisCache.set(videoId as string, {
      videoId,
      analyzedAt: analysis.analyzedAt,
      sentiment: analysis.sentiment,
      score: analysis.score,
    });

    return HttpResponse.json(analysis);
  }),

  // GET /api/analysis/:videoId (get specific analysis)
  http.get('/api/analysis/:videoId', ({ params }) => {
    const { videoId } = params;

    // Check cache first
    if (analysisCache.has(videoId as string)) {
      return HttpResponse.json(
        fixtures.analysisDetail(videoId as string)
      );
    }

    // Check fixtures
    const existing = fixtures.analysesList.find(
      (a) => a.videoId === videoId
    );
    if (existing) {
      return HttpResponse.json(fixtures.analysisDetail(videoId as string));
    }

    // Return 404
    return HttpResponse.json(
      { error: 'Not found' },
      { status: 404 }
    );
  }),
];

// Reset cache between tests
export function resetAnalysisCache() {
  analysisCache.clear();
}
