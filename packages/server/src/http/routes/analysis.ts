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

    console.log('[analysis POST] Auth check:', {
      userId,
      hasAuth: !!req.auth,
      authKeys: req.auth ? Object.keys(req.auth) : [],
      hasUser: !!req.user
    });

    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    try {
      // In development mode, skip paywall enforcement for testing
      // In production, enforce paywall and quotas
      const isDev = process.env.NODE_ENV !== 'production';

      if (!isDev) {
        const enforcement = await enforceAnalyze({
          userDbId: userId,
          incrementBy: 1,
        });

        if (!enforcement.allowed) {
          return reply.code(402).send('error' in enforcement ? enforcement.error : { error: 'Payment required' });
        }
      }

      // Fetch ALL comments for the video using pagination
      // Use the user's YouTube OAuth token to fetch comments from any public video
      let allComments: any[] = [];
      let nextPageToken: string | undefined = undefined;
      const maxPages = 10; // Limit to prevent infinite loops (10 pages * 100 = 1000 comments max)
      let pageCount = 0;

      console.log(`[analysis] Starting to fetch comments for video ${videoId} with userId ${userId}`);

      do {
        const { comments, nextPageToken: newToken } = await fetchComments(
          videoId,
          undefined,
          100, // Fetch max per page
          nextPageToken,
          true, // Include replies to get all comments
          'time',
          userId // Always use userId to fetch real YouTube comments
        );
        allComments = allComments.concat(comments);
        nextPageToken = newToken;
        pageCount++;
        console.log(`[analysis] Fetched page ${pageCount}: ${comments.length} comments, nextPageToken: ${nextPageToken ? 'exists' : 'none'}`);
      } while (nextPageToken && pageCount < maxPages);

      const comments = allComments;
      console.log(`[analysis] Total comments fetched: ${comments.length}`);

      if (comments.length === 0) {
        return reply.code(400).send({
          error: 'No comments found',
          message: 'This video has no comments to analyze',
        });
      }

      // Run sentiment analysis
      const rawAnalysis = await analyzeComments(comments);

      // Filter out null results from failed API calls
      const analysis = rawAnalysis.filter((a) => a !== null);

      // Calculate aggregate sentiment as average of individual sentiment scores
      const total = analysis.length;
      const sentimentSums = analysis.reduce(
        (acc, a) => ({
          pos: acc.pos + a.sentiment.positive,
          neu: acc.neu + a.sentiment.neutral,
          neg: acc.neg + a.sentiment.negative,
        }),
        { pos: 0, neu: 0, neg: 0 }
      );

      const sentiment = {
        pos: sentimentSums.pos / total,
        neu: sentimentSums.neu / total,
        neg: sentimentSums.neg / total,
      };

      // Calculate score (normalized positivity)
      const score = sentiment.pos - sentiment.neg;

      // Also calculate category counts for optional display
      const categoryCounts = { pos: 0, neu: 0, neg: 0 };
      for (const a of analysis) {
        if (a.category === 'positive') categoryCounts.pos++;
        else if (a.category === 'negative') categoryCounts.neg++;
        else categoryCounts.neu++;
      }

      // Get top positive and negative comments
      const positiveComments = analysis
        .filter((a) => a.category === 'positive')
        .map((a) => ({
          commentId: a.commentId,
          text: comments.find((c) => c.id === a.commentId)?.text || '',
          sentiment: {
            pos: a.sentiment.positive,
            neu: a.sentiment.neutral,
            neg: a.sentiment.negative,
          },
        }))
        .slice(0, 5);

      const negativeComments = analysis
        .filter((a) => a.category === 'negative')
        .map((a) => ({
          commentId: a.commentId,
          text: comments.find((c) => c.id === a.commentId)?.text || '',
          sentiment: {
            pos: a.sentiment.positive,
            neu: a.sentiment.neutral,
            neg: a.sentiment.negative,
          },
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
        raw: {
          analysis,
          comments: comments.map((c) => c.id),
          categoryCounts, // Include category counts in raw for retrieval
          totalComments: total,
        },
      };

      const row = await insertAnalysis(userId, videoId, payload);

      // Return result
      const result: any = {
        videoId,
        analyzedAt: new Date(row.analyzed_at).toISOString(),
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
        analyzedAt: new Date(row.analyzed_at).toISOString(),
        sentiment: row.sentiment,
        score: row.score,
        topPositive: row.top_positive,
        topNegative: row.top_negative,
        summary: row.summary,
        categoryCounts: row.raw?.categoryCounts,
        totalComments: row.raw?.totalComments,
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
