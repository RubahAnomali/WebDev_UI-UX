import type { ApiUser } from '../../../shared/types.ts';
import type { DB } from '../db/database.ts';

export async function loadApiUser(db: DB, userId: string): Promise<ApiUser | null> {
  const row = await db
    .selectFrom('users')
    .leftJoin('organizations', 'organizations.id', 'users.organization_id')
    .select([
      'users.id',
      'users.full_name',
      'users.email',
      'users.location',
      'users.phone',
      'users.account_type',
      'users.roles',
      'users.email_verified_at',
      'users.listing_rules_accepted_at',
      'users.created_at',
      'organizations.id as org_id',
      'organizations.name as org_name',
      'organizations.verification_status as org_status',
    ])
    .where('users.id', '=', userId)
    .executeTakeFirst();
  if (!row) return null;
  const orgVerification = row.org_id ? (row.org_status ?? 'pending') : 'not_applicable';
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    location: row.location,
    phone: row.phone,
    accountType: row.account_type,
    roles: row.roles as ApiUser['roles'],
    emailVerified: Boolean(row.email_verified_at),
    organization: row.org_id ? { id: row.org_id, name: row.org_name ?? '', verification: orgVerification } : null,
    organizationVerification: orgVerification,
    listingRulesAccepted: Boolean(row.listing_rules_accepted_at),
    createdAt: row.created_at.toISOString(),
  };
}
