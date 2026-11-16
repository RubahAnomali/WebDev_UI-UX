import type { AccountType, OrganizationVerification, Role } from './constants';

/** The signed-in user as returned by the API. Never contains secrets. */
export interface ApiUser {
  id: string;
  fullName: string;
  email: string;
  location: string;
  phone: string | null;
  accountType: AccountType;
  roles: Role[];
  emailVerified: boolean;
  organization: {
    id: string;
    name: string;
    verification: OrganizationVerification;
    registrationNumber: string | null;
    website: string | null;
    reference: string | null;
    note: string | null;
  } | null;
  organizationVerification: OrganizationVerification;
  listingRulesAccepted: boolean;
  createdAt: string;
}

export interface ApiErrorBody {
  error: { code: string; message: string; fields?: Record<string, string>; retryAfter?: number };
}
