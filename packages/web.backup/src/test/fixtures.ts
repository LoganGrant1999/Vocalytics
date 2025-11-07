export const fixtures = {
  videos: [
    {
      videoId: 'vid-a',
      title: 'How I Edit',
      thumbnailUrl: 'thumb-a',
      publishedAt: '2025-10-01T00:00:00Z',
      stats: { viewCount: 1200, commentCount: 45 },
    },
    {
      videoId: 'vid-b',
      title: 'My Gear Setup',
      thumbnailUrl: 'thumb-b',
      publishedAt: '2025-10-05T00:00:00Z',
      stats: { viewCount: 800, commentCount: 20 },
    },
    {
      videoId: 'vid-c',
      title: 'Studio Tour',
      thumbnailUrl: 'thumb-c',
      publishedAt: '2025-10-09T00:00:00Z',
      stats: { viewCount: 2100, commentCount: 77 },
    },
  ],
  analysesList: [
    {
      videoId: 'vid-a',
      analyzedAt: '2025-10-10T12:00:00Z',
      sentiment: { pos: 0.6, neu: 0.28, neg: 0.12 },
      score: 0.48,
    },
  ],
  analysisDetail: (id: string) => ({
    videoId: id,
    analyzedAt: new Date().toISOString(),
    sentiment: { pos: 0.62, neu: 0.25, neg: 0.13 },
    score: 0.49,
    summary: 'Viewers loved editing; audio flagged.',
  }),
  trends: [
    { date: '2025-10-07T00:00:00Z', avgScore: 0.4 },
    { date: '2025-10-10T00:00:00Z', avgScore: 0.46 },
    { date: '2025-10-13T00:00:00Z', avgScore: 0.52 },
  ],
};
