import { evaluatePassword, MIN_PASSWORD_LENGTH } from './passwordStrength';

/** Pragmatic email check — the server remains the source of truth. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type FieldErrors<T extends string> = Partial<Record<T, string>>;

export function validateEmail(value: string): string | undefined {
  const v = value.trim();
  if (!v) return 'Enter your email address.';
  if (v.length > 254 || !EMAIL_RE.test(v)) return 'Enter a valid email address, like you@example.com.';
  return undefined;
}

export function validateNewPassword(value: string): string | undefined {
  if (!value) return 'Create a password.';
  const { rules } = evaluatePassword(value);
  const missing = rules.filter((r) => !r.met).map((r) => r.id);
  if (missing.length === 0) return undefined;
  if (missing.includes('length')) return `Use at least ${MIN_PASSWORD_LENGTH} characters, including a number and a symbol.`;
  if (missing.includes('number') && missing.includes('symbol')) return 'Add a number and a symbol.';
  if (missing.includes('number')) return 'Add at least one number.';
  return 'Add at least one symbol, like ! or #.';
}

export function validateFullName(value: string): string | undefined {
  const v = value.trim();
  if (!v) return 'Enter your full name.';
  if (v.length < 2) return 'Your name looks a little short.';
  if (v.length > 80) return 'Please use 80 characters or fewer.';
  return undefined;
}

export function validateLocation(value: string): string | undefined {
  const v = value.trim();
  if (!v) return 'Enter your city or ZIP code so we can show pets nearby.';
  if (v.length > 80) return 'Please use 80 characters or fewer.';
  return undefined;
}

export interface LoginValues {
  email: string;
  password: string;
}

export function validateLogin(values: LoginValues): FieldErrors<keyof LoginValues> {
  const errors: FieldErrors<keyof LoginValues> = {};
  const email = validateEmail(values.email);
  if (email) errors.email = email;
  if (!values.password) errors.password = 'Enter your password.';
  return errors;
}

export interface RegisterValues {
  fullName: string;
  email: string;
  password: string;
  location: string;
  consent: boolean;
}

export function validateRegister(values: RegisterValues): FieldErrors<keyof RegisterValues> {
  const errors: FieldErrors<keyof RegisterValues> = {};
  const fullName = validateFullName(values.fullName);
  const email = validateEmail(values.email);
  const password = validateNewPassword(values.password);
  const location = validateLocation(values.location);
  if (fullName) errors.fullName = fullName;
  if (email) errors.email = email;
  if (password) errors.password = password;
  if (location) errors.location = location;
  if (!values.consent) errors.consent = 'Please confirm you’re 18 or older and agree to the terms.';
  return errors;
}

export interface ResetValues {
  password: string;
  confirm: string;
}

export function validateReset(values: ResetValues): FieldErrors<keyof ResetValues> {
  const errors: FieldErrors<keyof ResetValues> = {};
  const password = validateNewPassword(values.password);
  if (password) errors.password = password;
  if (!values.confirm) errors.confirm = 'Confirm your new password.';
  else if (values.confirm !== values.password) errors.confirm = 'Passwords don’t match yet.';
  return errors;
}

export function hasErrors(errors: object): boolean {
  return Object.values(errors).some(Boolean);
}

/**
 * Only allow same-origin, path-only redirects after login to avoid open
 * redirects (e.g. `?next=//evil.example`).
 */
export function safeRedirectPath(next: string | null | undefined, fallback = '/'): string {
  if (!next) return fallback;
  if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback;
  if (/^\/(login|register|forgot-password|reset-password|verify-email)\b/.test(next)) return fallback;
  return next;
}
