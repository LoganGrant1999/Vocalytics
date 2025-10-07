import { z } from 'zod';
export const ToneEnum = z.enum(['friendly', 'concise', 'enthusiastic']);
export const CommentSchema = z.object({
    id: z.string(),
    videoId: z.string(),
    channelId: z.string(),
    authorDisplayName: z.string(),
    authorChannelId: z.string(),
    textDisplay: z.string(),
    textOriginal: z.string(),
    likeCount: z.number(),
    publishedAt: z.string(),
    updatedAt: z.string(),
});
export const SentimentScoreSchema = z.object({
    positive: z.number(),
    negative: z.number(),
    neutral: z.number(),
});
export const AnalysisSchema = z.object({
    commentId: z.string(),
    sentiment: SentimentScoreSchema,
    topics: z.array(z.string()),
    intent: z.string(),
    toxicity: z.number(),
});
export const FetchCommentsArgsSchema = z.object({
    videoId: z.string().optional(),
    channelId: z.string().optional(),
    max: z.number().max(50).default(50),
});
export const AnalyzeCommentsArgsSchema = z.object({
    comments: z.array(CommentSchema),
});
export const GenerateRepliesArgsSchema = z.object({
    comment: CommentSchema,
    tones: z.array(ToneEnum),
});
export const SummarizeSentimentArgsSchema = z.object({
    analysis: z.array(AnalysisSchema),
});
