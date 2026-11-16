import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { adminClient, ATTEST, Client, createListing, liveListingFor, makeApp, REQUEST, signUp } from './helpers.ts';
import { testDb } from './setup.ts';

let app: FastifyInstance;
beforeAll(async () => {
  app = await makeApp();
});
afterAll(async () => {
  await app.close();
});

type Item = { id: string; type: string; title: string; body: string | null; link: string | null; read: boolean };
const list = async (c: Client) => (await c.get('/api/notifications')).json() as { items: Item[]; unread: number };

async function withRequest() {
  const { seller, listingId } = await liveListingFor(app);
  const adopter = await signUp(app, { fullName: 'Jamie Parker' });
  const request = (await adopter.client.post(`/api/listings/${listingId}/requests`, REQUEST)).json().request;
  return { seller, adopter, listingId, requestId: request.id as string, conversationId: request.conversationId as string };
}

describe('notifications', () => {
  it('requires sign-in', async () => {
    expect((await new Client(app).get('/api/notifications')).statusCode).toBe(401);
  });

  it('notifies the lister of a new request and counts it', async () => {
    const { seller, listingId } = await withRequest();
    const n = await list(seller.client);
    expect(n.unread).toBe(1);
    expect(n.items[0]).toMatchObject({ type: 'request_new', title: 'New adoption request for Finn', link: `/my-listings/${listingId}/requests`, read: false });
    expect((await seller.client.get('/api/me/counts')).json().unreadNotifications).toBe(1);
  });

  it('notifies the applicant of each decision', async () => {
    const { seller, adopter, requestId } = await withRequest();
    await seller.client.post(`/api/my/requests/${requestId}/invite`, { note: 'Saturday works.' });
    const n = await list(adopter.client);
    expect(n.items[0]).toMatchObject({ type: 'request_invite', title: 'You’re invited to meet Finn', body: 'Saturday works.', link: `/requests/${requestId}` });
  });

  it('collapses message notifications per conversation and never stores message text', async () => {
    const { seller, adopter, conversationId } = await withRequest();
    await seller.client.post(`/api/conversations/${conversationId}/messages`, { body: 'Hello there, secret detail' });
    await seller.client.post(`/api/conversations/${conversationId}/messages`, { body: 'Another one' });
    const msgs = (await list(adopter.client)).items.filter((i) => i.type === 'message');
    expect(msgs).toHaveLength(1);
    expect(JSON.stringify(msgs)).not.toContain('secret');
    // Opening the conversation marks it read.
    await adopter.client.get(`/api/conversations/${conversationId}`);
    expect((await list(adopter.client)).unread).toBe(0);
    await seller.client.post(`/api/conversations/${conversationId}/messages`, { body: 'A third' });
    expect((await list(adopter.client)).items.filter((i) => i.type === 'message')).toHaveLength(2);
  });

  it('tells open applicants when the pet is rehomed', async () => {
    const { seller, adopter, listingId } = await withRequest();
    await seller.client.post(`/api/my/listings/${listingId}/rehomed`);
    expect((await list(adopter.client)).items[0]).toMatchObject({ type: 'request_closed', title: 'Finn has found a home' });
  });

  it('notifies owners of moderation and organizations of verification', async () => {
    const admin = await adminClient(app);
    const seller = await signUp(app);
    const { id } = await createListing(seller.client);
    await seller.client.post(`/api/my/listings/${id}/submit`, ATTEST);
    await admin.client.post(`/api/admin/listings/${id}/decision`, {
      decision: 'request_changes',
      reason: 'Please add a clearer photo.',
      checklist: { ownership: true, health: true, welfare: true, noContact: true },
    });
    const sn = (await list(seller.client)).items[0];
    expect(sn).toMatchObject({ type: 'listing_request_changes', body: 'Please add a clearer photo.', link: `/post-a-pet/${id}` });

    const shelter = await signUp(app, { accountType: 'organization' });
    const org = await testDb.selectFrom('users').select('organization_id').where('id', '=', shelter.userId).executeTakeFirstOrThrow();
    await admin.client.post(`/api/admin/organizations/${org.organization_id}/decision`, { decision: 'verify' });
    expect((await list(shelter.client)).items[0]).toMatchObject({ type: 'organization_verify', title: 'Happy Tails Rescue is verified' });
  });

  it('marks read only the caller’s own notifications', async () => {
    const { seller, adopter, requestId } = await withRequest();
    await seller.client.post(`/api/my/requests/${requestId}/invite`, {});
    const sellerItem = (await list(seller.client)).items[0]!;
    // Someone else's id is silently ignored.
    expect((await adopter.client.post('/api/notifications/read', { ids: [sellerItem.id] })).json().updated).toBe(0);
    expect((await list(seller.client)).unread).toBe(1);
    expect((await seller.client.post('/api/notifications/read', { ids: [sellerItem.id] })).json().updated).toBe(1);
    expect((await list(seller.client)).items[0]?.read).toBe(true);
    expect((await adopter.client.post('/api/notifications/read', { all: true })).json().updated).toBeGreaterThan(0);
    expect((await list(adopter.client)).unread).toBe(0);
    expect((await adopter.client.post('/api/notifications/read', { ids: ['nope'] })).statusCode).toBe(400);
  });
});
