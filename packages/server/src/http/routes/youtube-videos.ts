import { z } from 'zod';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { zUserVideo } from '../../schemas';
import { resolveChannelAndUploads, listPlaylistVideosAuthed, getVideoStatsAuthed } from '../../lib/google';
import { upsertUserVideos } from '../../db/videos';

const qSchema = z.object({
  mine: z.coerce.boolean().default(true),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export default async function route(app: FastifyInstance) {
  app.get('/youtube/videos', async (req: FastifyRequest, reply) => {
    const started = Date.now();

    try {
      // Auth is handled by the auth plugin in the parent scope
      const userId = req.auth?.userId || req.auth?.userDbId || req.user?.id;

      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { mine, limit } = qSchema.parse(req.query);

      if (!mine) {
        return reply.status(400).send({
          error: 'Only mine=true is supported for now',
        });
      }

      // Resolve channel and uploads playlist
      const { channelId, channelTitle, uploadsId } = await resolveChannelAndUploads(userId);

      if (!uploadsId) {
        const warnData = { userId, channelId, channelTitle };
        if (typeof app.log.warn === 'function') {
          app.log.warn(warnData, 'No uploads playlist found');
        } else {
          console.warn('[WARN] No uploads playlist found', warnData);
        }
        // Connected but no uploads playlist (brand account or no channel)
        return reply.code(200).send([]);
      }

      // List videos from uploads playlist
      const videos = await listPlaylistVideosAuthed(userId, uploadsId, limit);

      // Get statistics for all videos
      const stats = await getVideoStatsAuthed(
        userId,
        videos.map((v) => v.videoId)
      );

      // Merge stats into videos
      const payload = videos.map((v) =>
        zUserVideo.parse({
          videoId: v.videoId,
          title: v.title,
          thumbnailUrl: v.thumbnailUrl,
          publishedAt: v.publishedAt,
          stats: stats[v.videoId] ?? {},
        })
      );

      // Upsert into cache
      await upsertUserVideos(userId, payload);

      const infoData = {
        userId,
        count: payload.length,
        ms: Date.now() - started,
        channelTitle,
      };
      if (typeof app.log.info === 'function') {
        app.log.info(infoData, 'Listed uploads');
      } else {
        console.log('[INFO] Listed uploads', infoData);
      }

      // Hint to UI which channel is connected
      reply.header('x-youtube-channel', channelTitle ?? '');
      return reply.send(payload);
    } catch (error: any) {
      const userId = req.auth?.userId || req.auth?.userDbId || req.user?.id;

      // Handle YouTube not connected error with specific error code
      if (error.code === 'YOUTUBE_NOT_CONNECTED' || error.message?.includes('YouTube not connected')) {
        const warnData = { userId };
        if (typeof app.log.warn === 'function') {
          app.log.warn(warnData, 'YouTube not connected');
        } else {
          console.warn('[WARN] YouTube not connected', warnData);
        }
        return reply.code(403).send({
          error: 'YOUTUBE_NOT_CONNECTED',
          message: 'YouTube account not connected. Please connect to list uploads.',
        });
      }

      const errorData = { err: error, userId };
      if (typeof app.log.error === 'function') {
        app.log.error(errorData, 'youtube/videos error');
      } else {
        console.error('[ERROR] youtube/videos error', errorData);
      }
      return reply.code(500).send({
        error: 'VIDEOS_FETCH_FAILED',
        message: 'Failed to list uploads',
      });
    }
  });
}
