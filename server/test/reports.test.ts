import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client, latestEmail, liveListingFor, makeApp, REQUEST, signUp } from './helpers.ts';
import { testDb } from './setup.ts';

let app: FastifyInstance;
beforeAll(async () => {
  app = await makeApp();
});
afterAll(async () => {
  await app.close();
});

const base = { reason: 'scam_or_fraud', details: 'They asked for a deposit by gift card before meeting.' };

describe('reports', () => {
  it('accepts a listing report from a signed-out visitor with an email', async () => {
    const { listingId } = await liveListingFor(app);
    const anon = new Client(app);
    expect((await anon.post('/api/reports', { ...base, targetType: 'listing', link: `https://pawhaven.example/pets/${listingId}` })).statusCode).toBe(400);
    const res = await anon.post('/api/reports', { ...base, targetType: 'listing', link: `https://pawhaven.example/pets/${listingId}`, email: 'kind@example.com' });
    expect(res.statusCode).toBe(200);
    const row = await testDb.selectFrom('reports').selectAll().executeTakeFirstOrThrow();
    expect(row.target_id).toBe(listingId);
    expect(row.status).toBe('open');
    expect(await latestEmail('kind@example.com', 'received your report')).toBeTruthy();
  });

  it('rejects unknown listings', async () => {
    const { client } = await signUp(app);
    const res = await client.post('/api/reports', { ...base, targetType: 'listing', link: '/pets/00000000-0000-4000-8000-000000000000' });
    expect(res.json().error.fields.link).toMatch(/couldn’t find/);
  });

  it('only lets participants report a conversation', async () => {
    const { listingId } = await liveListingFor(app);
    const adopter = await signUp(app);
    const convo = (await adopter.client.post(`/api/listings/${listingId}/requests`, REQUEST)).json().request.conversationId;
    const stranger = await signUp(app);
    expect((await stranger.client.post('/api/reports', { ...base, targetType: 'conversation', link: `/messages/${convo}` })).statusCode).toBe(400);
    expect((await adopter.client.post('/api/reports', { ...base, targetType: 'conversation', link: `/messages/${convo}` })).statusCode).toBe(200);
  });

  it('validates details', async () => {
    const { client } = await signUp(app);
    const res = await client.post('/api/reports', { targetType: 'other', reason: 'other', details: 'short' });
    expect(res.json().error.fields.details).toBeTruthy();
  });
});
