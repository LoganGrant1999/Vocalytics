import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fakeVerifyToken, TEST_USER } from './testAuth.js';

// Use vi.hoisted for proper mock setup
const { mockGenerateReplies, mockEnforceReply, mockSupabaseClient } = vi.hoisted(() => ({
  mockGenerateReplies: vi.fn(),
  mockEnforceReply: vi.fn(),
  mockSupabaseClient: {
    from: vi.fn(),
  },
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

// Mock generateReplies from tools.ts
vi.mock('../../tools.js', () => ({
  generateReplies: mockGenerateReplies,
}));

// Mock enforceReply from paywall.ts
vi.mock('../paywall.js', () => ({
  enforceReply: mockEnforceReply,
}));

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

import { createHttpServer } from '../index.js';

describe('Generate Replies Route - Production Critical', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: Allow all requests (Pro user or within quota)
    mockEnforceReply.mockResolvedValue({ allowed: true });

    // Default: No tone profile
    mockSupabaseClient.from = vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => ({
            data: null,
            error: { message: 'Not found' },
          })),
        })),
      })),
    }));

    // Default: Generate simple replies
    mockGenerateReplies.mockResolvedValue([
      {
        tone: 'friendly',
        text: 'Thanks so much for watching! 😊',
      },
    ]);
  });

  describe('POST /api/generate-replies - Schema Validation', () => {
    it('should require comment object', async () => {
      const app = await createHttpServer();

      const response = await app.inject({
        method: 'POST',
        url: '/api/generate-replies',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("must have required property 'comment'");
    });

    it('should require comment.id', async () => {
      const app = await createHttpServer();

      const response = await app.inject({
        method: 'POST',
        url: '/api/generate-replies',
        payload: {
          comment: {
            text: 'Great video!',
          },
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("must have required property 'id'");
    });

    it('should require comment.text', async () => {
      const app = await createHttpServer();

      const response = await app.inject({
        method: 'POST',
        url: '/api/generate-replies',
        payload: {
          comment: {
            id: 'comment123',
          },
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("must have required property 'text'");
    });

    it('should reject empty comment.id', async () => {
      const app = await createHttpServer();

      const response = await app.inject({
        method: 'POST',
        url: '/api/generate-replies',
        payload: {
          comment: {
            id: '',
            text: 'Great video!',
          },
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject empty comment.text', async () => {
      const app = await createHttpServer();

      const response = await app.inject({
        method: 'POST',
        url: '/api/generate-replies',
        payload: {
          comment: {
            id: 'comment123',
            text: '',
          },
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject comment.text over 10000 characters', async () => {
      const app = await createHttpServer();

      const response = await app.inject({
        method: 'POST',
        url: '/api/generate-replies',
        payload: {
          comment: {
            id: 'comment123',
            text: 'a'.repeat(10001),
          },
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should accept valid tones array', async () => {
      const app = await createHttpServer();

      mockGenerateReplies.mockResolvedValue([
        { tone: 'friendly', text: 'Thanks!' },
        { tone: 'concise', text: 'Thank you!' },
      ]);

      const response = await app.inject({
        method: 'POST',
        url: '/api/generate-replies',
        payload: {
          comment: {
            id: 'comment123',
            text: 'Great video!',
          },
          tones: ['friendly', 'concise'],
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should reject invalid tone values', async () => {
      const app = await createHttpServer();

      const response = await app.inject({
        method: 'POST',
        url: '/api/generate-replies',
        payload: {
          comment: {
            id: 'comment123',
            text: 'Great video!',
          },
          tones: ['invalid-tone'],
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain('must be equal to one of the allowed values');
    });

    it('should reject extra properties', async () => {
      const app = await createHttpServer();

      const response = await app.inject({
        method: 'POST',
        url: '/api/generate-replies',
        payload: {
          comment: {
            id: 'comment123',
            text: 'Great video!',
            extraField: 'not allowed',
          },
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /api/generate-replies - Paywall Enforcement', () => {
    it('should call enforceReply with correct parameters', async () => {
      const app = await createHttpServer();

      await app.inject({
        method: 'POST',
        url: '/api/generate-replies',
        payload: {
          comment: {
            id: 'comment123',
            text: 'Great video!',
          },
          tones: ['friendly', 'concise', 'enthusiastic'],
        },
      });

      expect(mockEnforceReply).toHaveBeenCalledWith({
        userDbId: TEST_USER.id,
        incrementBy: 3, // 3 tones requested
      });
    });

    it('should increment by 1 when no tones specified', async () => {
      const app = await createHttpServer();

      await app.inject({
        method: 'POST',
        url: '/api/generate-replies',
        payload: {
          comment: {
            id: 'comment123',
            text: 'Great video!',
          },
        },
      });

      expect(mockEnforceReply).toHaveBeenCalledWith({
        userDbId: TEST_USER.id,
        incrementBy: 1, // Default to 1
      });
    });

    it('should return 402 when paywall blocks request', async () => {
      const app = await createHttpServer();

      mockEnforceReply.mockResolvedValue({
        allowed: false,
        error: {
          code: 'PAYWALL',
          reason: 'FREE_TIER_EXCEEDED',
          feature: 'reply',
          upgradeUrl: 'https://vocalytics.app/pricing',
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/generate-replies',
        payload: {
          comment: {
            id: 'comment123',
            text: 'Great video!',
          },
        },
      });

      expect(response.statusCode).toBe(402);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('PAYWALL');
      expect(body.reason).toBe('FREE_TIER_EXCEEDED');
    });

    it('should allow Pro users unlimited replies', async () => {
      const app = await createHttpServer();

      mockEnforceReply.mockResolvedValue({ allowed: true });

      const response = await app.inject({
        method: 'POST',
        url: '/api/generate-replies',
        payload: {
          comment: {
            id: 'comment123',
            text: 'Great video!',
          },
          tones: ['friendly', 'concise', 'enthusiastic'],
        },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('POST /api/generate-replies - Success Cases', () => {
    it('should generate reply successfully with default tone', async () => {
      const app = await createHttpServer();

      mockGenerateReplies.mockResolvedValue([
        {
          tone: 'friendly',
          text: 'Thanks so much for watching! 😊 I really appreciate your support!',
        },
      ]);

      const response = await app.inject({
        method: 'POST',
        url: '/api/generate-replies',
        payload: {
          comment: {
            id: 'comment123',
            text: 'Great video! Really helpful content.',
          },
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveLength(1);
      expect(body[0].tone).toBe('friendly');
      expect(body[0].text).toBeDefined();
      expect(body[0].text.length).toBeLessThanOrEqual(220); // YouTube limit
    });

    it('should generate multiple replies for multiple tones', async () => {
      const app = await createHttpServer();

      mockGenerateReplies.mockResolvedValue([
        { tone: 'friendly', text: 'Thanks so much for watching! 😊' },
        { tone: 'concise', text: 'Thanks for watching!' },
        { tone: 'enthusiastic', text: 'WOW! Thank you so much!! 🎉' },
      ]);

      const response = await app.inject({
        method: 'POST',
        url: '/api/generate-replies',
        payload: {
          comment: {
            id: 'comment123',
            text: 'Great video!',
          },
          tones: ['friendly', 'concise', 'enthusiastic'],
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveLength(3);
      expect(body[0].tone).toBe('friendly');
      expect(body[1].tone).toBe('concise');
      expect(body[2].tone).toBe('enthusiastic');
    });

    it('should call generateReplies with correct parameters', async () => {
      const app = await createHttpServer();

      await app.inject({
        method: 'POST',
        url: '/api/generate-replies',
        payload: {
          comment: {
            id: 'comment123',
            text: 'Awesome content!',
          },
          tones: ['friendly'],
        },
      });

      expect(mockGenerateReplies).toHaveBeenCalledWith(
        {
          id: 'comment123',
          text: 'Awesome content!',
        },
        ['friendly'],
        null // No tone profile
      );
    });

    it('should handle long comment text', async () => {
      const app = await createHttpServer();

      const longComment = 'a'.repeat(5000); // 5000 characters

      mockGenerateReplies.mockResolvedValue([
        { tone: 'friendly', text: 'Thanks for your detailed comment!' },
      ]);

      const response = await app.inject({
        method: 'POST',
        url: '/api/generate-replies',
        payload: {
          comment: {
            id: 'comment123',
            text: longComment,
          },
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockGenerateReplies).toHaveBeenCalledWith(
        expect.objectContaining({
          text: longComment,
        }),
        ['friendly'],
        null
      );
    });

    it('should handle special characters in comment', async () => {
      const app = await createHttpServer();

      const specialComment = 'Great video! 😊 <3 You\'re the "best" & I love your work 🎉';

      mockGenerateReplies.mockResolvedValue([
        { tone: 'friendly', text: 'Thanks so much! 😊' },
      ]);

      const response = await app.inject({
        method: 'POST',
        url: '/api/generate-replies',
        payload: {
          comment: {
            id: 'comment123',
            text: specialComment,
          },
        },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('POST /api/generate-replies - Tone Profile Integration', () => {
    it('should fetch tone profile for user', async () => {
      const app = await createHttpServer();

      const mockToneProfile = {
        tone: 'friendly and enthusiastic',
        formality_level: 'casual',
        emoji_usage: 'frequently',
        common_emojis: ['😊', '👍'],
        avg_reply_length: 'medium',
        common_phrases: ['Thanks for watching!', 'Great question!'],
        uses_name: true,
        asks_questions: true,
        uses_commenter_name: false,
      };

      mockSupabaseClient.from = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({
              data: mockToneProfile,
              error: null,
            })),
          })),
        })),
      }));

      await app.inject({
        method: 'POST',
        url: '/api/generate-replies',
        payload: {
          comment: {
            id: 'comment123',
            text: 'Great video!',
          },
        },
      });

      // Verify Supabase was called to fetch tone profile
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('tone_profiles');
    });

    it('should pass tone profile to generateReplies when found', async () => {
      const app = await createHttpServer();

      const mockToneProfile = {
        tone: 'professional',
        formality_level: 'formal',
        emoji_usage: 'rarely',
        common_emojis: [],
        avg_reply_length: 'long',
        common_phrases: ['Thank you for your inquiry'],
        uses_name: true,
        asks_questions: false,
        uses_commenter_name: true,
      };

      mockSupabaseClient.from = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({
              data: mockToneProfile,
              error: null,
            })),
          })),
        })),
      }));

      await app.inject({
        method: 'POST',
        url: '/api/generate-replies',
        payload: {
          comment: {
            id: 'comment123',
            text: 'Great video!',
          },
        },
      });

      expect(mockGenerateReplies).toHaveBeenCalledWith(
        expect.any(Object),
        ['friendly'],
        mockToneProfile
      );
    });

    it('should continue without tone profile if not found', async () => {
      const app = await createHttpServer();

      // Tone profile query fails
      mockSupabaseClient.from = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({
              data: null,
              error: { message: 'Not found' },
            })),
          })),
        })),
      }));

      const response = await app.inject({
        method: 'POST',
        url: '/api/generate-replies',
        payload: {
          comment: {
            id: 'comment123',
            text: 'Great video!',
          },
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockGenerateReplies).toHaveBeenCalledWith(
        expect.any(Object),
        ['friendly'],
        null // No tone profile
      );
    });

    it('should handle tone profile database errors gracefully', async () => {
      const app = await createHttpServer();

      // Simulate database error
      mockSupabaseClient.from = vi.fn(() => {
        throw new Error('Database connection error');
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/generate-replies',
        payload: {
          comment: {
            id: 'comment123',
            text: 'Great video!',
          },
        },
      });

      // Should still succeed without tone profile
      expect(response.statusCode).toBe(200);
    });
  });

  describe('POST /api/generate-replies - Error Cases', () => {
    it('should return 500 when generateReplies throws error', async () => {
      const app = await createHttpServer();

      mockGenerateReplies.mockRejectedValue(new Error('OpenAI API error'));

      const response = await app.inject({
        method: 'POST',
        url: '/api/generate-replies',
        payload: {
          comment: {
            id: 'comment123',
            text: 'Great video!',
          },
        },
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Internal Server Error');
      expect(body.message).toContain('OpenAI API error');
    });

    it('should handle enforceReply throwing error', async () => {
      const app = await createHttpServer();

      mockEnforceReply.mockRejectedValue(new Error('User not found'));

      const response = await app.inject({
        method: 'POST',
        url: '/api/generate-replies',
        payload: {
          comment: {
            id: 'comment123',
            text: 'Great video!',
          },
        },
      });

      expect(response.statusCode).toBe(500);
    });

    it('should handle malformed comment data', async () => {
      const app = await createHttpServer();

      const response = await app.inject({
        method: 'POST',
        url: '/api/generate-replies',
        payload: {
          comment: {
            id: 123, // Should be string
            text: 'Great video!',
          },
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /api/generate-replies - Integration Scenarios', () => {
    it('should complete full flow for Free user within quota', async () => {
      const app = await createHttpServer();

      // Free user within quota
      mockEnforceReply.mockResolvedValue({ allowed: true });

      mockGenerateReplies.mockResolvedValue([
        { tone: 'friendly', text: 'Thanks for watching!' },
      ]);

      const response = await app.inject({
        method: 'POST',
        url: '/api/generate-replies',
        payload: {
          comment: {
            id: 'comment123',
            text: 'Great video!',
          },
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockEnforceReply).toHaveBeenCalled();
      expect(mockGenerateReplies).toHaveBeenCalled();
    });

    it('should complete full flow for Pro user with tone profile', async () => {
      const app = await createHttpServer();

      // Pro user (always allowed)
      mockEnforceReply.mockResolvedValue({ allowed: true });

      const mockToneProfile = {
        tone: 'casual and friendly',
        formality_level: 'very_casual',
        emoji_usage: 'frequently',
        common_emojis: ['😊', '🎉'],
        avg_reply_length: 'short',
        common_phrases: ['Thanks!', 'Awesome!'],
        uses_name: false,
        asks_questions: true,
        uses_commenter_name: true,
      };

      mockSupabaseClient.from = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({
              data: mockToneProfile,
              error: null,
            })),
          })),
        })),
      }));

      mockGenerateReplies.mockResolvedValue([
        { tone: 'friendly', text: 'Thanks so much! 😊' },
        { tone: 'enthusiastic', text: 'Awesome feedback! 🎉' },
      ]);

      const response = await app.inject({
        method: 'POST',
        url: '/api/generate-replies',
        payload: {
          comment: {
            id: 'comment123',
            text: 'Love your content!',
          },
          tones: ['friendly', 'enthusiastic'],
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveLength(2);

      // Verify tone profile was used
      expect(mockGenerateReplies).toHaveBeenCalledWith(
        expect.any(Object),
        ['friendly', 'enthusiastic'],
        mockToneProfile
      );
    });

    it('should handle quota exhaustion scenario', async () => {
      const app = await createHttpServer();

      // First request succeeds
      mockEnforceReply.mockResolvedValueOnce({ allowed: true });

      const response1 = await app.inject({
        method: 'POST',
        url: '/api/generate-replies',
        payload: {
          comment: {
            id: 'comment1',
            text: 'Great video!',
          },
        },
      });
      expect(response1.statusCode).toBe(200);

      // Second request blocked (quota exhausted)
      mockEnforceReply.mockResolvedValueOnce({
        allowed: false,
        error: {
          code: 'PAYWALL',
          reason: 'FREE_TIER_EXCEEDED',
          feature: 'reply',
          upgradeUrl: 'https://vocalytics.app/pricing',
        },
      });

      const response2 = await app.inject({
        method: 'POST',
        url: '/api/generate-replies',
        payload: {
          comment: {
            id: 'comment2',
            text: 'Another comment!',
          },
        },
      });
      expect(response2.statusCode).toBe(402);
    });
  });

  describe('POST /api/generate-replies - Edge Cases', () => {
    it('should handle all valid tone combinations', async () => {
      const app = await createHttpServer();

      const validTones = ['friendly', 'concise', 'enthusiastic'];

      mockGenerateReplies.mockResolvedValue(
        validTones.map(tone => ({ tone, text: `${tone} reply` }))
      );

      const response = await app.inject({
        method: 'POST',
        url: '/api/generate-replies',
        payload: {
          comment: {
            id: 'comment123',
            text: 'Great video!',
          },
          tones: validTones,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveLength(3);
    });

    it('should handle single tone in array', async () => {
      const app = await createHttpServer();

      mockGenerateReplies.mockResolvedValue([
        { tone: 'concise', text: 'Thanks!' },
      ]);

      const response = await app.inject({
        method: 'POST',
        url: '/api/generate-replies',
        payload: {
          comment: {
            id: 'comment123',
            text: 'Great video!',
          },
          tones: ['concise'],
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveLength(1);
      expect(body[0].tone).toBe('concise');
    });

    it('should handle exactly 10000 character comment', async () => {
      const app = await createHttpServer();

      const maxLengthComment = 'a'.repeat(10000);

      mockGenerateReplies.mockResolvedValue([
        { tone: 'friendly', text: 'Thanks for the detailed feedback!' },
      ]);

      const response = await app.inject({
        method: 'POST',
        url: '/api/generate-replies',
        payload: {
          comment: {
            id: 'comment123',
            text: maxLengthComment,
          },
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should handle Unicode and emoji in comment text', async () => {
      const app = await createHttpServer();

      const unicodeComment = '谢谢你的视频！ Great content! 😊🎉👍 Спасибо!';

      mockGenerateReplies.mockResolvedValue([
        { tone: 'friendly', text: 'Thank you so much! 😊' },
      ]);

      const response = await app.inject({
        method: 'POST',
        url: '/api/generate-replies',
        payload: {
          comment: {
            id: 'comment123',
            text: unicodeComment,
          },
        },
      });

      expect(response.statusCode).toBe(200);
    });
  });
});
