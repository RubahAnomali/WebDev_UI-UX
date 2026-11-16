import type { DB } from '../db/database.ts';

export type NotificationType =
  | 'request_new'
  | 'request_invite'
  | 'request_approve'
  | 'request_decline'
  | 'request_closed'
  | 'message'
  | 'listing_approve'
  | 'listing_request_changes'
  | 'listing_reject'
  | 'organization_verify'
  | 'organization_reject';

export interface NotificationInput {
  type: NotificationType;
  title: string;
  body?: string | null;
  /** In-app path, e.g. /requests/123. */
  link?: string | null;
  conversationId?: string | null;
}

/**
 * Creates an in-app notification. Message notifications are collapsed:
 * while one is unread for a conversation, it's refreshed instead of adding more.
 * Message text is never copied into notifications.
 */
export async function notify(db: DB, userId: string, n: NotificationInput) {
  if (n.type === 'message' && n.conversationId) {
    const existing = await db
      .selectFrom('notifications')
      .select('id')
      .where('user_id', '=', userId)
      .where('conversation_id', '=', n.conversationId)
      .where('read_at', 'is', null)
      .executeTakeFirst();
    if (existing) {
      await db
        .updateTable('notifications')
        .set({ title: n.title, body: n.body ?? null, created_at: new Date() })
        .where('id', '=', existing.id)
        .execute();
      return;
    }
  }
  await db
    .insertInto('notifications')
    .values({
      user_id: userId,
      type: n.type,
      title: n.title,
      body: n.body ?? null,
      link: n.link ?? null,
      conversation_id: n.conversationId ?? null,
    })
    .execute();
}

/** Marks a conversation's message notification read when the conversation is opened. */
export async function markConversationNotificationsRead(db: DB, userId: string, conversationId: string) {
  await db
    .updateTable('notifications')
    .set({ read_at: new Date() })
    .where('user_id', '=', userId)
    .where('conversation_id', '=', conversationId)
    .where('read_at', 'is', null)
    .execute();
}
