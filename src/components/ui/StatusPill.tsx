import styles from './StatusPill.module.css';

const LABEL: Record<string, string> = {
  draft: 'Draft',
  pending: 'In review',
  changes_requested: 'Changes requested',
  live: 'Live',
  paused: 'Paused',
  rehomed: 'Rehomed',
  rejected: 'Not approved',
  sent: 'Request sent',
  in_review: 'In review',
  meet_invited: 'Meet & greet',
  approved: 'Approved',
  declined: 'Closed',
  withdrawn: 'Withdrawn',
  open: 'Open',
  resolved: 'Resolved',
  dismissed: 'Dismissed',
  verified: 'Verified',
};

export function statusLabel(status: string) {
  return LABEL[status] ?? status;
}

/** Status chips used across My listings, requests and moderation (Figma 14:57). */
export function StatusPill({ status, label }: { status: string; label?: string }) {
  return <span className={`${styles.pill} ${styles[status] ?? ''}`}>{label ?? statusLabel(status)}</span>;
}
