import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeTone, ToneProfileSchema } from '../toneAnalysis.js';

// Use vi.hoisted to properly handle mock function creation
const { mockCreateFn } = vi.hoisted(() => {
  return {
    mockCreateFn: vi.fn(),
  };
});

vi.mock('openai', () => {
  const MockOpenAI = vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCreateFn,
      },
    },
  }));

  return {
    default: MockOpenAI,
  };
});

describe('toneAnalysis.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateFn.mockReset();
  });

  describe('analyzeTone', () => {
    it('should analyze tone from replies', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                tone: 'friendly and enthusiastic',
                formality_level: 'casual',
                emoji_usage: 'frequently',
                common_emojis: ['😊', '👍', '🎉'],
                avg_reply_length: 'medium',
                common_phrases: ['Thanks for watching!', 'Great question!'],
                uses_name: true,
                asks_questions: true,
                uses_commenter_name: false,
              }),
            },
          },
        ],
      };

      mockCreateFn.mockResolvedValue(mockResponse);

      const replies = [
        'Thanks for watching! 😊',
        'Great question! I appreciate your feedback 👍',
        'That\'s a good point! What do you think about...?',
      ];

      const result = await analyzeTone(replies);

      expect(result).toEqual({
        tone: 'friendly and enthusiastic',
        formality_level: 'casual',
        emoji_usage: 'frequently',
        common_emojis: ['😊', '👍', '🎉'],
        avg_reply_length: 'medium',
        common_phrases: ['Thanks for watching!', 'Great question!'],
        uses_name: true,
        asks_questions: true,
        uses_commenter_name: false,
      });

      expect(mockCreateFn).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o-2024-08-06',
          response_format: expect.objectContaining({
            type: 'json_schema',
          }),
        })
      );
    });

    it('should throw error when no replies provided', async () => {
      await expect(analyzeTone([])).rejects.toThrow('Need at least one reply to analyze tone');
    });

    it('should limit replies to 50', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                tone: 'professional',
                formality_level: 'formal',
                emoji_usage: 'never',
                common_emojis: [],
                avg_reply_length: 'long',
                common_phrases: ['Thank you for your comment'],
                uses_name: false,
                asks_questions: false,
                uses_commenter_name: false,
              }),
            },
          },
        ],
      };

      mockCreateFn.mockResolvedValue(mockResponse);

      const manyReplies = Array(100).fill('Test reply');
      await analyzeTone(manyReplies);

      const callArgs = mockCreateFn.mock.calls[0][0];
      const userMessage = callArgs.messages.find((m: any) => m.role === 'user');

      // Should contain "50" in the prompt (limiting to 50 replies)
      expect(userMessage.content).toContain('50');
    });

    it('should throw error when OpenAI returns no content', async () => {
      mockCreateFn.mockResolvedValue({
        choices: [{ message: {} }],
      });

      await expect(analyzeTone(['test'])).rejects.toThrow('Failed to get tone analysis from GPT-4o');
    });

    it('should validate response with schema', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                tone: 'casual',
                formality_level: 'very_casual',
                emoji_usage: 'rarely',
                common_emojis: ['😄'],
                avg_reply_length: 'short',
                common_phrases: ['Thanks!'],
                uses_name: false,
                asks_questions: false,
                uses_commenter_name: true,
              }),
            },
          },
        ],
      };

      mockCreateFn.mockResolvedValue(mockResponse);

      const result = await analyzeTone(['Hey! Thanks!']);

      // Should parse successfully with zod schema
      expect(() => ToneProfileSchema.parse(result)).not.toThrow();
    });

    it('should handle different formality levels', async () => {
      const formalResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                tone: 'professional and formal',
                formality_level: 'formal',
                emoji_usage: 'never',
                common_emojis: [],
                avg_reply_length: 'long',
                common_phrases: ['Thank you for your inquiry'],
                uses_name: true,
                asks_questions: false,
                uses_commenter_name: true,
              }),
            },
          },
        ],
      };

      mockCreateFn.mockResolvedValue(formalResponse);

      const result = await analyzeTone(['Thank you for your inquiry. Best regards, John']);

      expect(result.formality_level).toBe('formal');
      expect(result.emoji_usage).toBe('never');
    });
  });
});
