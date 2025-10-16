import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { zAnalysisResult, zTrendPoint } from '../../schemas';
import { enforceAnalyze } from '../paywall';
import { fetchComments, analyzeComments } from '../../tools';
import { insertAnalysis, getLatestAnalysis, listLatestAnalysesPerVideo, getTrends } from '../../db/analyses';
import { getUserVideo } from '../../db/videos';

const pSchema = z.object({ videoId: z.string() });
const trendsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(90),
});

export default async function route(app: FastifyInstance) {
  // POST /analysis/:videoId - Run analysis on a video and persist
  app.post('/analysis/:videoId', async (req: FastifyRequest, reply) => {
    const { videoId } = pSchema.parse(req.params);

    // Auth is handled by the auth plugin in the parent scope
    const userId = req.auth?.userId || req.auth?.userDbId || req.user?.id;

    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    try {
      // Enforce paywall
      const enforcement = await enforceAnalyze({
        userDbId: userId,
        incrementBy: 1,
      });

      if (!enforcement.allowed) {
        return reply.code(402).send(enforcement.error);
      }

      // Fetch comments for the video
      const { comments } = await fetchComments(videoId, undefined, 50);

      if (comments.length === 0) {
        return reply.code(400).send({
          error: 'No comments found',
          message: 'This video has no comments to analyze',
        });
      }

      // Run sentiment analysis
      const analysis = await analyzeComments(comments);

      // Calculate aggregate sentiment
      const sentimentCounts = { pos: 0, neu: 0, neg: 0 };
      for (const a of analysis) {
        if (a.category === 'positive') sentimentCounts.pos++;
        else if (a.category === 'negative') sentimentCounts.neg++;
        else sentimentCounts.neu++;
      }

      const total = analysis.length;
      const sentiment = {
        pos: sentimentCounts.pos / total,
        neu: sentimentCounts.neu / total,
        neg: sentimentCounts.neg / total,
      };

      // Calculate score (normalized positivity)
      const score = sentiment.pos - sentiment.neg;

      // Get top positive and negative comments
      const positiveComments = analysis
        .filter((a) => a.category === 'positive')
        .map((a) => ({
          commentId: a.commentId,
          text: comments.find((c) => c.id === a.commentId)?.text || '',
          sentiment: a.sentiment,
        }))
        .slice(0, 5);

      const negativeComments = analysis
        .filter((a) => a.category === 'negative')
        .map((a) => ({
          commentId: a.commentId,
          text: comments.find((c) => c.id === a.commentId)?.text || '',
          sentiment: a.sentiment,
        }))
        .slice(0, 5);

      // Generate summary
      const summary = `Analyzed ${total} comments. ${Math.round(sentiment.pos * 100)}% positive, ${Math.round(sentiment.neu * 100)}% neutral, ${Math.round(sentiment.neg * 100)}% negative.`;

      // Insert into database
      const payload = {
        sentiment,
        score,
        topPositive: positiveComments,
        topNegative: negativeComments,
        summary,
        raw: { analysis, comments: comments.map((c) => c.id) },
      };

      const row = await insertAnalysis(userId, videoId, payload);

      // Return result
      const result: any = {
        videoId,
        analyzedAt: row.analyzed_at,
        sentiment,
        score,
        topPositive: positiveComments,
        topNegative: negativeComments,
        summary,
      };

      return reply.send(zAnalysisResult.parse(result));
    } catch (error: any) {
      console.error('[analysis] POST error:', error);

      if (error.code === 'YOUTUBE_NOT_CONNECTED' || error.message?.includes('YouTube not connected')) {
        return reply.status(403).send({
          error: 'YOUTUBE_NOT_CONNECTED',
          message: 'YouTube account not connected. Please connect your YouTube account first.',
        });
      }

      return reply.status(500).send({
        error: 'Failed to analyze video',
        message: error.message,
      });
    }
  });

  // GET /analysis/:videoId - Get latest analysis for a video
  app.get('/analysis/:videoId', async (req: FastifyRequest, reply) => {
    
    const { videoId } = pSchema.parse(req.params);

    const userId = req.auth?.userId || req.auth?.userDbId || req.user?.id;

    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    try {
      const row = await getLatestAnalysis(userId, videoId);

      if (!row) {
        return reply.status(404).send({
          error: 'Not found',
          message: 'No analysis found for this video',
        });
      }

      const result: any = {
        videoId: row.video_id,
        analyzedAt: row.analyzed_at,
        sentiment: row.sentiment,
        score: row.score,
        topPositive: row.top_positive,
        topNegative: row.top_negative,
        summary: row.summary,
      };

      return reply.send(zAnalysisResult.parse(result));
    } catch (error: any) {
      console.error('[analysis] GET error:', error);
      return reply.status(500).send({
        error: 'Failed to get analysis',
        message: error.message,
      });
    }
  });

  // GET /analysis - List all latest analyses for user
  app.get('/analysis', async (req: FastifyRequest, reply) => {
    
    const userId = req.auth?.userId || req.auth?.userDbId || req.user?.id;

    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    try {
      const analyses = await listLatestAnalysesPerVideo(userId);

      // Optionally enrich with video metadata
      const enriched = await Promise.all(
        analyses.map(async (a) => {
          const video = await getUserVideo(userId, a.videoId);
          return {
            ...a,
            title: video?.title,
            thumbnailUrl: video?.thumbnail_url,
            publishedAt: video?.published_at,
          };
        })
      );

      return reply.send(enriched);
    } catch (error: any) {
      console.error('[analysis] LIST error:', error);
      return reply.status(500).send({
        error: 'Failed to list analyses',
        message: error.message,
      });
    }
  });

  // GET /analysis/trends - Get trend data
  app.get('/analysis/trends', async (req: FastifyRequest, reply) => {
    
    const userId = req.auth?.userId || req.auth?.userDbId || req.user?.id;

    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { days } = trendsQuerySchema.parse(req.query);

    try {
      const trends = await getTrends(userId, { days });
      return reply.send(trends.map((t) => zTrendPoint.parse(t)));
    } catch (error: any) {
      console.error('[analysis] TRENDS error:', error);
      return reply.status(500).send({
        error: 'Failed to get trends',
        message: error.message,
      });
    }
  });
}
