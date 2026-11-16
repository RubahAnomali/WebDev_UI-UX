# Deploying Pawhaven (Render + Postmark)

Pawhaven runs as **one Node web service**, which serves the API and the built site, plus a **managed PostgreSQL** database. The repository includes a Render Blueprint (`render.yaml`) that creates both. Email is sent through **Postmark** over SMTP.

You need to do the account steps below yourself. Everything else, including migrations and HTTPS, is automatic.

---

## 1. Postmark (email)

1. Create a Postmark account. Then create a **Server** (for example "Pawhaven") with a **Transactional** message stream.
2. Under **Sender Signatures → Domains**, add the domain you'll send from (for example `pawhaven.org`).
   - Add the **DKIM** and **Return-Path** DNS records Postmark shows you at your DNS provider.
   - Wait until both show as verified.
3. Open the Server → **API Tokens** and copy the **Server API token**.
4. Build your SMTP URL from it. The token is both the username and the password:
   ```
   smtp://<server-token>:<server-token>@smtp.postmarkapp.com:587
   ```
5. Decide your sender, for example `Pawhaven <hello@pawhaven.org>`. It must be on the verified domain.

> New Postmark accounts start in test mode and can only email addresses on your own domain. Request account approval before you launch.

## 2. Render (app + database)

1. Push this repository to GitHub. Then, in the Render dashboard, choose **New → Blueprint** and select the repository.
2. Render reads `render.yaml` and proposes:
   - **pawhaven**: the web service, on the Starter plan, with a 5 GB disk at `/var/data` for photos.
   - **pawhaven-db**: PostgreSQL 16.
3. When asked for the secret values, enter:
   - `SMTP_URL`: the URL from step 1.4.
   - `MAIL_FROM`: the sender from step 1.5.
4. Click **Apply**. The first build takes a few minutes. When the service is live, open `https://<service>.onrender.com/api/health`. It should show `{"ok":true,...}`.

**What happens automatically:**
- Database migrations run every time the server starts.
- HTTPS certificates are managed by Render, and cookies are `Secure`.
- `APP_ORIGIN`, which is used in email links and the CSRF origin check, defaults to the Render URL.
- The health check at `/api/health` also confirms the database is reachable, so Render restarts the service if the database goes away.

**Safety checks:** the server refuses to start in production, and logs the reason, when:
- `SMTP_URL` is missing. Emails would otherwise silently go nowhere. For a private staging site only, you can set `ALLOW_DEV_MAILBOX=true`.
- `MAIL_FROM` still uses the placeholder `.local` address.
- `APP_ORIGIN` isn't a public `https://` address.

## 3. Create the first administrator

Admins can never be created through public registration. In the Render dashboard, open **pawhaven → Shell** and run:

```bash
npm run admin:create -- --email you@pawhaven.org --name "Your Name"
```

The command emails a one-time link (and prints it in the shell) so the admin sets their own password. Further admins are created the same way.

## 4. Custom domain (optional)

1. In **pawhaven → Settings → Custom Domains**, add `pawhaven.org` (and `www` if you want it). Then create the DNS records Render shows you.
2. After the domain verifies, go to **Environment** and set `APP_ORIGIN=https://pawhaven.org` so that email links and origin checks use it. Saving redeploys the service.

## 5. Sample pets

`npm run db:seed` adds the six sample pets from the design. They are clearly labelled as samples, not real animals. **Don't run it on the production site.** It's meant for demos and staging.

## 6. Before you open the doors

- [ ] Postmark domain verified and the account approved for sending.
- [ ] Register a test account and receive the verification email.
- [ ] Reset your password from the login page and receive that email too.
- [ ] Post a test listing, approve it from **Moderation workspace**, then mark it rehomed and remove it.
- [ ] Have a lawyer review the Terms and Privacy pages. They are drafts.
- [ ] Turn on **Render → pawhaven-db → Backups** (point-in-time recovery is available on paid plans). Photos live on the service disk, so also take periodic disk snapshots, or move photos to object storage later (`PhotoStorage` in `server/src/lib/photos.ts` is the place to do this).
- [ ] Optional: set up an uptime monitor on `/api/health`.

## Environment variables (reference)

| Variable | Set by | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Blueprint | Render's internal connection string |
| `NODE_ENV` | Blueprint | `production` |
| `UPLOAD_DIR` | Blueprint | `/var/data/uploads` (on the persistent disk) |
| `COOKIE_SECURE` | Blueprint | `true` |
| `SMTP_URL` | You | Postmark SMTP URL |
| `MAIL_FROM` | You | Sender on your verified domain |
| `APP_ORIGIN` | Optional | Defaults to Render's URL; set it when you add a custom domain |
| `PGSSLMODE` | Optional | `require` when connecting over an external database URL |
| `RATE_LIMIT` / `AUTH_RATE_LIMIT` | Optional | Defaults to 300/min and 10 per 15 min per IP |
| `ALLOW_DEV_MAILBOX` | Optional | `true` lets a staging site run without real email |
