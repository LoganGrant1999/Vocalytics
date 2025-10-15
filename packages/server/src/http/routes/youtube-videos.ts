import { z } from 'zod';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { zUserVideo } from '../../schemas';
import { getUploadsPlaylistId, listPlaylistVideos, getVideoStats } from '../../lib/google';
import { upsertUserVideos } from '../../db/videos';

const qSchema = z.object({
  mine: z.coerce.boolean().default(true),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

interface AuthRequest extends FastifyRequest {
  user?: {
    id: string;
    email?: string;
  };
  auth?: {
    userId?: string;
    userDbId?: string;
  };
}

export default async function route(app: FastifyInstance) {
  app.get('/youtube/videos', async (req: FastifyRequest, reply) => {
    const authReq = req as AuthRequest;
    const { mine, limit } = qSchema.parse(req.query);

    // Auth is handled by the auth plugin in the parent scope
    const userId = authReq.auth?.userId || authReq.auth?.userDbId || authReq.user?.id;

    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    if (!mine) {
      return reply.status(400).send({
        error: 'Only mine=true is supported for now',
      });
    }

    try {
      // Get the user's uploads playlist ID
      const uploadsId = await getUploadsPlaylistId(userId);

      // List videos from the uploads playlist
      const videos = await listPlaylistVideos(userId, uploadsId, limit);

      // Get statistics for all videos
      const videoIds = videos.map((v) => v.videoId);
      const statsMap = await getVideoStats(userId, videoIds);

      // Merge stats into videos
      const mapped = videos.map((v) => ({
        videoId: v.videoId,
        title: v.title,
        thumbnailUrl: v.thumbnailUrl,
        publishedAt: v.publishedAt,
        stats: statsMap[v.videoId] ?? {},
      }));

      // Upsert into cache
      await upsertUserVideos(userId, mapped);

      return reply.send(mapped);
    } catch (error: any) {
      console.error('[youtube-videos] Error:', error);

      if (error.message?.includes('YouTube not connected')) {
        return reply.status(403).send({
          error: 'YouTube not connected',
          message: 'Please connect your YouTube account first',
        });
      }

      return reply.status(500).send({
        error: 'Failed to fetch videos',
        message: error.message,
      });
    }
  });
}
