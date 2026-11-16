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

describe('sending a request', () => {
  it('requires a session', async () => {
    const { listingId } = await liveListingFor(app);
    expect((await new Client(app).post(`/api/listings/${listingId}/requests`, REQUEST)).statusCode).toBe(401);
  });

  it('validates input and both agreements', async () => {
    const { listingId } = await liveListingFor(app);
    const adopter = await signUp(app);
    const res = await adopter.client.post(`/api/listings/${listingId}/requests`, { ...REQUEST, agreeShare: false, household: 'short' });
    expect(res.statusCode).toBe(400);
    expect(Object.keys(res.json().error.fields)).toEqual(expect.arrayContaining(['agreeShare', 'household']));
  });

  it('creates the request, a conversation and notifies the lister', async () => {
    const { seller, listingId } = await liveListingFor(app);
    const adopter = await signUp(app, { fullName: 'Jamie Parker' });
    const res = await adopter.client.post(`/api/listings/${listingId}/requests`, { ...REQUEST, email: 'spoof@evil.example' });
    expect(res.statusCode).toBe(200);
    const request = res.json().request;
    expect(request.status).toBe('sent');
    expect(request.events.map((e: { status: string }) => e.status)).toEqual(['sent']);
    expect(request.conversationId).toBeTruthy();
    const row = await testDb.selectFrom('adoption_requests').select('email').executeTakeFirstOrThrow();
    expect(row.email).toBe(adopter.email); // never the spoofed address
    expect((await latestEmail(seller.email, 'adoption request'))?.subject).toMatch(/New adoption request for Finn/);
    expect((await seller.client.get('/api/me/counts')).json()).toEqual({ unreadConversations: 1, newRequests: 1 });
    expect((await adopter.client.get(`/api/listings/${listingId}`)).json().listing.viewer.requestId).toBe(request.id);
  });

  it('allows one active request per pet', async () => {
    const { listingId } = await liveListingFor(app);
    const adopter = await signUp(app);
    await adopter.client.post(`/api/listings/${listingId}/requests`, REQUEST);
    expect((await adopter.client.post(`/api/listings/${listingId}/requests`, REQUEST)).statusCode).toBe(409);
  });

  it('rejects requests for your own or non-live listings', async () => {
    const { seller, listingId } = await liveListingFor(app);
    expect((await seller.client.post(`/api/listings/${listingId}/requests`, REQUEST)).statusCode).toBe(403);
    await testDb.updateTable('listings').set({ status: 'paused' }).where('id', '=', listingId).execute();
    const adopter = await signUp(app);
    expect((await adopter.client.post(`/api/listings/${listingId}/requests`, REQUEST)).statusCode).toBe(404);
  });
});

describe('request lifecycle', () => {
  async function setup() {
    const { seller, listingId } = await liveListingFor(app);
    const adopter = await signUp(app, { fullName: 'Jamie Parker' });
    const request = (await adopter.client.post(`/api/listings/${listingId}/requests`, REQUEST)).json().request;
    return { seller, adopter, listingId, requestId: request.id as string };
  }

  it('keeps requests private to the applicant and the lister', async () => {
    const { requestId, listingId } = await setup();
    const stranger = await signUp(app);
    expect((await stranger.client.get(`/api/requests/${requestId}`)).statusCode).toBe(404);
    expect((await stranger.client.get(`/api/my/requests/${requestId}`)).statusCode).toBe(404);
    expect((await stranger.client.get(`/api/my/listings/${listingId}/requests`)).statusCode).toBe(404);
    expect((await stranger.client.post(`/api/my/requests/${requestId}/decline`)).statusCode).toBe(404);
  });

  it('moves through review, invite and approval with a timeline', async () => {
    const { seller, adopter, requestId, listingId } = await setup();
    const list = (await seller.client.get(`/api/my/listings/${listingId}/requests`)).json();
    expect(list.items[0].unread).toBe(true);
    expect(list.items[0].applicant.phone).toBe('(512) 555-0142');

    const opened = (await seller.client.get(`/api/my/requests/${requestId}`)).json().request;
    expect(opened.status).toBe('in_review');
    expect((await seller.client.get('/api/me/counts')).json().newRequests).toBe(0);

    expect((await seller.client.post(`/api/my/requests/${requestId}/approve`)).statusCode).toBe(200);
    // approve → approved is terminal for invite
    expect((await seller.client.post(`/api/my/requests/${requestId}/invite`)).statusCode).toBe(409);
    const mine = (await adopter.client.get(`/api/requests/${requestId}`)).json().request;
    expect(mine.events.map((e: { status: string }) => e.status)).toEqual(['sent', 'in_review', 'approved']);
    expect((await latestEmail(adopter.email, 'good news'))).toBeTruthy();
  });

  it('lets the lister invite and decline with a note', async () => {
    const { seller, adopter, requestId } = await setup();
    await seller.client.post(`/api/my/requests/${requestId}/invite`, { note: 'Saturday at the park?' });
    const res = await seller.client.post(`/api/my/requests/${requestId}/decline`, { note: 'We found a closer match.' });
    expect(res.json().request.status).toBe('declined');
    const mine = (await adopter.client.get(`/api/requests/${requestId}`)).json().request;
    expect(mine.events.at(-1)).toMatchObject({ status: 'declined', note: 'We found a closer match.' });
  });

  it('lets the applicant withdraw, hiding it from the lister', async () => {
    const { seller, adopter, requestId, listingId } = await setup();
    expect((await adopter.client.post(`/api/requests/${requestId}/withdraw`)).json().request.status).toBe('withdrawn');
    expect((await adopter.client.post(`/api/requests/${requestId}/withdraw`)).statusCode).toBe(409);
    expect((await seller.client.get(`/api/my/listings/${listingId}/requests`)).json().items).toHaveLength(0);
    // A withdrawn request no longer blocks a new one.
    expect((await adopter.client.post(`/api/listings/${listingId}/requests`, REQUEST)).statusCode).toBe(200);
  });

  it('lists the applicant’s requests', async () => {
    const { adopter } = await setup();
    const items = (await adopter.client.get('/api/requests')).json().items;
    expect(items).toHaveLength(1);
    expect(items[0].listing.name).toBe('Finn');
    expect(items[0].listing.listerName).toBe('Private pet parent');
  });
});
