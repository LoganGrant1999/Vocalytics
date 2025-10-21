import OpenAI from 'openai';
import { z } from 'zod';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Schema for tone analysis results
export const ToneProfileSchema = z.object({
  tone: z.string().describe('Overall tone: casual, professional, enthusiastic, friendly, etc.'),
  formality_level: z.enum(['very_casual', 'casual', 'neutral', 'formal']),
  emoji_usage: z.enum(['never', 'rarely', 'sometimes', 'frequently']),
  common_emojis: z.array(z.string()).describe('Array of frequently used emojis'),
  avg_reply_length: z.enum(['short', 'medium', 'long']).describe('short: <50 chars, medium: 50-150, long: >150'),
  common_phrases: z.array(z.string()).describe('Common phrases or expressions they use'),
  uses_name: z.boolean().describe('Do they sign their name at the end?'),
  asks_questions: z.boolean().describe('Do they frequently ask follow-up questions?'),
  uses_commenter_name: z.boolean().describe('Do they address commenters by name?')
});

export type ToneProfile = z.infer<typeof ToneProfileSchema>;

/**
 * Analyze a creator's tone from their past replies using GPT-4o
 * @param replies - Array of past reply texts
 * @returns Structured tone profile
 */
export async function analyzeTone(replies: string[]): Promise<ToneProfile> {
  if (replies.length === 0) {
    throw new Error('Need at least one reply to analyze tone');
  }

  // Limit to 50 replies max to keep token usage reasonable
  const sampleReplies = replies.slice(0, 50);

  const prompt = `You are analyzing a YouTube creator's comment reply style. Below are ${sampleReplies.length} of their past replies to comments on their videos.

Your job is to analyze their writing style and extract:
1. Overall tone (e.g., casual, professional, enthusiastic, friendly, witty, educational)
2. Formality level (very_casual, casual, neutral, or formal)
3. Emoji usage frequency (never, rarely, sometimes, frequently)
4. Common emojis they use (list up to 5)
5. Average reply length (short <50 chars, medium 50-150, long >150)
6. Common phrases or expressions (e.g., "Thanks for watching!", "Great question!", "Hope this helps!")
7. Do they sign their name at the end?
8. Do they ask follow-up questions?
9. Do they address commenters by name?

Here are their replies:

${sampleReplies.map((r, i) => `${i + 1}. "${r}"`).join('\n')}

Analyze these replies and extract the tone profile.`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-2024-08-06',
    messages: [
      {
        role: 'system',
        content: 'You are an expert at analyzing writing styles and extracting tone patterns from text.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    response_format: {
      type: 'json_schema' as const,
      json_schema: {
        name: 'tone_profile',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            tone: {
              type: 'string',
              description: 'Overall tone: casual, professional, enthusiastic, friendly, etc.'
            },
            formality_level: {
              type: 'string',
              enum: ['very_casual', 'casual', 'neutral', 'formal']
            },
            emoji_usage: {
              type: 'string',
              enum: ['never', 'rarely', 'sometimes', 'frequently']
            },
            common_emojis: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of frequently used emojis'
            },
            avg_reply_length: {
              type: 'string',
              enum: ['short', 'medium', 'long'],
              description: 'short: <50 chars, medium: 50-150, long: >150'
            },
            common_phrases: {
              type: 'array',
              items: { type: 'string' },
              description: 'Common phrases or expressions they use'
            },
            uses_name: {
              type: 'boolean',
              description: 'Do they sign their name at the end?'
            },
            asks_questions: {
              type: 'boolean',
              description: 'Do they frequently ask follow-up questions?'
            },
            uses_commenter_name: {
              type: 'boolean',
              description: 'Do they address commenters by name?'
            }
          },
          required: [
            'tone',
            'formality_level',
            'emoji_usage',
            'common_emojis',
            'avg_reply_length',
            'common_phrases',
            'uses_name',
            'asks_questions',
            'uses_commenter_name'
          ],
          additionalProperties: false
        }
      }
    }
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error('Failed to get tone analysis from GPT-4o');
  }

  const result = JSON.parse(content);
  return ToneProfileSchema.parse(result);
}
