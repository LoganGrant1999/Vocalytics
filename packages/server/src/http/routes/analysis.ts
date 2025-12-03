import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { zAnalysisResult, zTrendPoint } from '../../schemas.js';
import { fetchComments, analyzeComments } from '../../tools.js';
import { generateCommentSummary } from '../../llm.js';
import { insertAnalysis, getLatestAnalysis, listLatestAnalysesPerVideo, getTrends } from '../../db/analyses.js';
import { getUserVideo } from '../../db/videos.js';
import { getVideoStatsAuthed, getAuthedYouTubeForUser, getUnauthenticatedYouTube } from '../../lib/google.js';

const pSchema = z.object({ videoId: z.string() });
const trendsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(90),
});

// ============================================================================
// Comment Fetching & Sampling Configuration
// ============================================================================
/**
 * Normal videos (commentCount <= LARGE_VIDEO_COMMENT_THRESHOLD):
 *   - Fetch up to MAX_COMMENTS_PER_VIDEO comments (1000)
 *   - Use up to MAX_PAGES_NORMAL pages (10 pages × 100 = 1000 max)
 *   - If total fetched > 2000, apply intelligent sampling (top 450 + random 550)
 *   - Otherwise analyze all fetched comments
 *
 * Large videos (commentCount > LARGE_VIDEO_COMMENT_THRESHOLD):
 *   - Use LARGE VIDEO FAST PATH to avoid excessive YouTube API calls
 *   - Fetch only LARGE_VIDEO_MAX_COMMENTS_TO_FETCH comments (600)
 *   - Use only LARGE_VIDEO_MAX_PAGES pages (6 pages × 100 = 600 max)
 *   - Apply sampling within this subset: top 250 + random fill to 500
 *   - Marked as sampled=true in database
 *
 * This dramatically reduces latency for videos with 10k+ comments while
 * preserving quality for normal videos.
 */
const MAX_COMMENTS_PER_VIDEO = 1000;           // Max to analyze for normal videos
const MAX_PAGES_NORMAL = 10;                   // Max pagination for normal videos
const LARGE_VIDEO_COMMENT_THRESHOLD = 2000;   // Videos with more comments use fast path
const LARGE_VIDEO_MAX_COMMENTS_TO_FETCH = 600; // Cap fetch for large videos
const LARGE_VIDEO_MAX_PAGES = 6;              // 6 pages × 100 = 600 comments
const LARGE_VIDEO_TOP_ENGAGED_COUNT = 250;    // Top comments by engagement (large videos)
const LARGE_VIDEO_TARGET_SAMPLE_SIZE = 500;   // Target sample size for large videos

// ============================================================================
// Progress Tracking
// ============================================================================
interface AnalysisProgress {
  progress: number; // 0-100
  status: string;
  error?: string;
}

const progressTracker = new Map<string, AnalysisProgress>();

function updateProgress(videoId: string, progress: number, status: string) {
  progressTracker.set(videoId, { progress, status });
  console.log(`[analysis progress] ${videoId}: ${progress}% - ${status}`);
}

function clearProgress(videoId: string) {
  progressTracker.delete(videoId);
}

function setProgressError(videoId: string, error: string) {
  progressTracker.set(videoId, { progress: 0, status: 'Error', error });
}

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
      // Initialize progress tracking
      updateProgress(videoId, 0, 'Starting analysis...');

      // Video analysis is now available to all users (free and pro)
      // No paywall enforcement needed

      // ============================================================================
      // Phase 1: Determine Video Size & Select Fetching Strategy
      // ============================================================================
      updateProgress(videoId, 5, 'Checking video size...');

      // Try to get authenticated YouTube client first, fall back to unauthenticated
      let yt: any;
      let isAuthenticated = true;
      let isOwnVideo = false;
      let userChannelId: string | undefined;

      try {
        yt = await getAuthedYouTubeForUser(userId);
        console.log(`[analysis] Using authenticated YouTube API for user ${userId}`);
      } catch (err: any) {
        if (err.code === 'YOUTUBE_NOT_CONNECTED') {
          console.log(`[analysis] YouTube not connected for user ${userId}, using unauthenticated API`);
          yt = getUnauthenticatedYouTube();
          isAuthenticated = false;
        } else {
          throw err;
        }
      }

      // Get video details (stats + snippet for channel ID)
      const videoResponse = await yt.videos.list({
        id: [videoId],
        part: ['statistics', 'snippet'],
      });

      const videoData = videoResponse.data.items?.[0];
      const videoCommentCount = videoData?.statistics?.commentCount ? Number(videoData.statistics.commentCount) : 0;
      const videoChannelId = videoData?.snippet?.channelId;

      // If authenticated, check if this is the user's own video
      if (isAuthenticated) {
        const channelsResponse = await yt.channels.list({
          part: ['id'],
          mine: true,
        });
        userChannelId = channelsResponse.data.items?.[0]?.id;
        isOwnVideo = videoChannelId && userChannelId && videoChannelId === userChannelId;
        console.log(`[analysis] Video ownership check: videoChannel=${videoChannelId}, userChannel=${userChannelId}, isOwn=${isOwnVideo}`);
      } else {
        console.log(`[analysis] Unauthenticated mode: cannot determine video ownership`);
      }

      // Determine if this is a large video requiring the fast path
      const isLargeVideo = videoCommentCount > LARGE_VIDEO_COMMENT_THRESHOLD;
      const maxPages = isLargeVideo ? LARGE_VIDEO_MAX_PAGES : MAX_PAGES_NORMAL;
      const maxCommentsToFetch = isLargeVideo ? LARGE_VIDEO_MAX_COMMENTS_TO_FETCH : MAX_COMMENTS_PER_VIDEO;

      console.log(`[analysis] Video stats: commentCount=${videoCommentCount}, isLargeVideo=${isLargeVideo}`);
      console.log(`[analysis] Fetch limits: maxPages=${maxPages}, maxCommentsToFetch=${maxCommentsToFetch}`);

      // ============================================================================
      // Phase 2: Fetch Comments with Pagination (using selected strategy)
      // ============================================================================
      updateProgress(videoId, 10, 'Fetching comments...');

      let allComments: any[] = [];
      let nextPageToken: string | undefined = undefined;
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

        // Update progress during pagination (10% to 50%)
        const paginationProgress = Math.min(50, 10 + (pageCount / maxPages) * 40);
        updateProgress(videoId, Math.round(paginationProgress), `Fetching comments (${pageCount}/${maxPages} pages)...`);

        console.log(`[analysis] Fetched page ${pageCount}: ${comments.length} comments, nextPageToken: ${nextPageToken ? 'exists' : 'none'}`);

        // Stop if we've hit the max comments limit for this strategy
        if (allComments.length >= maxCommentsToFetch) {
          console.log(`[analysis] Reached maxCommentsToFetch (${maxCommentsToFetch}), stopping pagination`);
          break;
        }
      } while (nextPageToken && pageCount < maxPages);

      const totalCommentsFetched = allComments.length;
      console.log(`[analysis] Total comments fetched: ${totalCommentsFetched} (from ${videoCommentCount} total on video)`);

      if (totalCommentsFetched === 0) {
        setProgressError(videoId, 'No comments found');
        return reply.code(400).send({
          error: 'No comments found',
          message: 'This video has no comments to analyze',
        });
      }

      // ============================================================================
      // Phase 3: Intelligent Sampling
      // ============================================================================
      updateProgress(videoId, 55, 'Processing comments...');

      let comments = allComments;
      let sampled = false;
      let sampledCount = totalCommentsFetched;

      if (isLargeVideo) {
        // Large video fast path: always sample from the capped subset we fetched
        sampled = true;
        const TOP_ENGAGED_COUNT = LARGE_VIDEO_TOP_ENGAGED_COUNT;
        const TARGET_SAMPLE_SIZE = LARGE_VIDEO_TARGET_SAMPLE_SIZE;

        console.log(`[analysis] Large video fast path: sampling ${TARGET_SAMPLE_SIZE} from ${totalCommentsFetched} fetched comments`);

        // Sort by engagement score (likes + replies * 2)
        const sortedByEngagement = [...allComments].sort((a, b) => {
          const scoreA = (a.likeCount ?? 0) + (a.replyCount ?? 0) * 2;
          const scoreB = (b.likeCount ?? 0) + (b.replyCount ?? 0) * 2;
          return scoreB - scoreA;
        });

        // Take top comments by engagement
        const topComments = sortedByEngagement.slice(0, TOP_ENGAGED_COUNT);
        const topCommentIds = new Set(topComments.map(c => c.id));

        // Remaining comments for random sampling
        const remainingComments = allComments.filter(c => !topCommentIds.has(c.id));
        const needToSample = TARGET_SAMPLE_SIZE - topComments.length;

        // Random sample from remaining
        const sampledRemaining: typeof allComments = [];
        if (remainingComments.length > needToSample) {
          // Fisher-Yates shuffle for random sampling
          const shuffled = [...remainingComments];
          for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
          }
          sampledRemaining.push(...shuffled.slice(0, needToSample));
        } else {
          sampledRemaining.push(...remainingComments);
        }

        // Combine and sort by original order (publishedAt)
        comments = [...topComments, ...sampledRemaining].sort((a, b) =>
          new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
        );

        sampledCount = comments.length;

        console.log(`[analysis] Large video sampling complete: ${sampledCount} comments selected (${topComments.length} top + ${sampledRemaining.length} random)`);
      } else if (totalCommentsFetched > 2000) {
        // Normal video but fetched many comments: apply traditional sampling
        sampled = true;
        const MAX_COMMENTS = 1000;
        const TOP_COMMENTS = 450;

        console.log(`[analysis] Normal video with many comments (${totalCommentsFetched}). Applying intelligent sampling...`);

        // Sort by engagement score (likes + replies * 2)
        const sortedByEngagement = [...allComments].sort((a, b) => {
          const scoreA = (a.likeCount ?? 0) + (a.replyCount ?? 0) * 2;
          const scoreB = (b.likeCount ?? 0) + (b.replyCount ?? 0) * 2;
          return scoreB - scoreA;
        });

        // Take top comments by engagement
        const topComments = sortedByEngagement.slice(0, TOP_COMMENTS);
        const topCommentIds = new Set(topComments.map(c => c.id));

        // Remaining comments for random sampling
        const remainingComments = allComments.filter(c => !topCommentIds.has(c.id));
        const needToSample = MAX_COMMENTS - TOP_COMMENTS;

        // Random sample from remaining
        const sampledRemaining: typeof allComments = [];
        if (remainingComments.length > needToSample) {
          // Fisher-Yates shuffle for random sampling
          const shuffled = [...remainingComments];
          for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
          }
          sampledRemaining.push(...shuffled.slice(0, needToSample));
        } else {
          sampledRemaining.push(...remainingComments);
        }

        // Combine and sort by original order (publishedAt)
        comments = [...topComments, ...sampledRemaining].sort((a, b) =>
          new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
        );

        sampledCount = comments.length;

        console.log(`[analysis] Normal video sampling complete: ${sampledCount} comments selected (${TOP_COMMENTS} top + ${sampledRemaining.length} random) from ${totalCommentsFetched} total`);
      } else {
        // Normal video with reasonable number of comments: analyze all
        console.log(`[analysis] Normal video (${totalCommentsFetched} comments). Analyzing all without sampling.`);
      }

      // Get user tier for concurrency optimization
      const userTier = req.user?.tier || req.auth?.tier || 'free';

      // Run sentiment analysis (with incremental caching and tier-based concurrency)
      updateProgress(videoId, 60, `Analyzing ${comments.length} comments...`);
      const rawAnalysis = await analyzeComments(comments, {
        userId,
        videoId,
        userTier,
      });

      // Filter out null results from failed API calls
      const analysis = rawAnalysis.filter((a) => a !== null);
      updateProgress(videoId, 75, 'Aggregating results...');

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

      // Get top positive and negative comments with full metadata (sorted by likes)
      // Only include top-level comments (exclude replies which have dots in the ID)
      const positiveComments = analysis
        .filter((a) => a.category === 'positive' && !a.commentId.includes('.'))
        .map((a) => {
          const comment = comments.find((c) => c.id === a.commentId);
          return {
            commentId: a.commentId,
            text: comment?.text || '',
            author: comment?.author || 'Anonymous',
            publishedAt: comment?.publishedAt || new Date().toISOString(),
            likeCount: comment?.likeCount ?? 0,
            sentiment: {
              pos: a.sentiment.positive,
              neu: a.sentiment.neutral,
              neg: a.sentiment.negative,
            },
          };
        })
        .sort((a, b) => b.likeCount - a.likeCount) // Sort by likes descending
        .slice(0, 5);

      const negativeComments = analysis
        .filter((a) => a.category === 'negative' && !a.commentId.includes('.'))
        .map((a) => {
          const comment = comments.find((c) => c.id === a.commentId);
          return {
            commentId: a.commentId,
            text: comment?.text || '',
            author: comment?.author || 'Anonymous',
            publishedAt: comment?.publishedAt || new Date().toISOString(),
            likeCount: comment?.likeCount ?? 0,
            sentiment: {
              pos: a.sentiment.positive,
              neu: a.sentiment.neutral,
              neg: a.sentiment.negative,
            },
          };
        })
        .sort((a, b) => b.likeCount - a.likeCount) // Sort by likes descending
        .slice(0, 5);

      // Generate AI summary
      updateProgress(videoId, 85, 'Generating AI summary...');
      console.log('[analysis] Generating AI summary...');
      const aiSummary = await generateCommentSummary(
        comments.map(c => ({ text: c.text })),
        sentiment
      );

      // Fallback to basic summary if AI fails
      const summary = aiSummary || `Analyzed ${total} comments. ${Math.round(sentiment.pos * 100)}% positive, ${Math.round(sentiment.neu * 100)}% neutral, ${Math.round(sentiment.neg * 100)}% negative.`;
      console.log('[analysis] Summary generated:', summary);

      // Insert into database
      updateProgress(videoId, 95, 'Saving results...');
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
          // Sampling metadata
          sampled,
          sampledCount: sampled ? sampledCount : undefined,
          totalCommentsFetched: sampled ? totalCommentsFetched : undefined,
          // Large video fast path metadata
          isLargeVideo,
          videoCommentCount,
          usedFastPath: isLargeVideo,
        },
      };

      const row = await insertAnalysis(userId, videoId, payload);

      // Insert high-priority comments into comment_scores table for dashboard
      const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      // Only insert high-priority comments if this is the user's own video
      // (users can only reply to comments on their own videos)
      if (isOwnVideo) {
        // Clear existing scores for this video first
        await supabase
          .from('comment_scores')
          .delete()
          .eq('user_id', userId)
          .eq('video_id', videoId);

        // Insert top positive comments with high priority
        const positiveScores = positiveComments.map((comment) => ({
          user_id: userId,
          video_id: videoId,
          comment_id: comment.commentId,
          comment_text: comment.text,
          author_name: comment.author,
          like_count: comment.likeCount,
          published_at: comment.publishedAt,
          priority_score: 80, // High priority for top positive
          sentiment: 'positive',
          reasons: ['Top positive comment', 'High engagement'],
          should_auto_reply: false,
        }));

        // Insert top negative comments with high priority
        const negativeScores = negativeComments.map((comment) => ({
          user_id: userId,
          video_id: videoId,
          comment_id: comment.commentId,
          comment_text: comment.text,
          author_name: comment.author,
          like_count: comment.likeCount,
          published_at: comment.publishedAt,
          priority_score: 85, // Higher priority for negatives (need attention)
          sentiment: 'negative',
          reasons: ['Top negative comment', 'Needs response'],
          should_auto_reply: false,
        }));

        // Combine and insert
        const allScores = [...positiveScores, ...negativeScores];
        if (allScores.length > 0) {
          console.log(`[analysis] Attempting to insert ${allScores.length} scores for user ${userId}:`, JSON.stringify(allScores, null, 2));
          const { data, error } = await supabase.from('comment_scores').insert(allScores);
          if (error) {
            console.error(`[analysis] Error inserting comment scores:`, error);
            throw error;
          }
          console.log(`[analysis] Successfully inserted ${allScores.length} high-priority comments to dashboard (user's own video)`);
        }
      } else {
        console.log(`[analysis] Skipping comment scores insertion - not user's video`);
      }

      // Clear progress tracking - analysis complete
      updateProgress(videoId, 100, 'Analysis complete!');
      // Clean up after a short delay to allow frontend to see 100%
      setTimeout(() => clearProgress(videoId), 2000);

      // Return result
      const result: any = {
        videoId,
        analyzedAt: new Date(row.analyzed_at).toISOString(),
        sentiment,
        score,
        topPositive: positiveComments,
        topNegative: negativeComments,
        summary,
        categoryCounts,
        totalComments: total,
        // Include sampling metadata if applicable
        sampled: sampled || undefined,
        sampledCount: sampled ? sampledCount : undefined,
        totalCommentsFetched: sampled ? totalCommentsFetched : undefined,
      };

      return reply.send(zAnalysisResult.parse(result));
    } catch (error: any) {
      console.error('[analysis] POST error:', error);

      // Set progress error
      setProgressError(videoId, error.message || 'Analysis failed');

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

  // GET /analysis/:videoId/progress - Get analysis progress
  app.get('/analysis/:videoId/progress', async (req: FastifyRequest, reply) => {
    const { videoId } = pSchema.parse(req.params);

    const progress = progressTracker.get(videoId);

    if (!progress) {
      return reply.send({ progress: null });
    }

    return reply.send(progress);
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

      console.log('[analysis GET] Raw data from DB:', {
        hasRaw: !!row.raw,
        rawKeys: row.raw ? Object.keys(row.raw) : [],
        hasCategoryCounts: !!row.raw?.categoryCounts,
        hasAnalysis: !!row.raw?.analysis,
        analysisLength: row.raw?.analysis?.length,
        rawSample: row.raw ? JSON.stringify(row.raw).substring(0, 200) : 'none'
      });

      // Calculate categoryCounts if not present (for older analyses)
      let categoryCounts = row.raw?.categoryCounts;
      if (!categoryCounts && row.raw?.analysis) {
        console.log('[analysis GET] Calculating categoryCounts from raw.analysis');
        categoryCounts = { pos: 0, neu: 0, neg: 0 };
        for (const a of row.raw.analysis) {
          if (a.category === 'positive') categoryCounts.pos++;
          else if (a.category === 'negative') categoryCounts.neg++;
          else categoryCounts.neu++;
        }
        console.log('[analysis GET] Calculated categoryCounts:', categoryCounts);
      } else {
        console.log('[analysis GET] Using existing categoryCounts:', categoryCounts);
      }

      // Fetch posted replies for this user and video
      const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
      const { data: postedReplies } = await supabase
        .from('posted_replies')
        .select('comment_id, reply_text, posted_at')
        .eq('user_id', userId)
        .eq('video_id', videoId);

      // Create a map of commentId -> reply info for quick lookup
      const repliesMap = new Map(
        (postedReplies || []).map(r => [r.comment_id, { replyText: r.reply_text, postedAt: r.posted_at }])
      );

      // Ensure topPositive and topNegative have all required fields (for older analyses)
      const ensureCommentFields = (comment: any) => {
        const postedReply = repliesMap.get(comment.commentId);
        return {
          ...comment,
          author: comment.author || 'Anonymous',
          publishedAt: comment.publishedAt || new Date().toISOString(),
          likeCount: comment.likeCount || 0,
          postedReply: postedReply || null,
        };
      };

      const result: any = {
        videoId: row.video_id,
        analyzedAt: new Date(row.analyzed_at).toISOString(),
        sentiment: row.sentiment,
        score: row.score,
        topPositive: (row.top_positive || []).map(ensureCommentFields),
        topNegative: (row.top_negative || []).map(ensureCommentFields),
        summary: row.summary,
        categoryCounts,
        totalComments: row.raw?.totalComments || row.raw?.analysis?.length,
        // Include sampling metadata if present
        sampled: row.raw?.sampled || undefined,
        sampledCount: row.raw?.sampledCount || undefined,
        totalCommentsFetched: row.raw?.totalCommentsFetched || undefined,
      };

      console.log('[analysis GET] Result before Zod parse:', JSON.stringify(result));
      const parsed = zAnalysisResult.parse(result);
      console.log('[analysis GET] Result after Zod parse:', JSON.stringify(parsed));
      return reply.send(parsed);
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
