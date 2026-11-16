import { http } from '../api/client';
import type { PhotoRef } from '../pets/types';

export interface AdminSummary {
  pendingListings: number;
  openReports: number;
  pendingOrganizations: number;
  reviewedToday: number;
}
export interface QueueItem {
  id: string;
  name: string;
  listingType: string | null;
  submittedAt: string | null;
  lister: string;
  listerType: string;
}
export interface ReviewListing {
  id: string;
  name: string;
  status: string;
  species: string | null;
  breed: string | null;
  sex: string | null;
  ageLabel: string | null;
  size: string | null;
  listingType: string | null;
  fee: number | null;
  city: string | null;
  headline: string | null;
  about: string | null;
  idealHome: string | null;
  rehomingReason: string | null;
  medicalNotes: string | null;
  behaviorNotes: string | null;
  health: Record<string, string | null>;
  attestations: Record<string, boolean> | null;
  artworkTone: 'green' | 'peach' | 'lilac' | 'sage';
  photos: PhotoRef[];
  submittedAt: string | null;
  flags: { contactInfo: boolean };
  owner: {
    name: string;
    emailVerified: boolean;
    location: string;
    accountType: string;
    memberSince: string;
    previousListings: number;
    organization: { name: string; verification: string | null } | null;
  };
  history: { decision: string; reason: string | null; at: string; moderator: string }[];
}
export interface ReportItem {
  id: string;
  targetType: string;
  target: string;
  reason: string;
  status: string;
  reporter: string;
  createdAt: string;
}
export interface ReportDetail extends ReportItem {
  targetListingId: string | null;
  targetUserId: string | null;
  link: string | null;
  details: string;
  reporterEmail: string | null;
  resolutionNote: string | null;
  messages: { from: string; body: string; at: string }[];
}
export interface OrgItem {
  id: string;
  name: string;
  city: string;
  status: string;
  createdAt: string;
  contact: { name: string; email: string; emailVerified: boolean } | null;
}
export interface MemberItem {
  id: string;
  name: string;
  email: string;
  roles: string[];
  status: string;
  accountType: string;
  emailVerified: boolean;
  createdAt: string;
}
export interface AuditItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  data: Record<string, unknown> | null;
  actor: string;
  at: string;
}

export type Checklist = { ownership: boolean; health: boolean; welfare: boolean; noContact: boolean };

export const adminService = {
  summary: () => http.get<AdminSummary>('/api/admin/summary'),
  queue: () => http.get<{ items: QueueItem[] }>('/api/admin/listings').then((r) => r.items),
  listing: (id: string) => http.get<{ listing: ReviewListing }>(`/api/admin/listings/${id}`).then((r) => r.listing),
  decide: (id: string, decision: 'approve' | 'request_changes' | 'reject', checklist: Checklist, reason?: string) =>
    http.post<{ status: string }>(`/api/admin/listings/${id}/decision`, { decision, checklist, reason }),
  reports: (closed = false) => http.get<{ items: ReportItem[] }>(`/api/admin/reports${closed ? '?status=closed' : ''}`).then((r) => r.items),
  report: (id: string) => http.get<{ report: ReportDetail }>(`/api/admin/reports/${id}`).then((r) => r.report),
  resolve: (id: string, status: 'resolved' | 'dismissed', note: string, action: 'none' | 'pause_listing' | 'suspend_user') =>
    http.post(`/api/admin/reports/${id}/resolve`, { status, note, action }),
  organizations: () => http.get<{ items: OrgItem[] }>('/api/admin/organizations').then((r) => r.items),
  decideOrg: (id: string, decision: 'verify' | 'reject', note?: string) => http.post(`/api/admin/organizations/${id}/decision`, { decision, note }),
  members: (q: string) => http.get<{ items: MemberItem[] }>(`/api/admin/users?q=${encodeURIComponent(q)}`).then((r) => r.items),
  setMemberStatus: (id: string, action: 'suspend' | 'reinstate', note: string) => http.post(`/api/admin/users/${id}/${action}`, { note }),
  audit: () => http.get<{ items: AuditItem[] }>('/api/admin/audit').then((r) => r.items),
};
