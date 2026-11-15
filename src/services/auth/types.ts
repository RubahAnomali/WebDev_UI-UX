/**
 * Auth domain types shared by the UI and any AuthService implementation.
 *
 * ROLE MODEL (approved):
 * - Every new account is a `member`.
 * - `accountType` records how someone joined: an `individual` ("Pet parent")
 *   or an `organization` ("Shelter / rescue"). It is profile data, NOT an
 *   authorization grant.
 * - `seller` is a capability granted by the server (e.g. after email
 *   verification for individuals, or organization verification for shelters).
 * - `admin` is never available through registration and is only assigned
 *   server-side. The client never decides authorization — it only hides UI.
 */
export type AccountType = 'individual' | 'organization';
export type Role = 'member' | 'seller' | 'admin';
export type OrganizationVerification = 'not_applicable' | 'pending' | 'verified' | 'rejected';

export interface User {
  id: string;
  fullName: string;
  email: string;
  location: string;
  accountType: AccountType;
  roles: Role[];
  emailVerified: boolean;
  organizationVerification: OrganizationVerification;
  createdAt: string;
}

export interface RegisterInput {
  fullName: string;
  email: string;
  password: string;
  location: string;
  accountType: AccountType;
  acceptedTerms: boolean;
}

export interface LoginInput {
  email: string;
  password: string;
  remember: boolean;
}

export type AuthErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_NOT_VERIFIED'
  | 'TOKEN_INVALID'
  | 'TOKEN_EXPIRED'
  | 'RATE_LIMITED'
  | 'VALIDATION'
  | 'NETWORK';

export class AuthError extends Error {
  readonly code: AuthErrorCode;
  /** Seconds until the action can be retried (RATE_LIMITED). */
  readonly retryAfter?: number;

  constructor(code: AuthErrorCode, message: string, retryAfter?: number) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

export interface AuthService {
  /** True for the in-browser demo implementation. Drives the demo banner. */
  readonly isDemo: boolean;
  getCurrentUser(): Promise<User | null>;
  /**
   * Always resolves for a well-formed request, even if the email is already
   * registered (the existing owner is notified instead) — prevents account
   * enumeration.
   */
  register(input: RegisterInput): Promise<{ email: string }>;
  login(input: LoginInput): Promise<User>;
  logout(): Promise<void>;
  resendVerification(email: string): Promise<{ retryAfter: number }>;
  verifyEmail(token: string): Promise<User>;
  /** Always resolves (neutral response) for a well-formed email. */
  requestPasswordReset(email: string): Promise<void>;
  checkResetToken(token: string): Promise<void>;
  resetPassword(token: string, newPassword: string): Promise<void>;
}

/** Cooldown between verification emails, matching the Figma copy. */
export const RESEND_COOLDOWN_SECONDS = 60;
