import type { DB } from '../db/database.ts';
import { randomToken, sha256 } from '../lib/crypto.ts';
import { ApiError } from '../lib/errors.ts';

type TokenType = 'verify' | 'reset' | 'email_change';

/** Issues a single-use token. Only its hash is stored; older tokens of the same type are revoked. */
export async function issueToken(db: DB, userId: string, type: TokenType, ttlMs: number, payload?: Record<string, unknown>) {
  const raw = randomToken(32);
  await db
    .updateTable('auth_tokens')
    .set({ used_at: new Date() })
    .where('user_id', '=', userId)
    .where('type', '=', type)
    .where('used_at', 'is', null)
    .execute();
  await db
    .insertInto('auth_tokens')
    .values({
      user_id: userId,
      type,
      token_hash: sha256(raw),
      payload: payload ? JSON.stringify(payload) : null,
      expires_at: new Date(Date.now() + ttlMs),
    })
    .execute();
  return raw;
}

export async function findToken(db: DB, raw: string, type: TokenType) {
  const row = await db
    .selectFrom('auth_tokens')
    .selectAll()
    .where('token_hash', '=', sha256(raw))
    .where('type', '=', type)
    .executeTakeFirst();
  if (!row || row.used_at) throw new ApiError('TOKEN_INVALID', 'This link is invalid or has already been used.');
  if (row.expires_at.getTime() < Date.now()) throw new ApiError('TOKEN_EXPIRED', 'This link has expired.');
  return row;
}

export async function consumeToken(db: DB, raw: string, type: TokenType) {
  const row = await findToken(db, raw, type);
  const updated = await db
    .updateTable('auth_tokens')
    .set({ used_at: new Date() })
    .where('id', '=', row.id)
    .where('used_at', 'is', null)
    .executeTakeFirst();
  if (Number(updated.numUpdatedRows) !== 1) throw new ApiError('TOKEN_INVALID', 'This link has already been used.');
  return row;
}
