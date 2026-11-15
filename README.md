# Pawhaven

A pet adoption and responsible rehoming platform. This repository holds the **web client**. Phase 1 covers the homepage and the authentication experience, implemented from the Pawhaven Figma file.

> ⚠️ **Authentication is a demo.** No backend exists yet. Accounts are stored in the
> visitor's browser and emails are simulated in an on-screen "demo inbox". This is
> **not production security**. See [Authentication](#authentication) below.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
```

| Script              | What it does                                     |
| ------------------- | ------------------------------------------------ |
| `npm run dev`       | Vite dev server with hot reload                  |
| `npm run build`     | Type-check (`tsc -b`) and production build to `dist/` |
| `npm run preview`   | Serve the production build                       |
| `npm run lint`      | ESLint (TypeScript and React hooks rules)        |
| `npm test`          | Vitest + Testing Library unit/component tests    |

Requires Node 20+.

## Stack

- **React 19 + TypeScript** (strict), bundled with **Vite**.
- **React Router 7** for client-side routing.
- **CSS Modules** plus design tokens in `src/styles/tokens.css`. There is no CSS framework and no UI kit.
- **Fonts:** Inter (variable) and Lora are self-hosted through `@fontsource`. No calls go to Google at runtime.
- **Tests:** Vitest, jsdom and Testing Library.

## Project structure

```
src/
  assets/figma/        Original SVG artwork exported from the Figma file
  styles/              Design tokens + global styles
  components/
    ui/                Button, TextField, PasswordField, Checkbox, SegmentedChoice,
                       Alert, PasswordStrength, Spinner, Icon, Logo
    layout/            SiteHeader, SiteFooter, PageShell, AuthLayout
    pets/              PetCard (+ skeleton), CategoryCard
  features/
    home/              Homepage sections (Hero, PetSearch, BrowseCategories,
                       FeaturedPets, HowItWorks, SafetyPanel, CommunityCta)
    auth/              Login, Register, VerifyEmail, ForgotPassword, ResetPassword,
                       validation, password strength, demo notice/inbox
  services/
    auth/              AuthService interface, demo adapter, AuthContext
    pets/              Sample featured pets + saved-pets helper
  pages/               ComingSoon (later-phase routes), NotFound
  lib/                 Routes map, storage helper, scroll manager, document title
docs/PRODUCT_PLAN.md   Product evaluation and roadmap
```

## Routes

| Route | Figma frame | Status |
| --- | --- | --- |
| `/` | 6:2 Homepages | ✅ Implemented |
| `/login` | 14:27 Log in | ✅ Implemented |
| `/register` | 14:29 Create an account | ✅ Implemented |
| `/verify-email` (+ `?token=`) | 14:31 Verify your email | ✅ Implemented |
| `/forgot-password` | 14:33 Forgot password | ✅ Implemented |
| `/reset-password?token=` | 14:35 Reset password | ✅ Implemented |
| `/pets`, `/pets/:id`, `/post-a-pet`, `/my-listings`, `/safety`, `/about`, … | various | "Coming soon" placeholder |
| anything else | — | 404 page |

Every link on the homepage and in the footer goes to a real route. Destinations planned for later phases render an honest "coming soon" page instead of a fake feature.

## Authentication

UI code only talks to the `AuthService` interface (`src/services/auth/types.ts`). The implementation is chosen in one place, `src/services/auth/index.ts`.

The current implementation is `demoAuthAdapter.ts`. It works like this:

- **Storage:** accounts live in `localStorage`. Passwords are hashed with PBKDF2 (Web Crypto), but because everything is client-side this gives **no real security**.
- **Simulated email:** messages are written to a **demo inbox** shown on the verify and forgot-password screens ("Open link from email"), and logged to the console in dev.
- **Production-like behaviour, so the UI is built for it:**
  - Login returns the same generic error for an unknown email and for a wrong password.
  - Registering with an existing email looks like a normal sign-up; the existing owner is notified instead.
  - Forgot-password always returns the same neutral response.
  - Verification links last 24 hours. Reset links last 30 minutes and work once.
  - Verification resends are limited to one per 60 seconds.
  - "Remember me" controls whether the session lives in localStorage or sessionStorage.
  - The `?next=` redirect after login only accepts same-site paths.
- **Roles:** every new account gets only the `member` role. Seller and Admin can never be granted from the client.

### Role model

| Concept | Meaning |
| --- | --- |
| `accountType: individual` | Figma "Pet parent". Can adopt, and can rehome a pet they own. |
| `accountType: organization` | Figma "Shelter / rescue". `organizationVerification: pending` until staff verify it. |
| `role: member` | Every account. Can browse, save, apply and message. |
| `role: seller` | Can publish listings. **Granted by the server**, for example after email verification (individuals) or organization verification (shelters). |
| `role: admin` | Moderation and administration. **Only ever assigned server-side.** Never available through registration. |

The account type chosen at sign-up is profile data, not proof of authorization.

### Replacing the demo

Implement `AuthService` over HTTP, using httpOnly secure session cookies, server-side Argon2id or bcrypt, and a real email provider. Then swap it in `src/services/auth/index.ts`. The pages need no changes.

## Development helpers

- `/?demoState=empty|error|slow` (dev only) previews the Featured pets empty, error and loading states.
- The demo notice on auth pages can be dismissed for the current tab.
- To reset demo data, clear site data for `localhost`, or run `localStorage.clear()` in the console.

## Design fidelity notes

- **Exact values from Figma:** colours, type scale, radii, spacing and copy all come from the Figma node data. The artwork is the original SVG exported from Figma, stored locally.
- **Small text is slightly larger:** the smallest Figma text (10–11px badges, meta and legal lines) is rendered at 11–12px for legibility.
- **Additions not in Figma**, all built from the existing tokens:
  - Validation, loading and error states
  - Password rules checklist and strength meter on registration
  - Helper text explaining the account type
  - "Use my current location" button on the search bar
  - Sample-data caption on Featured pets
  - Mobile navigation menu
