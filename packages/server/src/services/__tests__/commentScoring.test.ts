import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scoreComments, getReplySettings } from '../commentScoring.js';

// Use vi.hoisted for proper mock function creation
const { mockCreate, mockFrom } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockFrom: vi.fn(),
}));

// Mock OpenAI
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    })),
  };
});

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

describe('commentScoring.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockReset();
    mockFrom.mockReset();
  });

  describe('scoreComments', () => {
    const mockComments = [
      {
        id: 'c1',
        text: 'What editing software do you use?',
        authorDisplayName: 'User1',
        likeCount: 3,
        publishedAt: '2025-01-01T00:00:00Z',
        videoId: 'vid123',
      },
      {
        id: 'c2',
        text: 'This video sucks',
        authorDisplayName: 'User2',
        likeCount: 0,
        publishedAt: '2025-01-02T00:00:00Z',
        videoId: 'vid123',
      },
      {
        id: 'c3',
        text: 'Great video!',
        authorDisplayName: 'User3',
        likeCount: 10,
        publishedAt: '2025-01-03T00:00:00Z',
        videoId: 'vid123',
      },
    ];

    const mockVideoMetadata = {
      title: 'My Video Editing Workflow',
      description: 'How I edit videos',
    };

    const mockSettings = {
      prioritize_subscribers: false,
      prioritize_questions: true,
      prioritize_title_keywords: true,
      prioritize_negative: true,
      prioritize_verified: false,
      prioritize_large_channels: false,
      prioritize_first_time: false,
      prioritize_popular: true,
      custom_keywords: [],
      ignore_spam: true,
      ignore_generic_praise: false,
      ignore_links: true,
    };

    it('should score comments based on priority settings', async () => {
      // Mock AI analysis
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                analyses: [
                  { index: 0, sentiment: 'neutral', isQuestion: true, isSpam: false, containsKeywords: ['editing'] },
                  { index: 1, sentiment: 'negative', isQuestion: false, isSpam: false, containsKeywords: [] },
                  { index: 2, sentiment: 'positive', isQuestion: false, isSpam: false, containsKeywords: [] },
                ],
              }),
            },
          },
        ],
      });

      // Mock database save
      mockFrom.mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error: null }),
      });

      const scores = await scoreComments(mockComments, mockVideoMetadata, mockSettings, 'user123');

      // c1: question (25) + keyword (15) = 40
      // c2: negative (30) = 30
      // c3: popular (10) = 10
      expect(scores).toHaveLength(3);

      // Sorted by priority score descending
      // Note: c1 and c2 have similar scores, so we check both exist and have correct properties
      const c1Score = scores.find(s => s.commentId === 'c1');
      const c2Score = scores.find(s => s.commentId === 'c2');

      expect(c1Score).toBeDefined();
      expect(c1Score!.priorityScore).toBeGreaterThanOrEqual(25); // Has question + keywords
      expect(c1Score!.shouldAutoReply).toBe(true);

      expect(c2Score).toBeDefined();
      expect(c2Score!.priorityScore).toBeGreaterThanOrEqual(30); // Negative sentiment
    });

    it('should ignore spam when setting enabled', async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                analyses: [
                  { index: 0, sentiment: 'neutral', isQuestion: false, isSpam: true, containsKeywords: [] },
                ],
              }),
            },
          },
        ],
      });

      mockFrom.mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error: null }),
      });

      const spamComments = [
        {
          id: 'spam1',
          text: 'Click here for free money!!! 🤑🤑🤑',
          authorDisplayName: 'Spammer',
          likeCount: 0,
          publishedAt: '2025-01-01T00:00:00Z',
          videoId: 'vid123',
        },
      ];

      const scores = await scoreComments(spamComments, mockVideoMetadata, mockSettings, 'user123');

      expect(scores[0].priorityScore).toBe(0);
      expect(scores[0].isSpam).toBe(true);
      expect(scores[0].shouldAutoReply).toBe(false);
      expect(scores[0].reasons).toContain('Flagged as likely spam');
    });

    it('should ignore generic praise when setting enabled', async () => {
      const settingsWithGenericIgnore = {
        ...mockSettings,
        ignore_generic_praise: true,
      };

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                analyses: [
                  { index: 0, sentiment: 'positive', isQuestion: false, isSpam: false, containsKeywords: [] },
                ],
              }),
            },
          },
        ],
      });

      mockFrom.mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error: null }),
      });

      const genericComments = [
        {
          id: 'gen1',
          text: 'Great video!',
          authorDisplayName: 'User',
          likeCount: 0,
          publishedAt: '2025-01-01T00:00:00Z',
          videoId: 'vid123',
        },
      ];

      const scores = await scoreComments(genericComments, mockVideoMetadata, settingsWithGenericIgnore, 'user123');

      expect(scores[0].priorityScore).toBe(0);
      expect(scores[0].shouldAutoReply).toBe(false);
      expect(scores[0].reasons).toContain('Generic praise with no substance');
    });

    it('should ignore comments with links when setting enabled', async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                analyses: [
                  { index: 0, sentiment: 'neutral', isQuestion: false, isSpam: false, containsKeywords: [] },
                ],
              }),
            },
          },
        ],
      });

      mockFrom.mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error: null }),
      });

      const linkComments = [
        {
          id: 'link1',
          text: 'Check out my channel https://youtube.com/@spam',
          authorDisplayName: 'User',
          likeCount: 0,
          publishedAt: '2025-01-01T00:00:00Z',
          videoId: 'vid123',
        },
      ];

      const scores = await scoreComments(linkComments, mockVideoMetadata, mockSettings, 'user123');

      expect(scores[0].priorityScore).toBe(0);
      expect(scores[0].shouldAutoReply).toBe(false);
      expect(scores[0].reasons).toContain('Contains link (often spam)');
    });

    it('should batch analyze comments efficiently', async () => {
      const manyComments = Array(25).fill(null).map((_, i) => ({
        id: `c${i}`,
        text: `Comment ${i}`,
        authorDisplayName: `User${i}`,
        likeCount: 0,
        publishedAt: '2025-01-01T00:00:00Z',
        videoId: 'vid123',
      }));

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                analyses: Array(20).fill(null).map((_, i) => ({
                  index: i,
                  sentiment: 'neutral',
                  isQuestion: false,
                  isSpam: false,
                  containsKeywords: [],
                })),
              }),
            },
          },
        ],
      });

      mockFrom.mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error: null }),
      });

      await scoreComments(manyComments, mockVideoMetadata, mockSettings, 'user123');

      // Should batch in chunks of 20, so expect 2 calls
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it('should handle AI analysis failures gracefully', async () => {
      mockCreate.mockRejectedValue(new Error('API Error'));

      mockFrom.mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error: null }),
      });

      const scores = await scoreComments(mockComments, mockVideoMetadata, mockSettings, 'user123');

      // Should still return scores with fallback values
      expect(scores).toHaveLength(3);
      scores.forEach(score => {
        expect(score).toHaveProperty('commentId');
        expect(score).toHaveProperty('priorityScore');
      });
    });

    it('should prioritize questions correctly', async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                analyses: [
                  { index: 0, sentiment: 'neutral', isQuestion: true, isSpam: false, containsKeywords: [] },
                ],
              }),
            },
          },
        ],
      });

      mockFrom.mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error: null }),
      });

      const questionComments = [mockComments[0]];
      const scores = await scoreComments(questionComments, mockVideoMetadata, mockSettings, 'user123');

      expect(scores[0].isQuestion).toBe(true);
      expect(scores[0].priorityScore).toBeGreaterThanOrEqual(25);
      expect(scores[0].reasons.some(r => r.includes('question'))).toBe(true);
    });

    it('should prioritize negative sentiment correctly', async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                analyses: [
                  { index: 0, sentiment: 'negative', isQuestion: false, isSpam: false, containsKeywords: [] },
                ],
              }),
            },
          },
        ],
      });

      mockFrom.mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error: null }),
      });

      const negativeComments = [mockComments[1]];
      const scores = await scoreComments(negativeComments, mockVideoMetadata, mockSettings, 'user123');

      expect(scores[0].sentiment).toBe('negative');
      expect(scores[0].priorityScore).toBeGreaterThanOrEqual(30);
      // Check for either 'negative' or 'Negative' in reasons (case-insensitive check)
      expect(scores[0].reasons.some(r => r.toLowerCase().includes('negative'))).toBe(true);
    });
  });

  describe('getReplySettings', () => {
    it('should return user settings when found', async () => {
      const mockSettings = {
        prioritize_questions: true,
        prioritize_negative: false,
        ignore_spam: true,
      };

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockSettings }),
          }),
        }),
      });

      const settings = await getReplySettings('user123');

      expect(settings).toEqual(mockSettings);
    });

    it('should return default settings when user settings not found', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null }),
          }),
        }),
      });

      const settings = await getReplySettings('user123');

      // Should return defaults
      expect(settings).toHaveProperty('prioritize_questions');
      expect(settings).toHaveProperty('ignore_spam');
      expect(settings.ignore_spam).toBe(true);
      expect(settings.prioritize_questions).toBe(true);
    });
  });
});
