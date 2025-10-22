import type { FastifyInstance, FastifyRequest } from 'fastify';
import { resolveChannelAndUploads, listPlaylistVideosAuthed } from '../../lib/google.js';

/**
 * Debug endpoint for YouTube diagnostics
 * TEMPORARY: Remove after launch or restrict to development only
 */
export default async function route(app: FastifyInstance) {
  app.get('/debug/youtube', async (req: FastifyRequest, reply) => {
    const userId = req.auth?.userId || req.auth?.userDbId || req.user?.id;

    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    try {
      const meta = await resolveChannelAndUploads(userId);
      let sample: any[] = [];

      if (meta.uploadsId) {
        sample = await listPlaylistVideosAuthed(userId, meta.uploadsId, 3);
      }

      return reply.send({
        ok: true,
        userId,
        ...meta,
        sample,
      });
    } catch (err: any) {
      return reply.code(err?.code === 'YOUTUBE_NOT_CONNECTED' ? 403 : 500).send({
        ok: false,
        code: err?.code ?? 'UNKNOWN',
        message: err?.message ?? 'debug failed',
      });
    }
  });
}
