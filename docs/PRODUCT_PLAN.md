# Pawhaven — Product status and roadmap

_Updated after Phase 2 (full MVP). It separates **what is built**, **what I recommend next**, and **what needs a decision from you**._

---

## 1. Status at a glance

| Area | Figma | Status |
| --- | --- | --- |
| Homepage | 6:2 | ✅ Live data from the API; labelled fees |
| Auth: log in, register, verify, forgot, reset | 14:27–14:35 | ✅ Real server auth, plus change email and delete account |
| Find a pet | 14:37 | ✅ Filters, distance, sort, load more, empty state |
| Pet profile | 14:39 | ✅ Gallery, health table, verified lister, report link |
| Saved pets | 14:41 | ✅ |
| Send adoption request / request sent | 12:34 / 12:38 | ✅ Device-only drafts |
| Adoption request status | 14:45 | ✅ Timeline, withdraw |
| Post a pet (4 steps) / submitted | 14:47–14:55 | ✅ Drafts, real photos, attestations |
| My listings | 14:57 | ✅ Pause, resume, rehomed, remove |
| Review adoption requests | 14:59 | ✅ Invite, approve, decline, with notes |
| Messages | 14:61 | ✅ Read receipts, block, report, scam warnings |
| Account & privacy | 14:63 | ✅ Profile, notifications, password, email, export, delete |
| Safety & support | 14:65 | ✅ Working report form |
| Moderation workspace | 14:67 | ✅ Plus reports, organizations, members and audit trail |
| Essential states | 22 | ✅ Used throughout (empty, error, confirmation, session expired) |
| Our mission, rehoming guide, resources, contact, terms, privacy, accessibility | — | ✅ Terms and Privacy marked as drafts for legal review |

**Design decisions you approved** (applied everywhere):
- Real photos, with the paw artwork as the fallback.
- The signed-in nav adapted from the 12:xx frames.
- Labelled fees ("Adoption fee" / "Rehoming fee").
- "Adoption request" as the single term.

**Small design additions I made inside the existing visual system** (not in Figma):
- An organization-name field for shelters at sign-up.
- A "My adoption requests" list.
- A photo uploader with a tint picker for the paw artwork.
- The admin Reports, Organizations, Members and Audit pages.
- Confirmation dialogs for pause, rehome, remove, block and decline.
- A gentle scam-phrase warning in Messages.

---

## 2. How each role experiences Pawhaven now

- **Visitor:** Browse → Find a pet → Profile. Saving, messaging or requesting asks them to log in or sign up, then returns them to the same pet.
- **Member (adopter):** Profile → Send adoption request → Request sent → Track the timeline ↔ Messages → Meet & greet → Approved.
- **Pet parent (individual seller):** Post a pet → Submitted → reviewed by staff → Live → Review adoption requests → Invite to meet → Approve → Mark as rehomed. The seller capability is granted automatically when they accept the listing rules. They can have up to 3 active listings.
- **Shelter / rescue:** Sign up as a shelter → prepare drafts → staff verify the organization (which grants the seller capability and a "Verified" badge) → submit listings.
- **Staff:** created with the CLI → Moderation workspace: review queue with a checklist, reports with enforcement, organization verification, member suspension, and the audit trail.

---

## 3. Recommended next steps

### Priority 1 — before a public launch
| Item | Why |
| --- | --- |
| Legal review of Terms and Privacy; add a cookie notice if required in your region | Required before collecting real user data |
| Production hosting: ✅ prepared for Render + Postmark (`render.yaml`, `docs/DEPLOYMENT.md`). Still to do: enable database backups and, later, move photos to object storage (S3/R2) | Photos currently live on the service’s persistent disk |
| A geocoding service for city/ZIP lookup | Distance search currently relies on coordinates from existing listings or browser location |
| Monitoring and error tracking (e.g. Sentry) plus uptime alerts | Lets you see problems before users report them |
| Two-factor authentication for staff accounts | Admins can suspend users and read reported conversations |

### Priority 2 — important improvements
| Item | Why |
| --- | --- |
| Real-time messages (WebSockets/SSE) instead of 10-second polling | Snappier conversations, less server load |
| Organization profile pages (public shelter pages listing all their pets) | Builds trust and helps shelters |
| Image moderation and duplicate-photo detection | Catches stolen photos, a common scam signal |
| Admin dashboard metrics: time to review, report trends | Shows whether moderation keeps up |

### Priority 3 — future enhancements
- Saved searches and alerts ("new cats near me").
- A map view.
- Multiple staff per organization.
- Adoption follow-ups and success stories.
- A CMS for guides.
- Social sign-in.
- Member two-factor authentication.
- Localization.

### Intentionally not planned
- **On-platform payments or deposits:** they remove trust and add a major scam vector.
- **Pet shipping, and wildlife or exotic animal categories:** both conflict with the welfare rules.

---

## 4. Backend overview

- **API:** Fastify 5 + TypeScript, Zod validation shared with the client, and Kysely + PostgreSQL with migrations.
- **Data:** users, organizations, sessions, auth tokens, listings, listing photos, favorites, adoption requests and request events, conversations, participants, messages, blocks, reports, moderation actions, audit log, notification preferences.
- **Security:**
  - scrypt passwords and hashed session ids in httpOnly cookies
  - CSRF double-submit plus an Origin check
  - per-route rate limits
  - single-use hashed tokens
  - server-side policies on every route, with 404s for anything you don't own
  - EXIF stripping on photos
  - contact details blocked in public text
  - a full audit trail

---

## 5. Decisions (resolved)

1. **Hosting:** Render for the app and database, Postmark for email. See `docs/DEPLOYMENT.md`.
2. **Fee cap:** kept at $750.
3. **Active-listing limit for individuals:** kept at 3.
4. **Shelter verification evidence:** shelters must give a registration or charity number, plus a website/social page or a reference. Staff can't verify a shelter until this is provided.
5. **Notification centre:** ✅ built. The header has a bell with an unread badge. Notifications cover new requests, request decisions, messages (one per conversation, never including message text), listing moderation, shelter verification and rehoming. On mobile there's a `/notifications` page.
