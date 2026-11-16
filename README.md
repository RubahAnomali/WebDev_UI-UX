# Pawhaven

A pet adoption and responsible rehoming platform. People discover pets, connect with shelters and pet parents, send adoption requests, and rehome pets safely. Every listing is reviewed by a person before it goes public.

This repository contains the **web client** (React) and the **API** (Fastify + PostgreSQL), implemented from the Pawhaven Figma file.

## Quick start

Requirements: Node 20+ and PostgreSQL 14+.

```bash
npm install
```

Create the databases (once):

```bash
createuser -P pawhaven            # password: pawhaven (dev only)
createdb -O pawhaven pawhaven
createdb -O pawhaven pawhaven_test
```

Migrate, add the sample pets, and start the web app and API together:

```bash
npm run db:migrate
```

```bash
npm run db:seed
```

```bash
npm run dev
```

- Web: http://localhost:5173. Vite proxies `/api` and `/uploads` to the API.
- API: http://127.0.0.1:8787

In development, **emails aren't sent**. They're stored in a development mailbox. The verify-email and forgot-password screens show an "Open link from email" box so you can finish each flow. Set `SMTP_URL` to send real email.

### Create a staff (admin) account

Admin access can **never** be granted through the website. An operator runs:

```bash
npm run admin:create -- --email staff@example.com --name "Sam Staff"
```

The command prints a one-time link for the new admin to set their password. The **Moderation workspace** then appears in their account menu.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Web (Vite) + API (tsx watch) together |
| `npm run build` | Type-checks client and server, builds the client to `dist/` |
| `npm start` | Production server: API + built client on one port (`NODE_ENV=production`) |
| `npm test` | Vitest: `web` (jsdom) and `server` (Postgres) projects |
| `npm run lint` | ESLint |
| `npm run db:migrate` / `db:seed` | Apply migrations / replace the sample listings |
| `npm run admin:create` | Create or promote a staff account |

## Configuration (environment variables)

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `postgres://pawhaven:pawhaven@localhost:5432/pawhaven` | PostgreSQL connection |
| `APP_ORIGIN` | `http://localhost:5173` (or Render’s `RENDER_EXTERNAL_URL`) | Public origin used in email links and the CSRF origin check |
| `PORT` / `HOST` | `8787` / `127.0.0.1` (`0.0.0.0` in production) | API listen address |
| `SMTP_URL` | — | Real email delivery, e.g. `smtps://user:pass@smtp.example.com`. When unset, mail goes to the development mailbox. |
| `MAIL_FROM` | `Pawhaven <hello@pawhaven.local>` | Sender address |
| `UPLOAD_DIR` | `server/uploads/` | Where processed photos are stored |
| `COOKIE_SECURE` | `true` in production | Secure cookies (requires HTTPS) |
| `RATE_LIMIT` / `AUTH_RATE_LIMIT` | `300`/min, `10`/15 min | Global and sign-in/email request limits per IP |
| `PGSSLMODE` | — | `require` to connect to Postgres over TLS |
| `ALLOW_DEV_MAILBOX` | `false` | Production refuses to start without `SMTP_URL` unless this is `true` (staging only) |

## Architecture

```
src/                 React 19 + TypeScript client (Vite, React Router, CSS Modules)
  components/        UI kit (Button, fields, Select, Dialog, Stepper, PetCard…) and layouts
  features/          Pages by area: home, auth, pets, listings, requests, messages,
                     account, info, admin
  services/          Typed API clients (fetch + CSRF), auth context, saved pets
server/src/          Fastify 5 API
  routes/            auth, listings, my listings, requests, messages, account,
                     reports, admin
  auth/              Sessions, CSRF, authorization policies, single-use tokens
  db/                Kysely schema, migrations, sample seed
  lib/               Mailer, photo processing (sharp), audit log, validation
shared/              Zod schemas, constants and types used by both sides
server/test/         API tests (Fastify inject against pawhaven_test)
```

### Roles and permissions

| Role | How it's granted | Can |
| --- | --- | --- |
| **Member** | Everyone, at sign-up | Browse, save pets, send adoption requests, message, report |
| **Seller** (internal name; the UI just says "Post a pet") | Automatically, when a verified individual accepts the listing rules, or when staff verify a shelter / rescue | Create and manage listings, review adoption requests |
| **Admin** | CLI only | Moderation workspace: review listings, reports, organizations, members, audit trail |

Authorization is enforced **on the server for every request**. The client's route guards only shape the interface. Other people's listings, requests and conversations return `404`, so their existence can't be probed.

### Security and trust measures

**Accounts and sessions**
- Passwords are hashed with scrypt.
- Sessions use httpOnly, SameSite=Lax cookies; only a SHA-256 hash of the session id is stored.
- "Remember me" keeps you signed in for 30 days; otherwise the session ends when you close the browser.
- Mutations are protected by a double-submit CSRF token plus an Origin check.

**Account privacy**
- Verify and reset links are single-use, expire, and are stored hashed.
- Login errors are the same for an unknown email and a wrong password, and reset requests always get the same answer, so they can't be used to discover accounts.
- Changing a password signs out other devices. Changing an email requires confirming the new address.
- Rate limits apply per IP, with stricter limits on sign-in and email endpoints.

**Listings and photos**
- Uploaded photos are decoded and re-encoded to WebP, which removes EXIF/GPS data.
- Phone numbers, emails, links and payment handles are blocked in public listing text.
- Fees are capped and always labelled.
- Individuals can have at most 3 active listings. Shelters must be verified before they can submit.
- Shelters must give a registration or charity number, plus a website or a reference, before staff can verify them.

**Messages**
- Messages show safety banners and warn about scam phrases like deposits or gift cards.
- Members can block each other.
- Message content is never included in notification emails or in-app notifications.

**Notifications**
- The header bell shows recent updates about requests, decisions, messages, moderation and shelter verification.
- Message notifications are grouped into one per conversation and are marked read when the conversation is opened.

**Moderation**
- Listings go live only after review against a checklist.
- Every moderation action is written to the audit trail. Staff reading a reported conversation is logged too.

**Headers**
- Strict Content-Security-Policy, `frame-ancestors 'none'`, and nosniff headers (via helmet).

### Data you can take with you

From **Account & privacy**, members can export their data as JSON or delete their account. Deletion anonymizes the profile, removes listings, withdraws open requests and ends all sessions.

## Testing

```bash
npm test
```

- **`server` project:** API tests against the `pawhaven_test` database. They cover:
  - the auth and CSRF flows
  - the member / seller / admin / owner permission matrix
  - listing and request state machines
  - photo EXIF stripping
  - blocking, notifications and moderation
- **`web` project:** component and page tests (Testing Library + jsdom).

Browser end-to-end checks (Playwright) were run against the production build for every page and journey, at 1440 / 1024 / 768 / 375px.

## Sample data

`npm run db:seed` adds the six pets from the Figma design (Luna, Milo, Willow, Teddy, Poppy, Nala) and two shelters. Every sample row is flagged `is_sample`, and the UI labels these as **sample listings, not real pets available for adoption**. Re-running the seed replaces them.

## Design

The implementation follows the Pawhaven Figma file: Inter for the interface, Lora for headings, and the green, cream and soft-green palette defined in `src/styles/tokens.css`. The original SVG artwork was exported from Figma into `src/assets/figma/`.

Design decisions made with the product owner:
- **Photos:** real pet photos are supported, with the paw artwork as the fallback.
- **Signed-in navigation:** adapted from the 12:xx frames.
- **Fees:** labelled as "Adoption fee" or "Rehoming fee".
- **Terminology:** "adoption request" is used throughout.

See `docs/PRODUCT_PLAN.md` for the product evaluation and roadmap.

## Deployment

The repository includes a Render Blueprint (`render.yaml`). It sets up one web service and a managed Postgres database, and email goes through Postmark. **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** has the step-by-step checklist.

## Before launch

- **Legal review:** Terms and Privacy are drafts and must be reviewed by qualified counsel.
- **Production infrastructure:**
  - Configure `SMTP_URL`. Production refuses to start without it. See `docs/DEPLOYMENT.md`.
  - Move photo storage to object storage. `PhotoStorage` in `server/src/lib/photos.ts` is the adapter seam for this.
  - Run behind HTTPS with `COOKIE_SECURE=true`.
- **Geocoding:** distance search currently uses coordinates from existing listings in the same city, or the visitor's rounded browser location. A geocoding service would improve accuracy.
