import Fastify from 'fastify';
export function createHealthServer(version = '1.0.0') {
    const fastify = Fastify({ logger: false });
    fastify.get('/health', async () => ({ ok: true, version }));
    return fastify;
}
