import { createHealthServer } from './health';
import { afterAll, beforeAll, it, expect } from 'vitest';
let app;
beforeAll(async () => {
    app = createHealthServer('1.0.0');
});
afterAll(async () => {
    await app.close();
});
it('returns ok on /health', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, version: '1.0.0' });
});
