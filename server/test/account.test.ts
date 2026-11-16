import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client, createListing, latestEmail, liveListingFor, makeApp, PASSWORD, REQUEST, signUp, tokenFrom } from './helpers.ts';
import { testDb } from './setup.ts';

let app: FastifyInstance;
beforeAll(async () => {
  app = await makeApp();
});
afterAll(async () => {
  await app.close();
});

describe('profile & preferences', () => {
  it('updates profile fields and notification preferences', async () => {
    const { client } = await signUp(app);
    const res = await client.patch('/api/account', { fullName: 'Alex M. Morgan', phone: '(512) 555-0100', prefs: { discovery: true } });
    expect(res.statusCode).toBe(200);
    expect(res.json().user.fullName).toBe('Alex M. Morgan');
    expect(res.json().prefs).toEqual({ messages: true, discovery: true });
    expect((await client.patch('/api/account', { phone: 'call me maybe' })).statusCode).toBe(400);
  });

  it('ignores attempts to change roles or email through the profile', async () => {
    const { client, email } = await signUp(app);
    const res = await client.patch('/api/account', { roles: ['admin'], email: 'x@y.co' });
    expect(res.json().user.roles).toEqual(['member']);
    expect(res.json().user.email).toBe(email);
  });
});

describe('password change', () => {
  it('requires the current password and signs out other devices', async () => {
    const { client, email } = await signUp(app);
    const other = new Client(app);
    await other.post('/api/auth/login', { email, password: PASSWORD });
    expect((await client.post('/api/account/password', { currentPassword: 'wrong', newPassword: 'Fresh-start-2026!' })).statusCode).toBe(400);
    expect((await client.post('/api/account/password', { currentPassword: PASSWORD, newPassword: 'Fresh-start-2026!' })).statusCode).toBe(200);
    expect((await client.get('/api/auth/me')).json().user).not.toBeNull();
    expect((await other.get('/api/auth/me')).json().user).toBeNull();
    expect((await latestEmail(email, 'password was changed'))).toBeTruthy();
  });
});

describe('email change', () => {
  it('verifies the new address before switching', async () => {
    const { client, email } = await signUp(app);
    expect((await client.post('/api/account/email', { newEmail: 'new@example.com', password: PASSWORD })).statusCode).toBe(200);
    expect((await client.get('/api/auth/me')).json().user.email).toBe(email);
    expect((await latestEmail(email, 'change to your'))?.body).toContain('n•••@example.com');
    const token = tokenFrom((await latestEmail('new@example.com', 'confirm'))?.link);
    expect((await new Client(app).post('/api/auth/confirm-email-change', { token })).json().email).toBe('new@example.com');
    expect((await client.get('/api/auth/me')).json().user.email).toBe('new@example.com');
  });

  it('gives a neutral response when the email is taken', async () => {
    const a = await signUp(app);
    const b = await signUp(app);
    expect((await a.client.post('/api/account/email', { newEmail: b.email, password: PASSWORD })).statusCode).toBe(200);
    expect(await latestEmail(b.email, 'confirm')).toBeUndefined();
  });
});

describe('export & delete', () => {
  it('exports the person’s own data', async () => {
    const { client } = await signUp(app);
    await createListing(client);
    const res = await client.get('/api/account/export');
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="pawhaven-data-/);
    expect(res.json().listings).toHaveLength(1);
    expect(res.json().profile).not.toHaveProperty('passwordHash');
  });

  it('requires DELETE and the password, then anonymizes the account', async () => {
    const { seller, listingId } = await liveListingFor(app);
    const adopter = await signUp(app);
    const req = (await adopter.client.post(`/api/listings/${listingId}/requests`, REQUEST)).json().request;

    expect((await adopter.client.request({ method: 'DELETE', url: '/api/account', payload: { password: PASSWORD, confirm: 'delete' } })).statusCode).toBe(400);
    const res = await adopter.client.request({ method: 'DELETE', url: '/api/account', payload: { password: PASSWORD, confirm: 'DELETE' } });
    expect(res.statusCode).toBe(200);
    expect((await adopter.client.get('/api/auth/me')).json().user).toBeNull();
    const row = await testDb.selectFrom('users').selectAll().where('id', '=', adopter.userId).executeTakeFirstOrThrow();
    expect(row.status).toBe('deleted');
    expect(row.email).toMatch(/@pawhaven\.invalid$/);
    const r = await testDb.selectFrom('adoption_requests').select('status').where('id', '=', req.id).executeTakeFirstOrThrow();
    expect(r.status).toBe('withdrawn');
    const convo = (await seller.client.get('/api/conversations')).json().items[0];
    expect(convo.otherName).toBe('Former member');
    expect((await new Client(app).post('/api/auth/login', { email: adopter.email, password: PASSWORD })).statusCode).toBe(401);
  });

  it('removes the person’s listings', async () => {
    const { client, userId } = await signUp(app);
    await createListing(client);
    await client.request({ method: 'DELETE', url: '/api/account', payload: { password: PASSWORD, confirm: 'DELETE' } });
    expect(await testDb.selectFrom('listings').select('id').where('owner_id', '=', userId).execute()).toHaveLength(0);
  });
});
