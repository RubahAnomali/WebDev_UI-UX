import { z } from 'zod';
import { ACCOUNT_TYPES } from '../constants';
import { evaluatePassword, MIN_PASSWORD_LENGTH } from '../passwordStrength';

export const emailSchema = z
  .string({ error: 'Enter your email address.' })
  .trim()
  .toLowerCase()
  .min(1, 'Enter your email address.')
  .max(254, 'Enter a valid email address, like you@example.com.')
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, 'Enter a valid email address, like you@example.com.');

export const newPasswordSchema = z
  .string({ error: 'Create a password.' })
  .max(200, 'Please use 200 characters or fewer.')
  .refine((v) => evaluatePassword(v).valid, `Use at least ${MIN_PASSWORD_LENGTH} characters, including a number and a symbol.`);

export const fullNameSchema = z
  .string({ error: 'Enter your full name.' })
  .trim()
  .min(2, 'Enter your full name.')
  .max(80, 'Please use 80 characters or fewer.');

export const locationSchema = z
  .string({ error: 'Enter your city or ZIP code.' })
  .trim()
  .min(2, 'Enter your city or ZIP code.')
  .max(80, 'Please use 80 characters or fewer.');

/* ---------- Shelter / rescue verification evidence ---------- */

const optionalText = (max: number) => z.string().trim().max(max, `Please use ${max} characters or fewer.`).optional().or(z.literal(''));

export const orgEvidenceFields = {
  organizationName: z.string().trim().max(120, 'Please use 120 characters or fewer.').optional(),
  registrationNumber: optionalText(60),
  website: optionalText(200),
  reference: optionalText(300),
};

type Evidence = { organizationName?: string; registrationNumber?: string; website?: string; reference?: string };

/**
 * A shelter must give its name, a registration / charity number, and at least
 * one more piece of evidence: a website or social page, or a reference.
 */
export function checkOrgEvidence(v: Evidence, ctx: z.RefinementCtx) {
  if ((v.organizationName ?? '').trim().length < 2) {
    ctx.addIssue({ code: 'custom', path: ['organizationName'], message: 'Enter your shelter or rescue’s name.' });
  }
  if ((v.registrationNumber ?? '').trim().length < 3) {
    ctx.addIssue({ code: 'custom', path: ['registrationNumber'], message: 'Enter your registration or charity number.' });
  }
  const website = (v.website ?? '').trim();
  const reference = (v.reference ?? '').trim();
  if (website && !/^https?:\/\/[^\s.]+\.[^\s]{2,}$/i.test(website)) {
    ctx.addIssue({ code: 'custom', path: ['website'], message: 'Enter a full link, like https://happytails.org.' });
  }
  if (reference && reference.length < 10) {
    ctx.addIssue({ code: 'custom', path: ['reference'], message: 'Add a little more detail (10+ characters).' });
  }
  if (!website && !reference) {
    ctx.addIssue({ code: 'custom', path: ['website'], message: 'Add a website or social page, or a reference.' });
  }
}

export const orgEvidenceSchema = z.object(orgEvidenceFields).superRefine(checkOrgEvidence);

export const registerSchema = z
  .object({
    fullName: fullNameSchema,
    email: emailSchema,
    password: newPasswordSchema,
    location: locationSchema,
    accountType: z.enum(ACCOUNT_TYPES),
    acceptedTerms: z.literal(true, { error: 'Please confirm you’re 18 or older and agree to the terms.' }),
    ...orgEvidenceFields,
  })
  .superRefine((v, ctx) => {
    if (v.accountType === 'organization') checkOrgEvidence(v, ctx);
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password.').max(200),
  remember: z.boolean().default(false),
});

export const emailOnlySchema = z.object({ email: emailSchema });
export const tokenSchema = z.object({ token: z.string().max(200) });
export const resetPasswordSchema = z.object({ token: z.string().max(200), password: newPasswordSchema });
