# Pawhaven — Product evaluation and roadmap

_Phase 1 deliverable. The sections below separate **what is implemented**, **what I recommend**, and **what needs your approval**._

---

## 1. Status at a glance

| | |
| --- | --- |
| ✅ **Implemented** | Homepage (Figma 6:2) and the five auth screens (14:27–14:35), responsive at 375–1440px. Reusable UI kit, an `AuthService` abstraction with a clearly labelled in-browser demo adapter, sample featured pets, honest "coming soon" routes for later pages, a 404 page, 36 unit/component tests, and an 84-check browser run. |
| 💡 **Recommended** | Everything in sections 3–9 below. |
| ⏳ **Needs your approval** | Section 10. This covers the backend stack, the Phase 2 scope, terminology changes, the photo policy, and consolidating the duplicate Figma frames. |

---

## 2. Figma audit

### 2.1 Frames and their state

| Area | Frames | Assessment |
| --- | --- | --- |
| Public | 6:2 Home, 14:37 Find a pet, 14:39 Pet profile, 14:65 / 12:62 Safety & support | Strong, consistent visual language. |
| Auth | 14:27–14:35 | Complete. |
| Member | 14:41 Saved pets, 12:34 Adoption application, 12:38 Application sent, 14:45 Request status, 14:61 / 12:54 Messages, 14:63 / 12:58 Account | Complete for the core adoption loop. |
| Seller | 14:47–14:53 Post a pet (4 steps), 14:55 Submitted, 14:57 / 12:50 My listings, 12:46 Review listing, 14:59 Review requests | Complete for individual rehomers; the organization (shelter) experience is thin. |
| Admin | 14:67 Moderation workspace | Listing review only. Users, reports and audit are missing. |
| States | 14:69 Essential states | Excellent coverage of empty, error and confirmation states. |

### 2.2 Duplicates and inconsistencies to resolve

1. **Two generations of screens.** The 12:xx frames (older; signed-in header "Alex ▾"; nav Find a pet / Saved pets / Messages / My listings) duplicate the 14:xx frames:

   | 12:xx frame | 14:xx frame |
   | --- | --- |
   | 12:50 My listings | 14:57 My listings |
   | 12:54 Messages | 14:61 Messages |
   | 12:58 Account settings | 14:63 Account & privacy |
   | 12:62 Safety & support | 14:65 Safety & support |
   | 12:46 Review listing | 14:53 Post a pet — Review |

   **Recommendation:** keep the 14:xx versions as the source of truth, but keep the **signed-in header from the 12:xx frames**. The 14:xx frames always show "Log in", even on signed-in screens, so that is the only signed-in navigation in the file.
2. **Two numbers clash.** Two different frames are each numbered "10" and two are numbered "12". Renumber them before handoff to avoid ambiguity in tickets.
3. **Same thing, three names.** "Adoption application" (09), "Adoption request" (10, 17) and "inquiries" (My listings 13) all describe one object. Pick one user-facing term; I recommend **"adoption request"**, because the Figma copy says an application "starts a conversation".
4. **Photos contradict the requirements.** The Post-a-pet step 13 says "No real photos are used in this design" and only offers paw artwork, but the requirements say Sellers upload pet photos. Real photos are the single biggest trust and conversion driver for adoption sites. Decision needed (§10).
5. **Fees read like prices.** Pet cards show a bold "$150" with no label. On an adoption platform this reads like a sale price. **Recommendation:** label it "Adoption fee $150" or "Rehoming fee $50". The profile page already uses "Adoption fee"; the cards are inconsistent with it. (In code the fee is already announced to screen readers as "Adoption fee".)
6. **"Seller" is commerce language.** The term conflicts with the brand ("A match, not a transaction"). Keep `seller` as the internal role name, but say "Lister" or "Pet parent / Shelter" in the UI.
7. **Search and Find-a-pet don't match.** The homepage search offers species, location and listing type. Find-a-pet (14:37) adds distance, age and "Good with". This is fine, but the URL parameters already produced by the homepage (`type`, `location`, `listing`, `near`) should be honoured by Find-a-pet.

### 2.3 Missing pages and states

| Missing | Why it matters |
| --- | --- |
| Signed-in header and account menu (in the 14:xx style) | Every authenticated page needs it. |
| Seller dashboard / home | "My listings" is the de-facto dashboard and can serve as one. Make it the seller landing page rather than designing a separate dashboard. |
| Organization profile (public) and organization verification flow | Shelters need a trustworthy public page; admins need to verify them. |
| Member "My adoption requests" list | 10 shows the status of one request; members need a list of all of them. |
| Notifications (in-app center or at least email preferences) | Request updates are time-sensitive. |
| Admin: users, reports queue, organization verification, audit log | 21 covers only listing review. |
| Edit listing, Pause listing, Mark as rehomed flows | Partially covered by 22's confirmation states. |
| Terms, Privacy, Accessibility, Contact, About | Linked from the footer and consent checkbox; Terms and Privacy are legally required before launch. |
| 404 / 500 / offline / session expired | 404 is implemented; session-expired copy exists in 22. |
| Change-email and email-change verification | Account page lists the email but there is no flow to change it. |

---

## 3. Role journeys (improved)

### Member (adopter)
`Home → Find a pet (filters) → Pet profile → Save ♥ / Message lister / Apply to adopt → Request sent → My requests (status timeline) ↔ Messages → Meet & greet → Adopted`

Changes from the proposed journey:
- **Apply before chatting is optional, not required.** The profile offers both "Apply" and "Message"; this already matches the Figma.
- **Gate actions, not browsing.** Browsing is public. Saving, messaging and applying need a verified account, and the login prompt must return the user to the pet they were looking at. This is already implemented for Save via `?next=`.
- **Pre-fill the application from the profile.** Name, city and household details are entered once and reused.

### Seller — individual rehomer ("Pet parent")
`Home → "Post a pet" → (log in / register as Pet parent → verify email) → Post a pet wizard (4 steps, autosave drafts) → Submitted (pending review) → My listings → Review requests → Invite to meet / Message / Decline → Mark as rehomed`

- No separate "become a seller" step. The `seller` capability is granted automatically once the email is verified and the user accepts the listing rules in step 4.
- Limit active rehoming listings per individual (for example, 3) to deter backyard breeding and resale.

### Seller — shelter / rescue
`Register as Shelter → verify email → Organization details (legal name, registration/EIN, address, website) → Pending verification banner → (admin verifies) → Listings publish with a "Verified shelter" badge`

- Optional later: multiple staff members per organization.

### Admin
`Staff login (separate, SSO or invite-only, MFA required) → Moderation workspace → Pending listings · Open reports · Org verification → Decision (approve / request changes / reject, with reason) → Audit log`

- Admin accounts are **never** created through public sign-up. They are invited by an existing admin and enforced by the API.

---

## 4. Recommended navigation

| Context | Primary nav | Right side |
| --- | --- | --- |
| Signed out | Find a pet · How it works · Our mission | Log in · **Post a pet** |
| Member | Find a pet · Saved · Messages (badge) · My requests | Avatar menu (Account, Safety & support, Log out) · Post a pet |
| Seller | Find a pet · **My listings** (badge for new requests) · Messages · Saved | Avatar menu · **Post a pet** |
| Admin | Separate `/admin` area with its own layout: Listings · Reports · Organizations · Users · Audit log | Staff badge · Log out |

- **Mobile:** keep the current menu sheet, plus a bottom tab bar for signed-in members (Find, Saved, Messages, Me).
- **"Post a pet" always visible:** clicking it while signed out goes to registration with `next=/post-a-pet`.

---

## 5. Prioritised roadmap

### Priority 1 — essential for MVP
| # | Item | Why |
| --- | --- | --- |
| 1 | **Real backend + auth** (replace demo adapter) | Nothing else can be trusted until sessions, hashing, tokens and RBAC live on a server. |
| 2 | **Signed-in header and account menu** | Every authenticated page depends on it. |
| 3 | **Find a pet** (14:37) with filters and pagination | The primary member journey starts here, and the homepage search and categories already link to it. |
| 4 | **Pet profile** (14:39) incl. report listing | This is the conversion point (save, message, apply) and carries the trust signals. |
| 5 | **Post a pet** wizard (14:47–14:55) with drafts and **photo upload** | Without supply there is no marketplace. Photos are subject to §10. |
| 6 | **Moderation: listing review** (14:67) | Listings must not go public unreviewed, as the Figma already promises. |
| 7 | **Adoption request + status** (12:34, 12:38, 14:45) and **Review requests** (14:59) | This is the core two-sided transaction. |
| 8 | **My listings** (14:57) incl. pause / mark rehomed | Sellers need to close the loop. |
| 9 | **Saved pets** (14:41) | Low cost, high engagement. The save button already exists. |
| 10 | **Terms, Privacy, Safety & support (+ report form)** | Legal requirement, and the consent checkbox already links to these pages. |

### Priority 2 — important improvements
| Item | Why |
| --- | --- |
| Messages (14:61) with report/block | Keeps contact on-platform and moderatable. Requests can carry the first message until then. |
| Account & privacy (14:63): profile, password change, notification prefs, data export, delete account | Trust and GDPR/CCPA readiness. |
| Organization verification + verified badge + public org page | Shelters are the most trustworthy supply; a badge separates them from anonymous listings. |
| Admin: reports queue, user management (suspend, role changes), audit log | Needed as soon as there is real user traffic. |
| Email notifications (new request, status change, listing approved) | Request handling is time-sensitive. |
| Listing limits and duplicate/scam heuristics (same photos, deposit keywords, shipping offers) | Rehoming platforms are prime scam targets. |

### Priority 3 — future enhancements
- Saved searches and alerts ("new cats near me").
- A map view in Find a pet.
- Multiple staff accounts per organization.
- Adoption follow-up check-ins and success stories.
- Pet care resources and a rehoming guide CMS.
- Social sign-in.
- Two-factor authentication for members (it is mandatory for admins from day one).
- Localization.
- A native app wrapper.

### Postpone or avoid
- **On-platform payments and deposits.** The Figma copy already promises "no payment is taken on Pawhaven". Keep it that way: it removes PCI scope and a major scam vector.
- **A separate seller dashboard page.** "My listings" already serves this purpose.
- **Pet "shipping"** and **wildlife or exotic categories.** These are prohibited by the Safety copy.

---

## 6. Role capabilities (server-enforced)

| Capability | Visitor | Member | Seller | Admin |
| --- | :-: | :-: | :-: | :-: |
| Browse / search / view profiles | ✅ | ✅ | ✅ | ✅ |
| Save pets, message, apply | – | ✅ (verified email) | ✅ | – |
| Create/edit own listings, upload photos | – | – | ✅ (own only) | – |
| Review requests for own listings | – | – | ✅ (own only) | – |
| Report listing/user | – | ✅ | ✅ | – |
| Moderate listings, handle reports | – | – | – | ✅ |
| Verify organizations, manage users and roles | – | – | – | ✅ |
| View audit log | – | – | – | ✅ |

Seller is **additive** to Member: a shelter worker can also adopt. Ownership checks happen on every request; for example, `listing.ownerId === session.userId` before any edit.

---

## 7. Suggested backend architecture

- **API:** TypeScript on Node (for example NestJS or Fastify), so types can be shared with this client, behind REST/JSON. OpenAPI generates the client `AuthService` and `PetsService` adapters.
- **Database:** PostgreSQL with PostGIS for distance search, managed with Prisma or Drizzle.
- **Auth:**
  - Server sessions in httpOnly, Secure, SameSite=Lax cookies.
  - Argon2id password hashing.
  - Hashed single-use tokens for email verification (24 hours) and password reset (30 minutes).
  - Rate limiting and lockout backoff.
  - Admins log in through invite-only accounts with mandatory TOTP or WebAuthn.
- **Authorization:** a policy layer (role + ownership + state) on every route. The client UI only hides controls.
- **Email:** a transactional provider (Postmark, SES or Resend) behind a queue.
- **Media:** object storage (S3 or R2) with signed uploads, server-side EXIF/GPS stripping, image resizing, content-type validation, and malware/abuse scanning. Images are served through a CDN.
- **Search:** Postgres full-text + PostGIS first. Add a search engine only if needed.
- **Background jobs:** a queue (BullMQ or pg-boss) for email, image processing and scam heuristics.
- **Observability:** structured logs, error tracking, an audit log table for admin actions.

---

## 8. Data model (entities and relationships)

```
User 1─* Session
User 1─* AuthToken (type: verify|reset, hash, expiresAt, usedAt)
User *─* Role                    (member | seller | admin)
User *─1 Organization?           (staff of a shelter)
Organization (name, legalId, address, website, verificationStatus, verifiedBy, verifiedAt)
Listing (ownerUserId, organizationId?, petName, species, breed, sex, age, size, listingType,
         fee, city, geo, health fields, story fields, status: draft|pending|changes_requested|
         live|paused|rehomed|rejected, publishedAt)
Listing 1─* ListingMedia (url, alt, order, moderationStatus)
User *─* Listing via Favorite
AdoptionRequest (listingId, applicantId, household, home, otherPets, experience, message,
                 status: sent|in_review|meet_invited|approved|declined|withdrawn)
Conversation (listingId, requestId?, participants) 1─* Message (senderId, body, readAt)
Report (reporterId, targetType: listing|user|message, targetId, reason, details, status)
ModerationAction (moderatorId, targetType, targetId, decision, reason, createdAt)
AuditLog (actorId, action, entity, entityId, before, after, ip, createdAt)
NotificationPreference (userId, channel, type, enabled)
```

---

## 9. Security and trust checklist

**Account security**
- Never trust client-sent roles or `accountType` for authorization. This is already respected in the client.
- Rate limits on login, registration, resend, reset and messaging.
- CSRF protection for cookie sessions, a strict CSP, and security headers (HSTS, frame-ancestors, referrer policy).
- Generic auth errors and neutral reset/registration responses. The UI is already built this way.

**Privacy and listings**
- Strip GPS/EXIF from photos.
- Show only the city publicly; never show an exact address. The Figma copy already promises this.
- Detect contact details in public listing text, since moderation checks for "No private contact information".

**Abuse and audit**
- Scam heuristics: deposit requests, gift cards, shipping offers, off-platform payment links.
- Every moderation decision records the reviewer, timestamp and reason, as the Figma promises.
- Admin MFA, least-privilege roles, and audit-log alerts for role changes.

**Compliance**
- Data export and account deletion, for GDPR/CCPA.
- An age gate (18+) is already in registration.

---

## 10. Decisions needed from you

1. **Backend stack:** approve the Node/TypeScript + PostgreSQL approach (§7), or tell me which stack or hosting you prefer.
2. **Phase 2 scope:** I suggest P1 items 1–4: the backend auth swap, the signed-in header, Find a pet and Pet profile.
3. **Real pet photos:** allow uploads, which I recommend, or keep the artwork-only approach shown in Figma frame 13.
4. **Terminology:** "adoption request" as the single term, and user-facing wording for "Seller".
5. **Fee labelling on cards:** "Adoption fee $150" instead of a bare "$150".
6. **Figma clean-up:** retire the 12:xx duplicates and design a 14:xx-style signed-in header.
7. **Listing limits for individuals:** for example, a maximum of 3 active rehoming listings.
