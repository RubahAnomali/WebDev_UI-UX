import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import { existsSync, mkdirSync } from 'node:fs';
import { MAX_PHOTO_BYTES } from '../../shared/constants.ts';
import { sessionPlugin } from './auth/session.ts';
import { config } from './config.ts';
import type { DB } from './db/database.ts';
import { ApiError } from './lib/errors.ts';
import { createMailer, type Mailer } from './lib/mailer.ts';
import { authRoutes } from './routes/auth.ts';
import { listingRoutes } from './routes/listings.ts';
import { meRoutes } from './routes/me.ts';
import { myListingRoutes } from './routes/myListings.ts';
import { requestRoutes } from './routes/requests.ts';
import { systemRoutes } from './routes/system.ts';

export interface AppDeps {
  db: DB;
  mailer?: Mailer;
  logger?: boolean;
}

export async function buildApp({ db, mailer = createMailer(db), logger = !config.isTest }: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({
    logger: logger ? { level: config.isProd ? 'info' : 'warn' } : false,
    trustProxy: config.isProd,
    bodyLimit: 1024 * 1024,
  });

  await app.register(cookie);
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        fontSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  });
  await app.register(rateLimit, {
    global: true,
    max: config.isTest ? 10_000 : config.globalRateLimit,
    timeWindow: '1 minute',
    errorResponseBuilder: (_req, ctx) =>
      new ApiError('RATE_LIMITED', 'Too many attempts. Please wait a moment and try again.', {
        retryAfter: Math.ceil(ctx.ttl / 1000),
      }),
  });
  await app.register(multipart, { limits: { fileSize: MAX_PHOTO_BYTES, files: 8, fields: 10 } });
  await app.register(sessionPlugin, { db });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ApiError) {
      if (err.retryAfter) reply.header('Retry-After', String(err.retryAfter));
      return reply.status(err.status).send({
        error: { code: err.code, message: err.message, fields: err.fields, retryAfter: err.retryAfter },
      });
    }
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    if (status === 413 || (err as { code?: string }).code === 'FST_REQ_FILE_TOO_LARGE') {
      return reply.status(413).send({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'That file is too large (max 8 MB).' } });
    }
    if (status >= 400 && status < 500) {
      return reply.status(status).send({ error: { code: 'VALIDATION', message: 'The request was not valid.' } });
    }
    req.log.error(err);
    return reply.status(500).send({ error: { code: 'INTERNAL', message: 'Something went wrong on our side. Please try again.' } });
  });

  const deps = { db, mailer };
  systemRoutes(app, deps);
  authRoutes(app, deps);
  meRoutes(app, deps);
  listingRoutes(app, deps);
  myListingRoutes(app, deps);
  requestRoutes(app, deps);

  // Uploaded photos (already re-encoded and EXIF-stripped on upload).
  if (!existsSync(config.uploadDir)) mkdirSync(config.uploadDir, { recursive: true });
  await app.register(fastifyStatic, {
    root: config.uploadDir,
    prefix: '/uploads/',
    decorateReply: false,
    immutable: true,
    maxAge: '365d',
  });

  if (config.serveClient && existsSync(config.clientDist)) {
    await app.register(fastifyStatic, { root: config.clientDist, prefix: '/', decorateReply: true });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api/') || req.url.startsWith('/uploads/')) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Not found.' } });
      }
      return reply.type('text/html').sendFile('index.html');
    });
  } else {
    app.setNotFoundHandler((_req, reply) => reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Not found.' } }));
  }

  return app;
}
