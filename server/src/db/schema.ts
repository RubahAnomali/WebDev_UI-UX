import type { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely';

type Timestamp = ColumnType<Date, Date | string | undefined, Date | string>;
type NullableTimestamp = ColumnType<Date | null, Date | string | null | undefined, Date | string | null>;
type Json<T> = ColumnType<T, string | T, string | T>;

export interface UsersTable {
  id: Generated<string>;
  email: string;
  full_name: string;
  location: string;
  phone: string | null;
  account_type: 'individual' | 'organization';
  password_hash: string;
  email_verified_at: NullableTimestamp;
  roles: ColumnType<string[], string[] | undefined, string[]>;
  organization_id: string | null;
  status: Generated<'active' | 'suspended' | 'deleted'>;
  listing_rules_accepted_at: NullableTimestamp;
  terms_accepted_at: Timestamp;
  is_sample: Generated<boolean>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface OrganizationsTable {
  id: Generated<string>;
  name: string;
  legal_id: string | null;
  website: string | null;
  city: string;
  verification_status: Generated<'pending' | 'verified' | 'rejected'>;
  verified_by: string | null;
  verified_at: NullableTimestamp;
  verification_note: string | null;
  registration_number: string | null;
  reference: string | null;
  is_sample: Generated<boolean>;
  created_at: Generated<Date>;
}

export interface SessionsTable {
  id_hash: string;
  user_id: string;
  persistent: boolean;
  expires_at: Timestamp;
  created_at: Generated<Date>;
  last_seen_at: Generated<Date>;
  user_agent: string | null;
}

export interface AuthTokensTable {
  id: Generated<string>;
  user_id: string;
  type: 'verify' | 'reset' | 'email_change';
  token_hash: string;
  payload: Json<Record<string, unknown>> | null;
  expires_at: Timestamp;
  used_at: NullableTimestamp;
  created_at: Generated<Date>;
}

export interface ListingsTable {
  id: Generated<string>;
  owner_id: string;
  organization_id: string | null;
  status: Generated<'draft' | 'pending' | 'changes_requested' | 'live' | 'paused' | 'rehomed' | 'rejected'>;
  name: string;
  headline: string | null;
  species: string | null;
  breed: string | null;
  sex: string | null;
  age_value: number | null;
  age_unit: string | null;
  size: string | null;
  listing_type: string | null;
  fee: number | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  vaccinated: string | null;
  spayed_neutered: string | null;
  microchipped: string | null;
  house_trained: string | null;
  good_with: ColumnType<string[], string[] | undefined, string[]>;
  energy_level: string | null;
  medical_notes: string | null;
  behavior_notes: string | null;
  care_needs: string | null;
  traits: ColumnType<string[], string[] | undefined, string[]>;
  about: string | null;
  ideal_home: string | null;
  rehoming_reason: string | null;
  artwork_tone: Generated<string>;
  attestations: Json<Record<string, boolean>> | null;
  moderation_note: string | null;
  is_sample: Generated<boolean>;
  submitted_at: NullableTimestamp;
  published_at: NullableTimestamp;
  rehomed_at: NullableTimestamp;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface ListingPhotosTable {
  id: Generated<string>;
  listing_id: string;
  position: number;
  storage_key: string;
  width: number;
  height: number;
  created_at: Generated<Date>;
}

export interface FavoritesTable {
  user_id: string;
  listing_id: string;
  created_at: Generated<Date>;
}

export interface AdoptionRequestsTable {
  id: Generated<string>;
  listing_id: string;
  applicant_id: string;
  status: Generated<'sent' | 'in_review' | 'meet_invited' | 'approved' | 'declined' | 'withdrawn'>;
  full_name: string;
  email: string;
  phone: string | null;
  city: string;
  home_type: string;
  housing_permission: string;
  household: string;
  other_pets: string | null;
  experience: string | null;
  message: string;
  seller_unread: Generated<boolean>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface RequestEventsTable {
  id: Generated<string>;
  request_id: string;
  status: string;
  actor_id: string | null;
  note: string | null;
  created_at: Generated<Date>;
}

export interface ConversationsTable {
  id: Generated<string>;
  listing_id: string;
  request_id: string | null;
  created_at: Generated<Date>;
  last_message_at: Generated<Date>;
}

export interface ConversationParticipantsTable {
  conversation_id: string;
  user_id: string;
  last_read_at: NullableTimestamp;
}

export interface MessagesTable {
  id: Generated<string>;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: Generated<Date>;
}

export interface BlocksTable {
  blocker_id: string;
  blocked_id: string;
  created_at: Generated<Date>;
}

export interface ReportsTable {
  id: Generated<string>;
  reporter_id: string | null;
  reporter_email: string | null;
  target_type: string;
  target_id: string | null;
  target_link: string | null;
  reason: string;
  details: string;
  status: Generated<'open' | 'resolved' | 'dismissed'>;
  resolved_by: string | null;
  resolution_note: string | null;
  created_at: Generated<Date>;
  resolved_at: NullableTimestamp;
}

export interface ModerationActionsTable {
  id: Generated<string>;
  moderator_id: string;
  listing_id: string;
  decision: 'approve' | 'request_changes' | 'reject';
  reason: string | null;
  checklist: Json<Record<string, boolean>>;
  created_at: Generated<Date>;
}

export interface AuditLogTable {
  id: Generated<string>;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  data: Json<Record<string, unknown>> | null;
  ip: string | null;
  created_at: Generated<Date>;
}

export interface NotificationPrefsTable {
  user_id: string;
  messages: Generated<boolean>;
  discovery: Generated<boolean>;
}

export interface DevOutboxTable {
  id: Generated<string>;
  to_email: string;
  subject: string;
  body: string;
  link: string | null;
  created_at: Generated<Date>;
}

export interface Database {
  users: UsersTable;
  organizations: OrganizationsTable;
  sessions: SessionsTable;
  auth_tokens: AuthTokensTable;
  listings: ListingsTable;
  listing_photos: ListingPhotosTable;
  favorites: FavoritesTable;
  adoption_requests: AdoptionRequestsTable;
  request_events: RequestEventsTable;
  conversations: ConversationsTable;
  conversation_participants: ConversationParticipantsTable;
  messages: MessagesTable;
  blocks: BlocksTable;
  reports: ReportsTable;
  moderation_actions: ModerationActionsTable;
  audit_log: AuditLogTable;
  notification_prefs: NotificationPrefsTable;
  dev_outbox: DevOutboxTable;
}

export type UserRow = Selectable<UsersTable>;
export type NewUser = Insertable<UsersTable>;
export type ListingRow = Selectable<ListingsTable>;
export type ListingUpdate = Updateable<ListingsTable>;
export type RequestRow = Selectable<AdoptionRequestsTable>;
