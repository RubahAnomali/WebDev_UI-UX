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

export const registerSchema = z.object({
  fullName: fullNameSchema,
  email: emailSchema,
  password: newPasswordSchema,
  location: locationSchema,
  accountType: z.enum(ACCOUNT_TYPES),
  acceptedTerms: z.literal(true, { error: 'Please confirm you’re 18 or older and agree to the terms.' }),
  organizationName: z.string().trim().max(120).optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password.').max(200),
  remember: z.boolean().default(false),
});

export const emailOnlySchema = z.object({ email: emailSchema });
export const tokenSchema = z.object({ token: z.string().max(200) });
export const resetPasswordSchema = z.object({ token: z.string().max(200), password: newPasswordSchema });
