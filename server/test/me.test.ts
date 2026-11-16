import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client, makeApp, signUp } from './helpers.ts';

let app: FastifyInstance;
beforeAll(async () => {
  app = await makeApp();
});
afterAll(async () => {
  await app.close();
});

describe('/api/me/counts', () => {
  it('requires a session', async () => {
    const res = await new Client(app).get('/api/me/counts');
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('UNAUTHENTICATED');
  });

  it('returns zero counts for a new member', async () => {
    const { client } = await signUp(app);
    expect((await client.get('/api/me/counts')).json()).toEqual({ unreadConversations: 0, newRequests: 0 });
  });
});

describe('security headers', () => {
  it('sets CSP and frame protections', async () => {
    const res = await new Client(app).get('/api/health');
    expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});
