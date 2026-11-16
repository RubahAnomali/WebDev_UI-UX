import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { adminClient, ATTEST, Client, createListing, latestEmail, liveListingFor, makeApp, REQUEST, signUp } from './helpers.ts';
import { testDb } from './setup.ts';

let app: FastifyInstance;
beforeAll(async () => {
  app = await makeApp();
});
afterAll(async () => {
  await app.close();
});

const ALL_CHECKED = { ownership: true, health: true, welfare: true, noContact: true };

async function pendingListing() {
  const seller = await signUp(app);
  const { id } = await createListing(seller.client);
  await seller.client.post(`/api/my/listings/${id}/submit`, ATTEST);
  return { seller, id };
}

describe('admin access', () => {
  it.each(['/api/admin/summary', '/api/admin/listings', '/api/admin/reports', '/api/admin/organizations', '/api/admin/users', '/api/admin/audit'])(
    '%s is staff-only',
    async (url) => {
      expect((await new Client(app).get(url)).statusCode).toBe(401);
      const member = await signUp(app);
      expect((await member.client.get(url)).statusCode).toBe(403);
      const seller = await signUp(app);
      await testDb.updateTable('users').set({ roles: ['member', 'seller'] }).where('id', '=', seller.userId).execute();
      expect((await seller.client.get(url)).statusCode).toBe(403);
    },
  );

  it('blocks members from moderating', async () => {
    const { id } = await pendingListing();
    const member = await signUp(app);
    const res = await member.client.post(`/api/admin/listings/${id}/decision`, { decision: 'approve', checklist: ALL_CHECKED });
    expect(res.statusCode).toBe(403);
  });
});

describe('listing review', () => {
  it('requires the full checklist to approve, then publishes and notifies', async () => {
    const { seller, id } = await pendingListing();
    const { client } = await adminClient(app);
    expect((await client.get('/api/admin/listings')).json().items.map((i: { id: string }) => i.id)).toContain(id);
    const detail = (await client.get(`/api/admin/listings/${id}`)).json().listing;
    expect(detail.flags.contactInfo).toBe(false);
    expect(detail.owner.emailVerified).toBe(true);

    const partial = await client.post(`/api/admin/listings/${id}/decision`, { decision: 'approve', checklist: { ...ALL_CHECKED, welfare: false } });
    expect(partial.statusCode).toBe(400);
    const ok = await client.post(`/api/admin/listings/${id}/decision`, { decision: 'approve', checklist: ALL_CHECKED });
    expect(ok.json().status).toBe('live');
    expect((await new Client(app).get(`/api/listings/${id}`)).statusCode).toBe(200);
    expect((await latestEmail(seller.email, 'is live'))).toBeTruthy();
    expect((await client.get('/api/admin/summary')).json().reviewedToday).toBe(1);
    const audit = (await client.get('/api/admin/audit')).json().items;
    expect(audit[0]).toMatchObject({ action: 'listing.approve', actor: 'Sam Staff' });
  });

  it('requests changes with a reason the lister can see', async () => {
    const { seller, id } = await pendingListing();
    const { client } = await adminClient(app);
    expect((await client.post(`/api/admin/listings/${id}/decision`, { decision: 'request_changes', checklist: ALL_CHECKED })).statusCode).toBe(400);
    await client.post(`/api/admin/listings/${id}/decision`, { decision: 'request_changes', reason: 'Please clarify the care requirements.', checklist: ALL_CHECKED });
    const mine = (await seller.client.get(`/api/my/listings/${id}`)).json().listing;
    expect(mine.status).toBe('changes_requested');
    expect(mine.moderationNote).toBe('Please clarify the care requirements.');
    // The lister can fix and resubmit.
    expect((await seller.client.post(`/api/my/listings/${id}/submit`, ATTEST)).json().listing.status).toBe('pending');
  });

  it('won’t approve listings from unverified organizations', async () => {
    const org = await signUp(app, { accountType: 'organization' });
    const { id } = await createListing(org.client, { listingType: 'adoption' });
    await testDb.updateTable('listings').set({ status: 'pending' }).where('id', '=', id).execute();
    const { client } = await adminClient(app);
    const res = await client.post(`/api/admin/listings/${id}/decision`, { decision: 'approve', checklist: ALL_CHECKED });
    expect(res.statusCode).toBe(409);
  });

  it('admins cannot review their own listings', async () => {
    const admin = await adminClient(app);
    const { id } = await createListing(admin.client);
    await testDb.updateTable('listings').set({ status: 'pending' }).where('id', '=', id).execute();
    expect((await admin.client.post(`/api/admin/listings/${id}/decision`, { decision: 'approve', checklist: ALL_CHECKED })).statusCode).toBe(403);
  });
});

describe('organizations', () => {
  it('verifying grants the seller capability', async () => {
    const org = await signUp(app, { accountType: 'organization' });
    const { client } = await adminClient(app);
    const item = (await client.get('/api/admin/organizations')).json().items[0];
    expect(item.contact.email).toBe(org.email);
    await client.post(`/api/admin/organizations/${item.id}/decision`, { decision: 'verify' });
    const me = (await org.client.get('/api/auth/me')).json().user;
    expect(me.organizationVerification).toBe('verified');
    expect(me.roles).toContain('seller');
  });
});

describe('reports & members', () => {
  it('resolves a conversation report by suspending the other member', async () => {
    const { seller, listingId } = await liveListingFor(app);
    const adopter = await signUp(app);
    const convo = (await adopter.client.post(`/api/listings/${listingId}/requests`, REQUEST)).json().request.conversationId;
    await adopter.client.post('/api/reports', { targetType: 'conversation', link: `/messages/${convo}`, reason: 'scam_or_fraud', details: 'Asked for a Zelle deposit before meeting.' });
    const { client } = await adminClient(app);
    const report = (await client.get('/api/admin/reports')).json().items[0];
    const detail = (await client.get(`/api/admin/reports/${report.id}`)).json().report;
    expect(detail.messages.length).toBeGreaterThan(0);
    expect(detail.targetUserId).toBe(seller.userId);
    await client.post(`/api/admin/reports/${report.id}/resolve`, { status: 'resolved', note: 'Confirmed scam attempt.', action: 'suspend_user' });
    expect((await seller.client.get('/api/auth/me')).json().user).toBeNull();
    expect((await new Client(app).get(`/api/listings/${listingId}`)).statusCode).toBe(404); // paused
    const audit = (await client.get('/api/admin/audit')).json().items.map((a: { action: string }) => a.action);
    expect(audit).toEqual(expect.arrayContaining(['report.resolved', 'report.viewed_conversation']));
  });

  it('suspends and reinstates members, but never staff', async () => {
    const member = await signUp(app, { fullName: 'Robin Member' });
    const admin = await adminClient(app);
    const found = (await admin.client.get('/api/admin/users?q=robin')).json().items;
    expect(found).toHaveLength(1);
    await admin.client.post(`/api/admin/users/${member.userId}/suspend`, { note: 'Spam' });
    expect((await member.client.get('/api/auth/me')).json().user).toBeNull();
    await admin.client.post(`/api/admin/users/${member.userId}/reinstate`, { note: 'Appeal accepted' });
    expect((await testDb.selectFrom('users').select('status').where('id', '=', member.userId).executeTakeFirstOrThrow()).status).toBe('active');
    expect((await admin.client.post(`/api/admin/users/${admin.userId}/suspend`, { note: 'Oops' })).statusCode).toBe(403);
  });
});
