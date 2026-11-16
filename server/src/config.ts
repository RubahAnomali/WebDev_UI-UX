const env = process.env;

export const config = {
  env: env.NODE_ENV ?? 'development',
  isProd: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  isDev: (env.NODE_ENV ?? 'development') === 'development',
  port: Number(env.PORT ?? 8787),
  // Hosting platforms (Render, containers) route traffic to 0.0.0.0.
  host: env.HOST ?? (env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1'),
  databaseUrl: env.DATABASE_URL ?? 'postgres://pawhaven:pawhaven@localhost:5432/pawhaven',
  /** TLS to Postgres: on when PGSSLMODE=require or the URL says sslmode=require (e.g. external Render URLs). */
  databaseSsl: env.PGSSLMODE === 'require' || /[?&]sslmode=require/.test(env.DATABASE_URL ?? ''),
  /** Public origin used in email links and Origin checks. */
  appOrigin: (env.APP_ORIGIN ?? env.RENDER_EXTERNAL_URL ?? 'http://localhost:5173').replace(/\/$/, ''),
  // Local dev servers are only trusted outside production.
  extraOrigins: (env.EXTRA_ORIGINS ?? (env.NODE_ENV === 'production' ? '' : 'http://localhost:4173,http://127.0.0.1:5173,http://127.0.0.1:4173,http://localhost:8787'))
    .split(',')
    .filter(Boolean),
  uploadDir: env.UPLOAD_DIR ?? new URL('../uploads/', import.meta.url).pathname,
  smtpUrl: env.SMTP_URL,
  /** Staging escape hatch: allow production without real email (mail goes to the dev_outbox table). */
  allowDevMailbox: env.ALLOW_DEV_MAILBOX === 'true',
  mailFrom: env.MAIL_FROM ?? 'Pawhaven <hello@pawhaven.local>',
  cookieSecure: env.COOKIE_SECURE ? env.COOKIE_SECURE === 'true' : env.NODE_ENV === 'production',
  /** Serve the built web client (single-process deploy / e2e). */
  /** Max credential/email requests per IP per 15 minutes. */
  authRateLimit: Number(env.AUTH_RATE_LIMIT ?? 10),
  /** Max API requests per IP per minute. */
  globalRateLimit: Number(env.RATE_LIMIT ?? 300),
  serveClient: env.SERVE_CLIENT === 'true' || env.NODE_ENV === 'production',
  clientDist: env.CLIENT_DIST ?? new URL('../../dist/', import.meta.url).pathname,
};

export const allowedOrigins = new Set([config.appOrigin, ...config.extraOrigins]);

/** Problems that make a production deploy unsafe. Returned (not thrown) so it can be tested. */
export function productionConfigProblems(c: typeof config = config): string[] {
  if (!c.isProd) return [];
  const problems: string[] = [];
  if (!c.smtpUrl && !c.allowDevMailbox) {
    problems.push('SMTP_URL is not set, so verification and password emails would never be delivered. Set SMTP_URL (or ALLOW_DEV_MAILBOX=true for a staging site).');
  }
  if (c.smtpUrl && /\.local>?$/.test(c.mailFrom)) problems.push('MAIL_FROM must be an address on your verified sending domain.');
  if (/^http:\/\/(localhost|127\.0\.0\.1)/.test(c.appOrigin)) problems.push('APP_ORIGIN must be the public https:// address of the site.');
  if (c.cookieSecure && !c.appOrigin.startsWith('https://')) problems.push('APP_ORIGIN must use https:// when COOKIE_SECURE is on.');
  return problems;
}
