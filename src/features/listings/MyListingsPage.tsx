import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AppPage } from '../../components/layout/AppPage';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { Icon } from '../../components/ui/Icon';
import { Spinner } from '../../components/ui/Spinner';
import { StatusPill } from '../../components/ui/StatusPill';
import { editListingPath, listingRequestsPath, petPath, ROUTES } from '../../lib/routes';
import { ApiRequestError } from '../../services/api/client';
import { myListingsService, type MyListingRow, type MyListingsOverview } from '../../services/listings/myListingsService';
import { refreshCounts } from '../../services/me/useCounts';
import { artworkFor } from '../../services/pets/artwork';
import styles from './MyListingsPage.module.css';

type Filter = 'all' | 'live' | 'review' | 'drafts' | 'closed';
const FILTERS: { id: Filter; label: string; match: (s: string) => boolean }[] = [
  { id: 'all', label: 'All listings', match: () => true },
  { id: 'live', label: 'Live', match: (s) => s === 'live' || s === 'paused' },
  { id: 'review', label: 'In review', match: (s) => s === 'pending' || s === 'changes_requested' },
  { id: 'drafts', label: 'Drafts', match: (s) => s === 'draft' },
  { id: 'closed', label: 'Closed', match: (s) => s === 'rehomed' || s === 'rejected' },
];

type Confirm = { kind: 'rehomed' | 'delete' | 'pause'; row: MyListingRow } | null;

function relativeDay(iso: string) {
  const d = new Date(iso);
  const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Figma 14:57 — My listings. */
export function MyListingsPage() {
  const location = useLocation();
  const [data, setData] = useState<MyListingsOverview | null>(null);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(
    (location.state as { notice?: string } | null)?.notice ? { tone: 'success', text: (location.state as { notice: string }).notice } : null,
  );

  const load = useCallback(() => {
    myListingsService
      .overview()
      .then((d) => {
        setData(d);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function act(row: MyListingRow, action: 'pause' | 'resume' | 'rehomed' | 'delete') {
    setBusy(true);
    try {
      if (action === 'pause') await myListingsService.pause(row.id);
      if (action === 'resume') await myListingsService.resume(row.id);
      if (action === 'rehomed') await myListingsService.markRehomed(row.id);
      if (action === 'delete') await myListingsService.remove(row.id);
      const text = {
        pause: `${row.name}’s listing is paused and hidden from search.`,
        resume: `${row.name}’s listing is live again.`,
        rehomed: `A happy ending for ${row.name}. The listing is closed.`,
        delete: `${row.name}’s listing was removed.`,
      }[action];
      setMessage({ tone: 'success', text });
      setConfirm(null);
      load();
      refreshCounts();
    } catch (err) {
      setMessage({ tone: 'error', text: err instanceof ApiRequestError ? err.message : 'That didn’t work. Please try again.' });
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  }

  const items = data?.items ?? [];
  const visible = items.filter((i) => FILTERS.find((f) => f.id === filter)!.match(i.status));
  const countFor = (f: (typeof FILTERS)[number]) => items.filter((i) => f.match(i.status)).length;

  return (
    <AppPage
      title="Their next chapter, in your hands."
      documentTitle="My listings"
      subtitle="Manage your listings and the people hoping to meet your pets."
      actions={
        <Button to={ROUTES.postPet} iconStart={<Icon name="plus" size={18} strokeWidth={2} />} className={styles.post}>
          Post a pet
        </Button>
      }
    >
      {message && (
        <Alert tone={message.tone} className={styles.message}>
          {message.text}
        </Alert>
      )}

      {!data && !failed && (
        <div className={styles.center}>
          <Spinner size={32} label="Loading your listings" />
        </div>
      )}
      {failed && (
        <EmptyState
          title="Let’s try that again."
          text="We couldn’t load your listings right now."
          action={
            <Button variant="secondary" onClick={load}>
              Try again
            </Button>
          }
        />
      )}

      {data && (
        <>
          <dl className={styles.stats}>
            {[
              ['Live listings', data.stats.live],
              ['Pending review', data.stats.pending],
              ['Drafts', data.stats.drafts],
              ['New adoption requests', data.stats.newRequests],
            ].map(([label, n]) => (
              <div key={label} className={styles.stat}>
                <dt>{label}</dt>
                <dd>{n}</dd>
              </div>
            ))}
          </dl>

          {items.length === 0 ? (
            <EmptyState
              title="Their story starts with you."
              text="When you post a pet, you’ll manage the listing and adoption requests here."
              action={<Button to={ROUTES.postPet}>Post a pet</Button>}
            />
          ) : (
            <>
              <div className={styles.filters} role="group" aria-label="Filter listings">
                {FILTERS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={styles.filter}
                    aria-pressed={filter === f.id}
                    onClick={() => setFilter(f.id)}
                  >
                    {f.label} ({countFor(f)})
                  </button>
                ))}
              </div>

              <div className={styles.table} role="table" aria-label="Your listings">
                <div className={styles.headRow} role="row">
                  <span role="columnheader">Pet</span>
                  <span role="columnheader">Status</span>
                  <span role="columnheader">Requests</span>
                  <span role="columnheader">Last updated</span>
                  <span role="columnheader">
                    <span className="visually-hidden">Actions</span>
                    <span aria-hidden="true">Actions</span>
                  </span>
                </div>
                {visible.length === 0 && (
                  <p className={styles.none} role="row">
                    <span role="cell">No listings in this view.</span>
                  </p>
                )}
                {visible.map((row) => (
                  <ListingRow key={row.id} row={row} onAction={(a) => (a === 'resume' ? act(row, 'resume') : setConfirm({ kind: a, row }))} />
                ))}
              </div>
            </>
          )}

          <section className={styles.tip} aria-labelledby="found-home">
            <h2 id="found-home">Found a home?</h2>
            <p>Open Manage to pause a listing, mark your pet as rehomed, or remove it. Keep availability up to date.</p>
          </section>
        </>
      )}

      <Dialog
        open={confirm?.kind === 'rehomed'}
        title={`A happy ending for ${confirm?.row.name ?? ''}?`}
        onClose={() => setConfirm(null)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button onClick={() => confirm && act(confirm.row, 'rehomed')} loading={busy}>
              Confirm rehomed
            </Button>
          </>
        }
      >
        Marking {confirm?.row.name} as rehomed closes the listing and stops new requests. Current applicants will see that
        they’re no longer available.
      </Dialog>
      <Dialog
        open={confirm?.kind === 'pause'}
        title={`Pause ${confirm?.row.name ?? ''}’s listing?`}
        onClose={() => setConfirm(null)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button onClick={() => confirm && act(confirm.row, 'pause')} loading={busy}>
              Pause listing
            </Button>
          </>
        }
      >
        The listing will be hidden from search until you resume it. Existing conversations stay open.
      </Dialog>
      <Dialog
        open={confirm?.kind === 'delete'}
        title={`Remove ${confirm?.row.name ?? ''}’s listing?`}
        onClose={() => setConfirm(null)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => confirm && act(confirm.row, 'delete')} loading={busy}>
              Remove listing
            </Button>
          </>
        }
      >
        This permanently removes the listing and its photos. This can’t be undone.
      </Dialog>
    </AppPage>
  );
}

function ListingRow({ row, onAction }: { row: MyListingRow; onAction: (a: 'pause' | 'resume' | 'rehomed' | 'delete') => void }) {
  const fee = row.fee ? `$${row.fee} fee` : null;
  const primary =
    row.status === 'draft'
      ? { label: 'Continue', to: editListingPath(row.id) }
      : row.status === 'pending' || row.status === 'changes_requested'
        ? { label: 'Edit', to: editListingPath(row.id) }
        : row.status === 'rehomed'
          ? { label: 'View', to: petPath(row.id) }
          : null;

  return (
    <div className={styles.row} role="row">
      <div className={styles.pet} role="cell">
        <span className={`${styles.thumb} ${styles[`tone_${row.artworkTone}`]}`}>
          <img src={row.thumbUrl ?? artworkFor(row.artworkTone)} alt="" />
        </span>
        <span className={styles.petText}>
          <Link to={petPath(row.id)} className={styles.petName}>
            {row.name}
          </Link>
          <span className={styles.petMeta}>{[row.breed, fee].filter(Boolean).join(' · ') || 'Details to come'}</span>
          {row.status === 'changes_requested' && row.moderationNote && <span className={styles.note}>{row.moderationNote}</span>}
        </span>
      </div>
      <div role="cell" className={styles.cell}>
        <span className={styles.mobileLabel}>Status</span>
        <StatusPill status={row.status} />
      </div>
      <div role="cell" className={styles.cell}>
        <span className={styles.mobileLabel}>Requests</span>
        {row.totalRequests > 0 ? (
          <Link to={listingRequestsPath(row.id)} className={styles.requests}>
            {row.newRequests > 0 ? `${row.newRequests} new` : `${row.totalRequests} total`}
          </Link>
        ) : (
          <span aria-label="None">—</span>
        )}
      </div>
      <div role="cell" className={`${styles.cell} ${styles.muted}`}>
        <span className={styles.mobileLabel}>Updated</span>
        {relativeDay(row.updatedAt)}
      </div>
      <div role="cell" className={styles.actionsCell}>
        {primary ? (
          <div className={styles.actionGroup}>
            <Button to={primary.to} variant="secondary" className={styles.action}>
              {primary.label}
            </Button>
            {(row.status === 'draft' || row.status === 'changes_requested') && (
              <button type="button" className={styles.iconAction} onClick={() => onAction('delete')} aria-label={`Remove ${row.name}`}>
                <Icon name="close" size={18} />
              </button>
            )}
          </div>
        ) : (
          <ManageMenu row={row} onAction={onAction} />
        )}
      </div>
    </div>
  );
}

function ManageMenu({ row, onAction }: { row: MyListingRow; onAction: (a: 'pause' | 'resume' | 'rehomed' | 'delete') => void }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const run = (a: 'pause' | 'resume' | 'rehomed' | 'delete') => {
    setOpen(false);
    onAction(a);
  };

  return (
    <div className={styles.menuWrap} ref={ref}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.manage}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
      >
        Manage <span className="visually-hidden">{row.name}</span>
        <Icon name="chevronDown" size={16} />
      </button>
      <ul id={id} role="list" className={styles.menu} hidden={!open}>
        <li>
          <Link to={petPath(row.id)} className={styles.menuItem}>
            View listing
          </Link>
        </li>
        {row.totalRequests > 0 && (
          <li>
            <Link to={listingRequestsPath(row.id)} className={styles.menuItem}>
              Review adoption requests
            </Link>
          </li>
        )}
        {row.status !== 'rejected' && (
          <li>
            <Link to={editListingPath(row.id)} className={styles.menuItem}>
              Edit details
            </Link>
          </li>
        )}
        {row.status === 'live' && (
          <li>
            <button type="button" className={styles.menuItem} onClick={() => run('pause')}>
              Pause listing
            </button>
          </li>
        )}
        {row.status === 'paused' && (
          <li>
            <button type="button" className={styles.menuItem} onClick={() => run('resume')}>
              Resume listing
            </button>
          </li>
        )}
        {(row.status === 'live' || row.status === 'paused') && (
          <li>
            <button type="button" className={styles.menuItem} onClick={() => run('rehomed')}>
              Mark as rehomed
            </button>
          </li>
        )}
        {(row.status === 'paused' || row.status === 'rejected') && (
          <li>
            <button type="button" className={`${styles.menuItem} ${styles.danger}`} onClick={() => run('delete')}>
              Remove listing
            </button>
          </li>
        )}
      </ul>
    </div>
  );
}
