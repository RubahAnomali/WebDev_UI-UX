import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client, latestEmail, makeApp, ORG_EVIDENCE, PASSWORD, signUp, tokenFrom } from './helpers.ts';
import { testDb } from './setup.ts';

let app: FastifyInstance;
beforeAll(async () => {
  app = await makeApp();
});
afterAll(async () => {
  await app.close();
});

const registration = {
  fullName: 'Alex Morgan',
  email: 'Alex@Example.com',
  password: PASSWORD,
  location: 'Austin, TX',
  accountType: 'individual',
  acceptedTerms: true,
};

describe('CSRF and origin protection', () => {
  it('rejects mutations without the CSRF header', async () => {
    const c = new Client(app);
    const res = await c.request({ method: 'POST', url: '/api/auth/login', payload: {}, csrf: false });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('CSRF');
  });

  it('rejects foreign origins', async () => {
    const c = new Client(app);
    await c.get('/api/auth/csrf');
    const res = await c.request({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'a@b.co', password: 'x' },
      headers: { origin: 'https://evil.example' },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('registration', () => {
  it('validates input with field errors', async () => {
    const c = new Client(app);
    const res = await c.post('/api/auth/register', { ...registration, password: 'weak', acceptedTerms: false });
    expect(res.statusCode).toBe(400);
    expect(Object.keys(res.json().error.fields)).toEqual(expect.arrayContaining(['password', 'acceptedTerms']));
  });

  it('creates a member-only, unverified account and sends a verification email', async () => {
    const c = new Client(app);
    const res = await c.post('/api/auth/register', { ...registration, roles: ['admin'] });
    expect(res.statusCode).toBe(200);
    const user = await testDb.selectFrom('users').selectAll().where('email', '=', 'alex@example.com').executeTakeFirstOrThrow();
    expect(user.roles).toEqual(['member']);
    expect(user.email_verified_at).toBeNull();
    expect(user.password_hash).toMatch(/^scrypt\$/);
    expect(await latestEmail('alex@example.com', 'verify')).toBeTruthy();
  });

  it('creates a pending organization for shelters', async () => {
    const c = new Client(app);
    const missing = await c.post('/api/auth/register', { ...registration, accountType: 'organization', organizationName: 'Happy Tails' });
    expect(missing.statusCode).toBe(400);
    expect(Object.keys(missing.json().error.fields)).toEqual(expect.arrayContaining(['registrationNumber', 'website']));
    await c.post('/api/auth/register', { ...registration, accountType: 'organization', ...ORG_EVIDENCE });
    const user = await testDb.selectFrom('users').selectAll().where('email', '=', 'alex@example.com').executeTakeFirstOrThrow();
    const org = await testDb.selectFrom('organizations').selectAll().where('id', '=', user.organization_id!).executeTakeFirstOrThrow();
    expect(org.verification_status).toBe('pending');
    expect(org.registration_number).toBe('TX-501C3-12345');
    expect(org.website).toBe('https://happytails.example.org');
    expect(user.roles).toEqual(['member']);
  });

  it('does not reveal an existing account', async () => {
    const c = new Client(app);
    await c.post('/api/auth/register', registration);
    const again = await c.post('/api/auth/register', registration);
    expect(again.statusCode).toBe(200);
    expect(again.json()).toEqual({ email: 'alex@example.com' });
    expect((await latestEmail('alex@example.com'))?.subject).toMatch(/someone tried/i);
  });
});

describe('login and sessions', () => {
  it('requires a verified email and then logs in', async () => {
    const c = new Client(app);
    await c.post('/api/auth/register', registration);
    const unverified = await c.post('/api/auth/login', { email: 'alex@example.com', password: PASSWORD });
    expect(unverified.json().error.code).toBe('EMAIL_NOT_VERIFIED');

    const mail = await latestEmail('alex@example.com', 'verify');
    const verified = await c.post('/api/auth/verify-email', { token: tokenFrom(mail?.link) });
    expect(verified.json().user.emailVerified).toBe(true);
    const reuse = await c.post('/api/auth/verify-email', { token: tokenFrom(mail?.link) });
    expect(reuse.json().error.code).toBe('TOKEN_INVALID');

    const ok = await c.post('/api/auth/login', { email: 'ALEX@example.com', password: PASSWORD, remember: true });
    expect(ok.statusCode).toBe(200);
    const sessionCookie = ok.cookies.find((ck) => ck.name === 'ph_session');
    expect(sessionCookie?.httpOnly).toBe(true);
    expect(sessionCookie?.sameSite).toBe('Lax');
    expect(sessionCookie?.maxAge).toBeGreaterThan(0);
    expect((await c.get('/api/auth/me')).json().user.email).toBe('alex@example.com');

    await c.post('/api/auth/logout');
    expect((await c.get('/api/auth/me')).json().user).toBeNull();
  });

  it('stores only a hash of the session id', async () => {
    const { client } = await signUp(app);
    const row = await testDb.selectFrom('sessions').selectAll().executeTakeFirstOrThrow();
    expect(row.id_hash).toHaveLength(64);
    expect(client.hasCookie('ph_session')).toBe(true);
  });

  it('returns the same error for unknown email and wrong password', async () => {
    const { email } = await signUp(app);
    const c = new Client(app);
    const a = await c.post('/api/auth/login', { email: 'ghost@example.com', password: PASSWORD });
    const b = await c.post('/api/auth/login', { email, password: 'Wrong-password-1!' });
    expect(a.statusCode).toBe(401);
    expect(a.json()).toEqual(b.json());
  });

  it('blocks suspended accounts and their sessions', async () => {
    const { client, userId, email } = await signUp(app);
    await testDb.updateTable('users').set({ status: 'suspended' }).where('id', '=', userId).execute();
    expect((await client.get('/api/auth/me')).json().user).toBeNull();
    const res = await new Client(app).post('/api/auth/login', { email, password: PASSWORD });
    expect(res.json().error.code).toBe('ACCOUNT_SUSPENDED');
  });
});

describe('verification resend', () => {
  it('enforces a 60 second cooldown', async () => {
    const c = new Client(app);
    await c.post('/api/auth/register', { ...registration, email: 'cool@example.com' });
    const res = await c.post('/api/auth/resend-verification', { email: 'cool@example.com' });
    expect(res.statusCode).toBe(429);
    expect(res.json().error.retryAfter).toBeGreaterThan(50);
  });
});

describe('password reset', () => {
  it('is neutral for unknown emails', async () => {
    const res = await new Client(app).post('/api/auth/forgot-password', { email: 'ghost@example.com' });
    expect(res.json()).toEqual({ ok: true });
    expect(await latestEmail('ghost@example.com')).toBeUndefined();
  });

  it('resets with a single-use token and signs out everywhere', async () => {
    const { client, email } = await signUp(app);
    const anon = new Client(app);
    await anon.post('/api/auth/forgot-password', { email });
    const token = tokenFrom((await latestEmail(email, 'reset'))?.link);
    expect((await anon.post('/api/auth/reset-password/check', { token })).statusCode).toBe(200);
    expect((await anon.post('/api/auth/reset-password', { token, password: 'weak' })).statusCode).toBe(400);
    expect((await anon.post('/api/auth/reset-password', { token, password: 'Fresh-start-2026!' })).statusCode).toBe(200);
    expect((await anon.post('/api/auth/reset-password', { token, password: 'Fresh-start-2027!' })).json().error.code).toBe(
      'TOKEN_INVALID',
    );
    expect((await client.get('/api/auth/me')).json().user).toBeNull();
    expect((await anon.post('/api/auth/login', { email, password: 'Fresh-start-2026!' })).statusCode).toBe(200);
  });

  it('expires reset tokens', async () => {
    const { email } = await signUp(app);
    const anon = new Client(app);
    await anon.post('/api/auth/forgot-password', { email });
    const token = tokenFrom((await latestEmail(email, 'reset'))?.link);
    await testDb.updateTable('auth_tokens').set({ expires_at: new Date(Date.now() - 1000) }).where('type', '=', 'reset').execute();
    expect((await anon.post('/api/auth/reset-password/check', { token })).json().error.code).toBe('TOKEN_EXPIRED');
  });
});
