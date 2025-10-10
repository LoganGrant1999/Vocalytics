import { it, expect } from 'vitest';
import {
  FetchCommentsArgsSchema,
  AnalyzeCommentsArgsSchema,
  GenerateRepliesArgsSchema,
  SummarizeSentimentArgsSchema,
  TWCommentZ,
  AnalysisSchema,
} from './schemas';

it('FetchCommentsArgsSchema validates minimal payload', () => {
  const result = FetchCommentsArgsSchema.safeParse({ videoId: 'test123', max: 10 });
  expect(result.success).toBe(true);
});

it('AnalyzeCommentsArgsSchema validates minimal payload', () => {
  const mockComment = {
    id: '1',
    videoId: 'v1',
    author: 'Test User',
    text: 'Great video!',
    publishedAt: '2025-01-01T00:00:00Z',
    likeCount: 5,
    replyCount: 0,
    isReply: false,
  };
  const result = AnalyzeCommentsArgsSchema.safeParse({ comments: [mockComment] });
  expect(result.success).toBe(true);
});

it('GenerateRepliesArgsSchema validates minimal payload', () => {
  const mockComment = {
    id: '1',
    videoId: 'v1',
    author: 'Test User',
    text: 'Great video!',
    publishedAt: '2025-01-01T00:00:00Z',
    likeCount: 5,
    replyCount: 0,
    isReply: false,
  };
  const result = GenerateRepliesArgsSchema.safeParse({
    comment: mockComment,
    tones: ['friendly'],
  });
  expect(result.success).toBe(true);
});

it('SummarizeSentimentArgsSchema validates minimal payload', () => {
  const mockAnalysis = {
    commentId: '1',
    sentiment: { positive: 0.8, negative: 0.1, neutral: 0.1 },
    topics: ['quality', 'entertainment'],
    intent: 'praise',
    toxicity: 0.05,
  };
  const result = SummarizeSentimentArgsSchema.safeParse({ analysis: [mockAnalysis] });
  expect(result.success).toBe(true);
});

it('TWCommentZ rejects invalid payload', () => {
  const result = TWCommentZ.safeParse({ id: '1' });
  expect(result.success).toBe(false);
});

it('AnalysisSchema rejects invalid payload', () => {
  const result = AnalysisSchema.safeParse({ commentId: '1' });
  expect(result.success).toBe(false);
});
