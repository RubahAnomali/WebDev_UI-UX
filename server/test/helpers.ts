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
