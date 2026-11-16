/**
 * Authorization policies. Every route that reads or changes protected data
 * calls one of these — the client UI never decides access.
 */
import type { ListingRow, UserRow } from '../db/schema.ts';
import { ApiError, forbidden } from '../lib/errors.ts';

export type SessionUser = Pick<
  UserRow,
  'id' | 'email' | 'full_name' | 'roles' | 'status' | 'email_verified_at' | 'account_type' | 'organization_id'
>;

export const hasRole = (user: SessionUser | null | undefined, role: string) => Boolean(user?.roles.includes(role));
export const isAdmin = (user: SessionUser | null | undefined) => hasRole(user, 'admin');

export function requireVerified(user: SessionUser) {
  if (!user.email_verified_at) throw new ApiError('EMAIL_NOT_VERIFIED', 'Please verify your email address first.');
}

export function requireRole(user: SessionUser, role: 'seller' | 'admin') {
  if (!hasRole(user, role)) throw forbidden();
}

/** Owners (and admins, for moderation) may manage a listing. */
export function canManageListing(user: SessionUser, listing: Pick<ListingRow, 'owner_id'>) {
  return listing.owner_id === user.id;
}

export function assertCanManageListing(user: SessionUser, listing: Pick<ListingRow, 'owner_id'>) {
  if (!canManageListing(user, listing)) throw forbidden('You can only manage your own listings.');
}

/** Who may see a listing in its current state. */
export function canViewListing(user: SessionUser | null, listing: Pick<ListingRow, 'owner_id' | 'status'>) {
  if (listing.status === 'live' || listing.status === 'rehomed') return true;
  if (!user) return false;
  return listing.owner_id === user.id || isAdmin(user);
}
