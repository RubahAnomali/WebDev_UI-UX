const env = process.env;

export const config = {
  env: env.NODE_ENV ?? 'development',
  isProd: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  isDev: (env.NODE_ENV ?? 'development') === 'development',
  port: Number(env.PORT ?? 8787),
  host: env.HOST ?? '127.0.0.1',
  databaseUrl: env.DATABASE_URL ?? 'postgres://pawhaven:pawhaven@localhost:5432/pawhaven',
  /** Public origin used in email links and Origin checks. */
  appOrigin: env.APP_ORIGIN ?? 'http://localhost:5173',
  extraOrigins: (env.EXTRA_ORIGINS ?? 'http://localhost:4173,http://127.0.0.1:5173,http://127.0.0.1:4173,http://localhost:8787')
    .split(',')
    .filter(Boolean),
  uploadDir: env.UPLOAD_DIR ?? new URL('../uploads/', import.meta.url).pathname,
  smtpUrl: env.SMTP_URL,
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
