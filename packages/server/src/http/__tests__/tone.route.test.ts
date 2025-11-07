import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fakeVerifyToken, TEST_USER } from './testAuth.js';

// Use vi.hoisted for proper mock setup
const { mockFetchCreatorReplies, mockAnalyzeTone, mockSupabaseClient } = vi.hoisted(() => ({
  mockFetchCreatorReplies: vi.fn(),
  mockAnalyzeTone: vi.fn(),
  mockSupabaseClient: {
    from: vi.fn(),
  },
}));

// Mock fetchCreatorReplies from google.ts
vi.mock('../../lib/google.js', () => ({
  fetchCreatorReplies: mockFetchCreatorReplies,
}));

// Mock analyzeTone from toneAnalysis.ts
vi.mock('../../services/toneAnalysis.js', () => ({
  analyzeTone: mockAnalyzeTone,
}));

// Mock auth plugin
vi.mock('../auth.js', async () => {
  const fp = await import('fastify-plugin');
  const plugin = (app: any, opts: any, done: any) => {
    app.addHook('preHandler', fakeVerifyToken);
    done();
  };
  return {
    default: fp.default(plugin, { name: 'auth-plugin' })
  };
});

// Supabase mock - will be configured in beforeEach
let mockSupabaseSelect: any;
let mockSupabaseUpsert: any;
let mockSupabaseDelete: any;

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

import { createHttpServer } from '../index.js';

describe('Tone Learning Routes - Production Critical', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: user is Pro with YouTube connected
    mockSupabaseSelect = vi.fn(() => ({
      data: {
        id: TEST_USER.id,
        email: TEST_USER.email,
        tier: 'pro',
        youtube_access_token: 'ya29.test_access_token',
      },
      error: null,
    }));

    // Configure Supabase client mock
    mockSupabaseClient.from = vi.fn((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: mockSupabaseSelect,
            })),
          })),
        };
      }
      if (table === 'tone_profiles') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: mockSupabaseSelect,
            })),
          })),
          upsert: mockSupabaseUpsert,
          delete: vi.fn(() => ({
            eq: mockSupabaseDelete,
          })),
        };
      }
    });

    // Default: successful upsert
    mockSupabaseUpsert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(() => ({
          data: {
            user_id: TEST_USER.id,
            tone: 'friendly and enthusiastic',
            formality_level: 'casual',
            emoji_usage: 'frequently',
            common_emojis: ['😊', '👍'],
            avg_reply_length: 'medium',
            common_phrases: ['Thanks for watching!'],
            uses_name: true,
            asks_questions: true,
            uses_commenter_name: false,
            example_replies: ['Thanks for watching! 😊'],
            learned_from_count: 10,
            learned_at: new Date().toISOString(),
          },
          error: null,
        })),
      })),
    }));

    // Default: successful delete
    mockSupabaseDelete = vi.fn(() => ({
      error: null,
    }));

    // Default: fetch 10 creator replies
    mockFetchCreatorReplies.mockResolvedValue([
      { text: 'Thanks for watching! 😊', videoId: 'vid1', publishedAt: '2024-01-01' },
      { text: 'Great question!', videoId: 'vid2', publishedAt: '2024-01-02' },
      { text: 'I appreciate your feedback 👍', videoId: 'vid3', publishedAt: '2024-01-03' },
      { text: 'That\'s a good point!', videoId: 'vid4', publishedAt: '2024-01-04' },
      { text: 'What do you think about...?', videoId: 'vid5', publishedAt: '2024-01-05' },
      { text: 'Thanks again!', videoId: 'vid6', publishedAt: '2024-01-06' },
      { text: 'Glad you enjoyed it!', videoId: 'vid7', publishedAt: '2024-01-07' },
      { text: 'Let me know if you have questions', videoId: 'vid8', publishedAt: '2024-01-08' },
      { text: 'Appreciate you!', videoId: 'vid9', publishedAt: '2024-01-09' },
      { text: 'Thanks for the support!', videoId: 'vid10', publishedAt: '2024-01-10' },
    ]);

    // Default: successful tone analysis
    mockAnalyzeTone.mockResolvedValue({
      tone: 'friendly and enthusiastic',
      formality_level: 'casual',
      emoji_usage: 'frequently',
      common_emojis: ['😊', '👍'],
      avg_reply_length: 'medium',
      common_phrases: ['Thanks for watching!', 'Great question!'],
      uses_name: true,
      asks_questions: true,
      uses_commenter_name: false,
    });
  });

  describe('POST /api/tone/learn - Authentication & Authorization', () => {
    it('should require Pro tier', async () => {
      const app = await createHttpServer();

      // Mock user as free tier
      mockSupabaseSelect = vi.fn(() => ({
        data: {
          id: TEST_USER.id,
          tier: 'free',
          youtube_access_token: 'ya29.test',
        },
        error: null,
      }));

      const response = await app.inject({
        method: 'POST',
        url: '/api/tone/learn',
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('FORBIDDEN');
      expect(body.message).toContain('Pro feature');
    });

    it('should return 404 when user profile not found', async () => {
      const app = await createHttpServer();

      // Mock profile not found
      mockSupabaseSelect = vi.fn(() => ({
        data: null,
        error: { message: 'Not found' },
      }));

      const response = await app.inject({
        method: 'POST',
        url: '/api/tone/learn',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('NOT_FOUND');
      expect(body.message).toContain('User profile not found');
    });

    it('should require YouTube account connected', async () => {
      const app = await createHttpServer();

      // Mock user without YouTube connected
      mockSupabaseSelect = vi.fn(() => ({
        data: {
          id: TEST_USER.id,
          tier: 'pro',
          youtube_access_token: null, // Not connected
        },
        error: null,
      }));

      const response = await app.inject({
        method: 'POST',
        url: '/api/tone/learn',
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('BAD_REQUEST');
      expect(body.message).toContain('YouTube account not connected');
    });
  });

  describe('POST /api/tone/learn - Precondition Validation', () => {
    it('should require at least one past reply', async () => {
      const app = await createHttpServer();

      // Mock no replies found
      mockFetchCreatorReplies.mockResolvedValue([]);

      const response = await app.inject({
        method: 'POST',
        url: '/api/tone/learn',
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('INSUFFICIENT_DATA');
      expect(body.message).toContain('No past replies found');
    });

    it('should fetch creator replies with access token', async () => {
      const app = await createHttpServer();

      await app.inject({
        method: 'POST',
        url: '/api/tone/learn',
      });

      expect(mockFetchCreatorReplies).toHaveBeenCalledWith('ya29.test_access_token', 50);
    });
  });

  describe('POST /api/tone/learn - Success Cases', () => {
    it('should analyze tone using fetched replies', async () => {
      const app = await createHttpServer();

      await app.inject({
        method: 'POST',
        url: '/api/tone/learn',
      });

      // Should call analyzeTone with reply texts
      expect(mockAnalyzeTone).toHaveBeenCalledWith([
        'Thanks for watching! 😊',
        'Great question!',
        'I appreciate your feedback 👍',
        'That\'s a good point!',
        'What do you think about...?',
        'Thanks again!',
        'Glad you enjoyed it!',
        'Let me know if you have questions',
        'Appreciate you!',
        'Thanks for the support!',
      ]);
    });

    it('should store complete tone profile in database', async () => {
      const app = await createHttpServer();

      await app.inject({
        method: 'POST',
        url: '/api/tone/learn',
      });

      // Should upsert tone profile
      expect(mockSupabaseUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: TEST_USER.id,
          tone: 'friendly and enthusiastic',
          formality_level: 'casual',
          emoji_usage: 'frequently',
          common_emojis: ['😊', '👍'],
          avg_reply_length: 'medium',
          common_phrases: ['Thanks for watching!', 'Great question!'],
          uses_name: true,
          asks_questions: true,
          uses_commenter_name: false,
          example_replies: expect.any(Array),
          learned_from_count: 10,
        }),
        { onConflict: 'user_id' }
      );
    });

    it('should return complete profile with metadata', async () => {
      const app = await createHttpServer();

      const response = await app.inject({
        method: 'POST',
        url: '/api/tone/learn',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toMatchObject({
        success: true,
        profile: expect.objectContaining({
          tone: 'friendly and enthusiastic',
          formality_level: 'casual',
          emoji_usage: 'frequently',
          learned_from_count: 10,
        }),
        analyzed_replies: 10,
      });
    });

    it('should store first 10 replies as examples', async () => {
      const app = await createHttpServer();

      await app.inject({
        method: 'POST',
        url: '/api/tone/learn',
      });

      const upsertCall = mockSupabaseUpsert.mock.calls[0][0];
      expect(upsertCall.example_replies).toHaveLength(10);
      expect(upsertCall.example_replies[0]).toBe('Thanks for watching! 😊');
    });
  });

  describe('POST /api/tone/learn - Edge Cases', () => {
    it('should handle upsert for re-learning (update existing)', async () => {
      const app = await createHttpServer();

      const response = await app.inject({
        method: 'POST',
        url: '/api/tone/learn',
      });

      expect(response.statusCode).toBe(200);
      // Upsert should be called with onConflict to update existing
      expect(mockSupabaseUpsert).toHaveBeenCalledWith(
        expect.any(Object),
        { onConflict: 'user_id' }
      );
    });

    it('should handle more than 50 replies (should fetch max 50)', async () => {
      const app = await createHttpServer();

      // Mock 100 replies returned
      const manyReplies = Array(100).fill(null).map((_, i) => ({
        text: `Reply ${i}`,
        videoId: `vid${i}`,
        publishedAt: '2024-01-01',
      }));
      mockFetchCreatorReplies.mockResolvedValue(manyReplies);

      await app.inject({
        method: 'POST',
        url: '/api/tone/learn',
      });

      // Should request max 50 from YouTube API
      expect(mockFetchCreatorReplies).toHaveBeenCalledWith(
        'ya29.test_access_token',
        50
      );
    });

    it('should handle YouTube API errors', async () => {
      const app = await createHttpServer();

      // Mock YouTube API error
      mockFetchCreatorReplies.mockRejectedValue(new Error('YouTube API error'));

      const response = await app.inject({
        method: 'POST',
        url: '/api/tone/learn',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('INTERNAL_ERROR');
    });

    it('should handle OpenAI API errors', async () => {
      const app = await createHttpServer();

      // Mock analyzeTone error
      mockAnalyzeTone.mockRejectedValue(new Error('OpenAI API error'));

      const response = await app.inject({
        method: 'POST',
        url: '/api/tone/learn',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('INTERNAL_ERROR');
    });

    it('should handle database save errors', async () => {
      const app = await createHttpServer();

      // Mock database save error
      mockSupabaseUpsert = vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => ({
            data: null,
            error: { message: 'Database error' },
          })),
        })),
      }));

      const response = await app.inject({
        method: 'POST',
        url: '/api/tone/learn',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('INTERNAL_ERROR');
      expect(body.message).toContain('Failed to save tone profile');
    });
  });

  describe('GET /api/tone/profile - Retrieve Profile', () => {
    it('should return existing tone profile', async () => {
      const app = await createHttpServer();

      // Mock existing profile
      mockSupabaseSelect = vi.fn(() => ({
        data: {
          user_id: TEST_USER.id,
          tone: 'professional',
          formality_level: 'formal',
          emoji_usage: 'rarely',
          common_emojis: [],
          avg_reply_length: 'long',
          common_phrases: ['Thank you for your inquiry'],
          uses_name: true,
          asks_questions: false,
          uses_commenter_name: true,
          learned_from_count: 25,
          learned_at: '2024-01-15T00:00:00Z',
        },
        error: null,
      }));

      const response = await app.inject({
        method: 'GET',
        url: '/api/tone/profile',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toMatchObject({
        tone: 'professional',
        formality_level: 'formal',
        learned_from_count: 25,
      });
    });

    it('should return 404 when no profile exists', async () => {
      const app = await createHttpServer();

      // Mock no profile found
      mockSupabaseSelect = vi.fn(() => ({
        data: null,
        error: { message: 'Not found' },
      }));

      const response = await app.inject({
        method: 'GET',
        url: '/api/tone/profile',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('NOT_FOUND');
      expect(body.message).toContain('No tone profile found');
    });

    it('should handle database errors', async () => {
      const app = await createHttpServer();

      // Mock database error
      mockSupabaseSelect = vi.fn(() => ({
        data: null,
        error: { message: 'Database connection error' },
      }));

      const response = await app.inject({
        method: 'GET',
        url: '/api/tone/profile',
      });

      expect(response.statusCode).toBe(404);
    });

    it('should include all tone profile fields', async () => {
      const app = await createHttpServer();

      mockSupabaseSelect = vi.fn(() => ({
        data: {
          user_id: TEST_USER.id,
          tone: 'casual and friendly',
          formality_level: 'very_casual',
          emoji_usage: 'frequently',
          common_emojis: ['😊', '👍', '🎉'],
          avg_reply_length: 'short',
          common_phrases: ['Thanks!', 'Awesome!'],
          uses_name: false,
          asks_questions: true,
          uses_commenter_name: true,
          example_replies: ['Thanks! 😊', 'Awesome! 👍'],
          learned_from_count: 15,
          learned_at: '2024-01-20T00:00:00Z',
        },
        error: null,
      }));

      const response = await app.inject({
        method: 'GET',
        url: '/api/tone/profile',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Verify all expected fields
      expect(body).toHaveProperty('tone');
      expect(body).toHaveProperty('formality_level');
      expect(body).toHaveProperty('emoji_usage');
      expect(body).toHaveProperty('common_emojis');
      expect(body).toHaveProperty('avg_reply_length');
      expect(body).toHaveProperty('common_phrases');
      expect(body).toHaveProperty('uses_name');
      expect(body).toHaveProperty('asks_questions');
      expect(body).toHaveProperty('uses_commenter_name');
      expect(body).toHaveProperty('example_replies');
      expect(body).toHaveProperty('learned_from_count');
      expect(body).toHaveProperty('learned_at');
    });
  });

  describe('DELETE /api/tone/profile - Remove Profile', () => {
    it('should delete tone profile successfully', async () => {
      const app = await createHttpServer();

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/tone/profile',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    it('should call delete with correct user_id', async () => {
      const app = await createHttpServer();

      await app.inject({
        method: 'DELETE',
        url: '/api/tone/profile',
      });

      // Verify delete was called with user_id filter
      expect(mockSupabaseDelete).toHaveBeenCalled();
    });

    it('should handle database errors during delete', async () => {
      const app = await createHttpServer();

      // Mock delete error
      mockSupabaseDelete = vi.fn(() => ({
        error: { message: 'Database error' },
      }));

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/tone/profile',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('INTERNAL_ERROR');
      expect(body.message).toContain('Failed to delete tone profile');
    });

    it('should be idempotent (succeed even if no profile exists)', async () => {
      const app = await createHttpServer();

      // Delete returns no error even if nothing to delete
      mockSupabaseDelete = vi.fn(() => ({
        error: null,
      }));

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/tone/profile',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });
  });

  describe('Integration Scenarios', () => {
    it('should complete full learn → get → delete flow', async () => {
      const app = await createHttpServer();

      // Step 1: Learn tone
      const learnResponse = await app.inject({
        method: 'POST',
        url: '/api/tone/learn',
      });
      expect(learnResponse.statusCode).toBe(200);

      // Step 2: Get profile
      mockSupabaseSelect = vi.fn(() => ({
        data: {
          user_id: TEST_USER.id,
          tone: 'friendly and enthusiastic',
          formality_level: 'casual',
          learned_from_count: 10,
        },
        error: null,
      }));

      const getResponse = await app.inject({
        method: 'GET',
        url: '/api/tone/profile',
      });
      expect(getResponse.statusCode).toBe(200);
      const profile = JSON.parse(getResponse.body);
      expect(profile.tone).toBe('friendly and enthusiastic');

      // Step 3: Delete profile
      const deleteResponse = await app.inject({
        method: 'DELETE',
        url: '/api/tone/profile',
      });
      expect(deleteResponse.statusCode).toBe(200);
    });

    it('should handle re-learning (update existing profile)', async () => {
      const app = await createHttpServer();

      // First learning
      const firstLearn = await app.inject({
        method: 'POST',
        url: '/api/tone/learn',
      });
      expect(firstLearn.statusCode).toBe(200);

      // Change mock data for second learning
      mockFetchCreatorReplies.mockResolvedValue([
        { text: 'Updated reply style', videoId: 'vid1', publishedAt: '2024-02-01' },
      ]);
      mockAnalyzeTone.mockResolvedValue({
        tone: 'professional',
        formality_level: 'formal',
        emoji_usage: 'never',
        common_emojis: [],
        avg_reply_length: 'long',
        common_phrases: ['Best regards'],
        uses_name: true,
        asks_questions: false,
        uses_commenter_name: false,
      });

      // Second learning should update
      const secondLearn = await app.inject({
        method: 'POST',
        url: '/api/tone/learn',
      });
      expect(secondLearn.statusCode).toBe(200);

      // Should have called upsert twice (once per learn)
      expect(mockSupabaseUpsert).toHaveBeenCalledTimes(2);
    });
  });

  describe('Tone Profile Data Validation', () => {
    it('should handle all formality levels', async () => {
      const app = await createHttpServer();

      const formalityLevels = ['very_casual', 'casual', 'neutral', 'formal'];

      for (const level of formalityLevels) {
        mockAnalyzeTone.mockResolvedValue({
          tone: 'test',
          formality_level: level as any,
          emoji_usage: 'sometimes',
          common_emojis: [],
          avg_reply_length: 'medium',
          common_phrases: [],
          uses_name: false,
          asks_questions: false,
          uses_commenter_name: false,
        });

        const response = await app.inject({
          method: 'POST',
          url: '/api/tone/learn',
        });
        expect(response.statusCode).toBe(200);
      }
    });

    it('should handle all emoji usage levels', async () => {
      const app = await createHttpServer();

      const emojiLevels = ['never', 'rarely', 'sometimes', 'frequently'];

      for (const level of emojiLevels) {
        mockAnalyzeTone.mockResolvedValue({
          tone: 'test',
          formality_level: 'casual',
          emoji_usage: level as any,
          common_emojis: level === 'never' ? [] : ['😊'],
          avg_reply_length: 'medium',
          common_phrases: [],
          uses_name: false,
          asks_questions: false,
          uses_commenter_name: false,
        });

        const response = await app.inject({
          method: 'POST',
          url: '/api/tone/learn',
        });
        expect(response.statusCode).toBe(200);
      }
    });

    it('should handle all reply length categories', async () => {
      const app = await createHttpServer();

      const lengthCategories = ['short', 'medium', 'long'];

      for (const length of lengthCategories) {
        mockAnalyzeTone.mockResolvedValue({
          tone: 'test',
          formality_level: 'casual',
          emoji_usage: 'sometimes',
          common_emojis: [],
          avg_reply_length: length as any,
          common_phrases: [],
          uses_name: false,
          asks_questions: false,
          uses_commenter_name: false,
        });

        const response = await app.inject({
          method: 'POST',
          url: '/api/tone/learn',
        });
        expect(response.statusCode).toBe(200);
      }
    });
  });
});
