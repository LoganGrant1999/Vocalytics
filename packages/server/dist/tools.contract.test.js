import { it, expect } from 'vitest';
import { FetchCommentsArgsSchema, AnalyzeCommentsArgsSchema, GenerateRepliesArgsSchema, SummarizeSentimentArgsSchema, CommentSchema, AnalysisSchema, } from './schemas';
it('FetchCommentsArgsSchema validates minimal payload', () => {
    const result = FetchCommentsArgsSchema.safeParse({ max: 10 });
    expect(result.success).toBe(true);
});
it('AnalyzeCommentsArgsSchema validates minimal payload', () => {
    const mockComment = {
        id: '1',
        videoId: 'v1',
        channelId: 'c1',
        authorDisplayName: 'Test User',
        authorChannelId: 'ac1',
        textDisplay: 'Great video!',
        textOriginal: 'Great video!',
        likeCount: 5,
        publishedAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
    };
    const result = AnalyzeCommentsArgsSchema.safeParse({ comments: [mockComment] });
    expect(result.success).toBe(true);
});
it('GenerateRepliesArgsSchema validates minimal payload', () => {
    const mockComment = {
        id: '1',
        videoId: 'v1',
        channelId: 'c1',
        authorDisplayName: 'Test User',
        authorChannelId: 'ac1',
        textDisplay: 'Great video!',
        textOriginal: 'Great video!',
        likeCount: 5,
        publishedAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
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
it('CommentSchema rejects invalid payload', () => {
    const result = CommentSchema.safeParse({ id: '1' });
    expect(result.success).toBe(false);
});
it('AnalysisSchema rejects invalid payload', () => {
    const result = AnalysisSchema.safeParse({ commentId: '1' });
    expect(result.success).toBe(false);
});
