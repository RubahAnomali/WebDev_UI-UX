import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client, liveListingFor, makeApp, REQUEST, signUp } from './helpers.ts';
import { testDb } from './setup.ts';

let app: FastifyInstance;
beforeAll(async () => {
  app = await makeApp();
});
afterAll(async () => {
  await app.close();
});

async function viaRequest() {
  const { seller, listingId } = await liveListingFor(app);
  const adopter = await signUp(app, { fullName: 'Jamie Parker' });
  const request = (await adopter.client.post(`/api/listings/${listingId}/requests`, REQUEST)).json().request;
  return { seller, adopter, listingId, conversationId: request.conversationId as string };
}

describe('conversations', () => {
  it('starts from an adoption request with the request message', async () => {
    const { seller, conversationId } = await viaRequest();
    const list = (await seller.client.get('/api/conversations')).json().items;
    expect(list).toHaveLength(1);
    expect(list[0].otherName).toBe('Jamie Parker'); // shared through the request
    expect(list[0].unread).toBe(true);
    const convo = (await seller.client.get(`/api/conversations/${conversationId}`)).json().conversation;
    expect(convo.messages[0].body).toBe(REQUEST.message);
    expect(convo.viewerIsLister).toBe(true);
    expect((await seller.client.get('/api/conversations')).json().items[0].unread).toBe(false);
  });

  it('shows only first names for individuals', async () => {
    const { adopter } = await viaRequest();
    const list = (await adopter.client.get('/api/conversations')).json().items;
    expect(list[0].otherName).toBe('Alex'); // seller "Alex Morgan", an individual
  });

  it('starts or reuses a direct conversation from a listing', async () => {
    const { listingId } = await liveListingFor(app);
    const member = await signUp(app);
    const a = (await member.client.post('/api/conversations', { listingId, body: 'Is Finn good with other cats?' })).json();
    const b = (await member.client.post('/api/conversations', { listingId, body: 'And does he like car rides?' })).json();
    expect(b.conversationId).toBe(a.conversationId);
    expect((await member.client.get(`/api/conversations/lookup?listing=${listingId}`)).json().conversationId).toBe(a.conversationId);
    const convo = (await member.client.get(`/api/conversations/${a.conversationId}`)).json().conversation;
    expect(convo.messages.map((m: { body: string }) => m.body)).toHaveLength(2);
  });

  it('is private to participants', async () => {
    const { conversationId } = await viaRequest();
    const stranger = await signUp(app);
    expect((await stranger.client.get(`/api/conversations/${conversationId}`)).statusCode).toBe(404);
    expect((await stranger.client.post(`/api/conversations/${conversationId}/messages`, { body: 'hi' })).statusCode).toBe(404);
    expect((await new Client(app).get('/api/conversations')).statusCode).toBe(401);
  });

  it('counts unread conversations and tracks read receipts', async () => {
    const { seller, adopter, conversationId } = await viaRequest();
    await seller.client.get(`/api/conversations/${conversationId}`); // seller reads
    await seller.client.post(`/api/conversations/${conversationId}/messages`, { body: 'Thanks! When are you free?' });
    expect((await adopter.client.get('/api/me/counts')).json().unreadConversations).toBe(1);
    const convo = (await adopter.client.get(`/api/conversations/${conversationId}`)).json().conversation;
    expect(convo.messages.at(-1)).toMatchObject({ body: 'Thanks! When are you free?', fromMe: false });
    expect((await adopter.client.get('/api/me/counts')).json().unreadConversations).toBe(0);
    const sellerView = (await seller.client.get(`/api/conversations/${conversationId}`)).json().conversation;
    expect(new Date(sellerView.otherLastReadAt).getTime()).toBeGreaterThanOrEqual(new Date(sellerView.messages.at(-1).at).getTime());
  });

  it('emails once per unread burst and never includes message content', async () => {
    const { seller, adopter, conversationId } = await viaRequest();
    await testDb.deleteFrom('dev_outbox').execute();
    await seller.client.post(`/api/conversations/${conversationId}/messages`, { body: 'Secret plan one' });
    await seller.client.post(`/api/conversations/${conversationId}/messages`, { body: 'Secret plan two' });
    const mails = await testDb.selectFrom('dev_outbox').selectAll().where('to_email', '=', adopter.email).execute();
    expect(mails).toHaveLength(1);
    expect(mails[0]!.body).not.toContain('Secret');
  });

  it('validates message length', async () => {
    const { adopter, conversationId } = await viaRequest();
    expect((await adopter.client.post(`/api/conversations/${conversationId}/messages`, { body: '   ' })).statusCode).toBe(400);
    expect((await adopter.client.post(`/api/conversations/${conversationId}/messages`, { body: 'x'.repeat(2001) })).statusCode).toBe(400);
  });
});

describe('blocking', () => {
  it('stops messages in both directions and blocks new requests', async () => {
    const { seller, adopter, conversationId, listingId } = await viaRequest();
    await seller.client.post(`/api/conversations/${conversationId}/block`);
    expect((await adopter.client.post(`/api/conversations/${conversationId}/messages`, { body: 'Hello?' })).statusCode).toBe(403);
    expect((await seller.client.post(`/api/conversations/${conversationId}/messages`, { body: 'Hi' })).statusCode).toBe(403);
    expect((await adopter.client.get(`/api/conversations/${conversationId}`)).json().conversation.canSend).toBe(false);
    await adopter.client.post(`/api/requests/${(await adopter.client.get('/api/requests')).json().items[0].id}/withdraw`);
    expect((await adopter.client.post(`/api/listings/${listingId}/requests`, REQUEST)).statusCode).toBe(403);
    await seller.client.del(`/api/conversations/${conversationId}/block`);
    expect((await adopter.client.post(`/api/conversations/${conversationId}/messages`, { body: 'Hello again' })).statusCode).toBe(200);
  });
});
