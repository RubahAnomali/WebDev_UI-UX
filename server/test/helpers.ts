import type { FastifyInstance, InjectOptions } from 'fastify';
import { buildApp } from '../src/app.ts';
import { testDb } from './setup.ts';

export async function makeApp() {
  return buildApp({ db: testDb, logger: false });
}

/** A tiny browser-like client: keeps cookies and sends the CSRF header. */
export class Client {
  private cookies = new Map<string, string>();
  private app: FastifyInstance;
  constructor(app: FastifyInstance) {
    this.app = app;
  }

  private cookieHeader() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  async request(opts: InjectOptions & { csrf?: boolean }) {
    const method = (opts.method ?? 'GET').toUpperCase();
    if (method !== 'GET' && opts.csrf !== false && !this.cookies.has('ph_csrf')) {
      await this.request({ method: 'GET', url: '/api/auth/csrf' });
    }
    const headers: Record<string, string> = { ...(opts.headers as Record<string, string>) };
    if (this.cookies.size) headers.cookie = this.cookieHeader();
    if (method !== 'GET' && opts.csrf !== false) headers['x-csrf-token'] = this.cookies.get('ph_csrf') ?? '';
    const res = await this.app.inject({ ...opts, headers });
    for (const c of res.cookies) {
      if (c.value === '' || (c.expires && new Date(c.expires).getTime() < Date.now())) this.cookies.delete(c.name);
      else this.cookies.set(c.name, c.value);
    }
    return res;
  }

  get = (url: string) => this.request({ method: 'GET', url });
  post = (url: string, payload?: unknown) => this.request({ method: 'POST', url, payload: payload as object });
  patch = (url: string, payload?: unknown) => this.request({ method: 'PATCH', url, payload: payload as object });
  put = (url: string, payload?: unknown) => this.request({ method: 'PUT', url, payload: payload as object });
  del = (url: string) => this.request({ method: 'DELETE', url });
  hasCookie = (name: string) => this.cookies.has(name);
}

export async function latestEmail(to: string, subjectIncludes?: string) {
  let q = testDb.selectFrom('dev_outbox').selectAll().where('to_email', '=', to).orderBy('created_at', 'desc');
  if (subjectIncludes) q = q.where('subject', 'ilike', `%${subjectIncludes}%`);
  return q.executeTakeFirst();
}

export const tokenFrom = (link: string | null | undefined) => new URL(link!).searchParams.get('token')!;

export const PASSWORD = 'Sunny-window-42';

/** Registers + verifies + logs in a user, returning the client. */
export async function signUp(
  app: FastifyInstance,
  opts: { email?: string; accountType?: 'individual' | 'organization'; fullName?: string } = {},
) {
  const c = new Client(app);
  const email = opts.email ?? `user${Math.random().toString(36).slice(2, 8)}@example.com`;
  await c.post('/api/auth/register', {
    fullName: opts.fullName ?? 'Alex Morgan',
    email,
    password: PASSWORD,
    location: 'Austin, TX',
    accountType: opts.accountType ?? 'individual',
    acceptedTerms: true,
  });
  const mail = await latestEmail(email, 'verify');
  await c.post('/api/auth/verify-email', { token: tokenFrom(mail?.link) });
  const res = await c.post('/api/auth/login', { email, password: PASSWORD, remember: false });
  if (res.statusCode !== 200) throw new Error(`login failed: ${res.body}`);
  const user = res.json().user as { id: string };
  return { client: c, email, userId: user.id };
}

export async function grantRole(userId: string, role: 'seller' | 'admin') {
  const row = await testDb.selectFrom('users').select('roles').where('id', '=', userId).executeTakeFirstOrThrow();
  await testDb
    .updateTable('users')
    .set({ roles: Array.from(new Set([...row.roles, role])) })
    .where('id', '=', userId)
    .execute();
}

/** A complete, valid listing payload (all three wizard steps). */
export const COMPLETE_LISTING = {
  name: 'Finn',
  species: 'cat',
  breed: 'Domestic shorthair',
  sex: 'male',
  ageValue: 1,
  ageUnit: 'years',
  size: 'small',
  listingType: 'rehoming',
  fee: 50,
  city: 'Austin, TX 78704',
  vaccinated: 'yes',
  spayedNeutered: 'yes',
  microchipped: 'yes',
  houseTrained: 'yes',
  goodWith: ['adults', 'cats'],
  energyLevel: 'moderate',
  medicalNotes: 'No known medical conditions.',
  behaviorNotes: 'Enjoys gentle play and quiet spaces.',
  about: 'Finn is a curious, affectionate cat who loves sunny windows and gentle play every evening.',
  idealHome: 'A calm indoor home with time for play.',
  rehomingReason: 'My housing circumstances have changed.',
  traits: ['Curious', 'Gentle'],
};

export const ATTEST = { attestations: { owner: true, accurate: true, rules: true } };

export async function createListing(client: Client, overrides: Record<string, unknown> = {}) {
  const res = await client.post('/api/my/listings', { ...COMPLETE_LISTING, ...overrides });
  if (res.statusCode !== 200) throw new Error(`create failed: ${res.body}`);
  return res.json().listing as { id: string; status: string };
}

/** Builds a multipart body for a single file upload. */
export function multipart(buffer: Buffer, filename = 'photo.jpg', contentType = 'image/jpeg') {
  const boundary = '----pawhaven' + Math.random().toString(16).slice(2);
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return { payload: Buffer.concat([head, buffer, tail]), headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } };
}

export const REQUEST = {
  fullName: 'Jamie Parker',
  phone: '(512) 555-0142',
  city: 'Austin, TX',
  homeType: 'house',
  housingPermission: 'own',
  household: 'Two adults, no children. We have a secure, fenced yard.',
  otherPets: 'None',
  experience: 'Previously cared for a senior dog.',
  message: 'I’m looking for a gentle companion and can offer a calm home.',
  agreeCare: true,
  agreeShare: true,
};

/** A seller with one live listing. */
export async function liveListingFor(app: FastifyInstance, overrides: Record<string, unknown> = {}) {
  const seller = await signUp(app);
  const { id } = await createListing(seller.client, overrides);
  await seller.client.post(`/api/my/listings/${id}/submit`, ATTEST);
  const { testDb } = await import('./setup.ts');
  await testDb.updateTable('listings').set({ status: 'live', published_at: new Date() }).where('id', '=', id).execute();
  return { seller, listingId: id };
}

/** Creates a signed-in admin (as the CLI would) for tests. */
export async function adminClient(app: FastifyInstance) {
  const ctx = await signUp(app, { fullName: 'Sam Staff' });
  await grantRole(ctx.userId, 'admin');
  return ctx;
}
