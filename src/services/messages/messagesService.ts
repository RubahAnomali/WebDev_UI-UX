import { http } from '../api/client';

export interface ConversationSummary {
  id: string;
  listing: { id: string; name: string; status: string };
  otherName: string;
  otherIsOrganization: boolean;
  requestStatus: string | null;
  lastMessage: { body: string; at: string; fromMe: boolean } | null;
  unread: boolean;
}

export interface ChatMessage {
  id: string;
  body: string;
  at: string;
  fromMe: boolean;
}

export interface Conversation {
  id: string;
  listing: { id: string; name: string; status: string };
  requestId: string | null;
  requestStatus: string | null;
  otherName: string;
  otherIsOrganization: boolean;
  viewerIsLister: boolean;
  blockedByMe: boolean;
  canSend: boolean;
  otherLastReadAt: string | null;
  messages: ChatMessage[];
}

export const messagesService = {
  list: (q = '', signal?: AbortSignal) =>
    http.get<{ items: ConversationSummary[] }>(`/api/conversations${q ? `?q=${encodeURIComponent(q)}` : ''}`, signal).then((r) => r.items),
  get: (id: string, signal?: AbortSignal) =>
    http.get<{ conversation: Conversation }>(`/api/conversations/${id}`, signal).then((r) => r.conversation),
  send: (id: string, body: string) => http.post<{ message: ChatMessage }>(`/api/conversations/${id}/messages`, { body }).then((r) => r.message),
  start: (listingId: string, body: string) =>
    http.post<{ conversationId: string; message: ChatMessage }>('/api/conversations', { listingId, body }),
  lookup: (listingId: string) =>
    http.get<{ conversationId: string | null }>(`/api/conversations/lookup?listing=${listingId}`).then((r) => r.conversationId),
  block: (id: string) => http.post(`/api/conversations/${id}/block`),
  unblock: (id: string) => http.del(`/api/conversations/${id}/block`),
};

/** Phrases that often show up in pet scams. Used only to show a gentle warning. */
const RISKY = /\b(deposit|wire (transfer|money)|western union|money ?gram|gift ?cards?|zelle|venmo|cash ?app|paypal|crypto|bitcoin|shipping fee|ship (him|her|them|the pet)|pet transport|courier)\b/i;
export const looksRisky = (text: string) => RISKY.test(text);
