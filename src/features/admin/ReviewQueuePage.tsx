import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Checkbox } from '../../components/ui/Checkbox';
import { Dialog } from '../../components/ui/Dialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { Icon } from '../../components/ui/Icon';
import { Spinner } from '../../components/ui/Spinner';
import { Textarea } from '../../components/ui/Textarea';
import { petPath, ROUTES } from '../../lib/routes';
import { adminService, type AdminSummary, type Checklist, type QueueItem, type ReviewListing } from '../../services/admin/adminService';
import { ApiRequestError } from '../../services/api/client';
import { artworkFor } from '../../services/pets/artwork';
import { AdminLayout } from './AdminLayout';
import styles from './AdminPages.module.css';

const CHECKS: { key: keyof Checklist; label: string }[] = [
  { key: 'ownership', label: 'Ownership statement provided' },
  { key: 'health', label: 'Health and behavior details disclosed' },
  { key: 'welfare', label: 'Listing complies with animal welfare rules' },
  { key: 'noContact', label: 'No private contact information in public text' },
];
const NONE: Checklist = { ownership: false, health: false, welfare: false, noContact: false };
const TYPE: Record<string, string> = { adoption: 'Adoption', rehoming: 'Rehoming' };

export function StatCards({ summary }: { summary: AdminSummary | null }) {
  const cards = [
    ['Pending listings', summary?.pendingListings],
    ['Open reports', summary?.openReports],
    ['Reviewed today', summary?.reviewedToday],
  ] as const;
  return (
    <dl className={styles.stats}>
      {cards.map(([label, n]) => (
        <div key={label} className={styles.stat}>
          <dt>{label}</dt>
          <dd>{n ?? '–'}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Figma 14:67 — Moderation workspace: listing review queue. */
export function ReviewQueuePage() {
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [queue, setQueue] = useState<QueueItem[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [listing, setListing] = useState<ReviewListing | null>(null);
  const [checklist, setChecklist] = useState<Checklist>(NONE);
  const [dialog, setDialog] = useState<'request_changes' | 'reject' | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(() => {
    adminService.summary().then(setSummary).catch(() => undefined);
    adminService
      .queue()
      .then((items) => {
        setQueue(items);
        setSelected((cur) => (cur && items.some((i) => i.id === cur) ? cur : items[0]?.id ?? null));
      })
      .catch(() => setQueue([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!selected) return;
    let active = true;
    adminService.listing(selected).then((l) => {
      if (!active) return;
      setListing(l);
      setChecklist(NONE);
    });
    return () => {
      active = false;
    };
  }, [selected]);

  async function decide(decision: 'approve' | 'request_changes' | 'reject') {
    if (!listing) return;
    setBusy(true);
    setMessage(null);
    try {
      await adminService.decide(listing.id, decision, checklist, decision === 'approve' ? undefined : reason.trim());
      setMessage({
        tone: 'success',
        text: {
          approve: `${listing.name} is now live.`,
          request_changes: `Changes requested for ${listing.name}. The lister has been notified.`,
          reject: `${listing.name} was not approved. The lister has been notified.`,
        }[decision],
      });
      setDialog(null);
      setReason('');
      setListing(null);
      setSelected(null);
      load();
    } catch (err) {
      setMessage({ tone: 'error', text: err instanceof ApiRequestError ? err.message : 'That didn’t work.' });
      setDialog(null);
    } finally {
      setBusy(false);
    }
  }

  const allChecked = CHECKS.every((c) => checklist[c.key]);
  const yes = (v: string | null | undefined) => (v === 'yes' ? 'Yes' : v === 'no' ? 'No' : v === 'unknown' ? 'Unknown' : '—');

  return (
    <AdminLayout title="Review queue">
      <StatCards summary={summary} />
      {message && (
        <Alert tone={message.tone} className={styles.message}>
          {message.text}
        </Alert>
      )}

      <div className={styles.split}>
        <aside className={styles.listCard} aria-label="Pending listings">
          <h2 className={styles.listTitle}>Pending listings ({queue?.length ?? '–'})</h2>
          {!queue && <Spinner size={24} label="Loading queue" />}
          {queue?.length === 0 && <p className={styles.muted}>Nothing waiting for review. Nice work.</p>}
          <ul role="list" className={styles.items}>
            {queue?.map((q) => (
              <li key={q.id}>
                <button
                  type="button"
                  className={`${styles.item} ${q.id === selected ? styles.selected : ''}`}
                  aria-current={q.id === selected ? 'true' : undefined}
                  onClick={() => setSelected(q.id)}
                >
                  <Icon name="paw" size={28} className={styles.itemIcon} />
                  <span className={styles.itemText}>
                    <span className={styles.itemName}>{q.name}</span>
                    <span className={styles.itemMeta}>
                      {q.lister} · {TYPE[q.listingType ?? ''] ?? 'Listing'}
                    </span>
                    <span className={styles.itemSmall}>
                      Awaiting review{q.submittedAt ? ` · ${new Date(q.submittedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : ''}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <Button to={`${ROUTES.admin}/reports`} variant="secondary" block className={styles.listFooter}>
            View reported content
          </Button>
        </aside>

        <section className={styles.detail} aria-label="Listing review">
          {!selected && queue && <EmptyState tone="plain" title="The queue is clear." text="New submissions will appear here." />}
          {selected && !listing && (
            <div className={styles.center}>
              <Spinner size={28} label="Loading listing" />
            </div>
          )}
          {listing && (
            <>
              <h2 className={styles.detailTitle}>{listing.name} · Listing review</h2>
              <p className={styles.muted}>
                {listing.owner.organization ? `${listing.owner.organization.name} (${listing.owner.organization.verification})` : listing.owner.name} ·{' '}
                {listing.owner.emailVerified ? 'Email verified' : 'Email not verified'} · {listing.owner.location} · {listing.owner.previousListings} past
                listing{listing.owner.previousListings === 1 ? '' : 's'}
              </p>

              <div className={styles.summaryRow}>
                <span className={`${styles.reviewThumb} ${styles[`tone_${listing.artworkTone}`]}`}>
                  <img src={listing.photos[0]?.thumbUrl ?? artworkFor(listing.artworkTone)} alt="" />
                </span>
                <div>
                  <p className={styles.summaryMain}>{[listing.species, listing.breed, listing.ageLabel, listing.sex].filter(Boolean).join(' · ')}</p>
                  <p className={styles.summarySub}>
                    {TYPE[listing.listingType ?? ''] ?? '—'} · {listing.fee ? `$${listing.fee} fee` : 'No fee'} · {listing.city}
                  </p>
                  <p className={styles.small}>
                    {listing.photos.length ? `${listing.photos.length} photo${listing.photos.length === 1 ? '' : 's'}` : 'No photos · Paw artwork selected'}
                  </p>
                </div>
              </div>

              {listing.flags.contactInfo && (
                <Alert tone="warning" className={styles.message} title="Possible contact details in public text.">
                  Check the description before approving.
                </Alert>
              )}

              <details className={styles.fullText}>
                <summary>Read the full listing text</summary>
                <dl>
                  {[
                    ['Headline', listing.headline],
                    ['About', listing.about],
                    ['Ideal home', listing.idealHome],
                    ['Reason for rehoming', listing.rehomingReason],
                    ['Medical', listing.medicalNotes],
                    ['Behavior', listing.behaviorNotes],
                    [
                      'Health',
                      `Vaccinated ${yes(listing.health.vaccinated)} · Spayed/neutered ${yes(listing.health.spayedNeutered)} · Microchipped ${yes(listing.health.microchipped)} · House trained ${yes(listing.health.houseTrained)}`,
                    ],
                  ]
                    .filter(([, v]) => v)
                    .map(([k, v]) => (
                      <div key={k as string}>
                        <dt>{k}</dt>
                        <dd>{v}</dd>
                      </div>
                    ))}
                </dl>
              </details>

              <fieldset className={styles.checklist}>
                <legend>Review checklist</legend>
                {CHECKS.map((c) => (
                  <Checkbox
                    key={c.key}
                    label={c.label}
                    checked={checklist[c.key]}
                    onChange={(e) => setChecklist((cl) => ({ ...cl, [c.key]: e.target.checked }))}
                  />
                ))}
              </fieldset>

              {listing.history.length > 0 && (
                <p className={styles.small}>
                  Previous decision: {listing.history[0]!.decision.replace('_', ' ')} by {listing.history[0]!.moderator}
                  {listing.history[0]!.reason ? ` — “${listing.history[0]!.reason}”` : ''}
                </p>
              )}

              <Link to={petPath(listing.id)} target="_blank" rel="noopener" className={styles.external}>
                Open full listing <Icon name="arrowUpRight" size={14} />
              </Link>

              <div className={styles.actions}>
                <Button onClick={() => decide('approve')} disabled={!allChecked} loading={busy && !dialog} className={styles.primary} aria-describedby={!allChecked ? 'approve-hint' : undefined}>
                  Approve listing
                </Button>
                <Button variant="secondary" onClick={() => setDialog('request_changes')} className={styles.primary}>
                  Request changes
                </Button>
                <button type="button" className={styles.reject} onClick={() => setDialog('reject')}>
                  Reject
                </button>
              </div>
              {!allChecked && (
                <p id="approve-hint" className={styles.small}>
                  Complete every checklist item to approve.
                </p>
              )}
            </>
          )}
        </section>
      </div>

      <Dialog
        open={dialog !== null}
        title={dialog === 'reject' ? `Reject ${listing?.name ?? ''}?` : `Request changes to ${listing?.name ?? ''}?`}
        onClose={() => setDialog(null)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button variant={dialog === 'reject' ? 'danger' : 'primary'} disabled={reason.trim().length < 10} loading={busy} onClick={() => dialog && decide(dialog)}>
              {dialog === 'reject' ? 'Reject listing' : 'Send request'}
            </Button>
          </>
        }
      >
        <p>The lister will see this note{dialog === 'request_changes' ? ' and can resubmit after making changes' : ''}.</p>
        <Textarea label="Reason (shared with the lister)" rows={3} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} className={styles.dialogField} />
      </Dialog>
    </AdminLayout>
  );
}
