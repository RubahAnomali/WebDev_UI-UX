import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { HOME_TYPE_LABEL, HOUSING_LABEL } from '../../../shared/schemas/requests';
import { AppPage } from '../../components/layout/AppPage';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { Icon } from '../../components/ui/Icon';
import { Spinner } from '../../components/ui/Spinner';
import { StatusPill } from '../../components/ui/StatusPill';
import { Textarea } from '../../components/ui/Textarea';
import { conversationPath, editListingPath, ROUTES } from '../../lib/routes';
import { ApiRequestError } from '../../services/api/client';
import { refreshCounts } from '../../services/me/useCounts';
import { requestsService, type IncomingRequest } from '../../services/requests/requestsService';
import styles from './ListingRequestsPage.module.css';

type Filter = 'open' | 'all' | 'closed';
type Action = 'invite' | 'approve' | 'decline';
const OPEN = ['sent', 'in_review', 'meet_invited'];

const formatAt = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/** Figma 14:59 — Review adoption requests (lister view). */
export function ListingRequestsPage() {
  const { listingId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<{ listing: { id: string; name: string; status: string }; items: IncomingRequest[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<Filter>('open');
  const [detail, setDetail] = useState<IncomingRequest | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const selectedId = params.get('request');

  const load = useCallback(() => {
    requestsService
      .forListing(listingId)
      .then(setData)
      .catch(() => setFailed(true));
  }, [listingId]);

  useEffect(() => {
    load();
  }, [load]);

  // Open the selected request (this marks it read on the server).
  useEffect(() => {
    if (!data) return;
    const id = selectedId ?? data.items.find((r) => OPEN.includes(r.status))?.id ?? data.items[0]?.id;
    if (!id) return;
    let active = true;
    requestsService
      .open(id)
      .then((r) => {
        if (!active) return;
        setDetail(r);
        setData((d) => (d && d.items.some((i) => i.id === r.id && i.unread) ? { ...d, items: d.items.map((i) => (i.id === r.id ? { ...i, unread: false } : i)) } : d));
        refreshCounts();
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [data, selectedId]);

  async function decide() {
    if (!detail || !action) return;
    setBusy(true);
    try {
      const updated = await requestsService.decide(detail.id, action, note.trim() || undefined);
      setDetail(updated);
      setData((d) => (d ? { ...d, items: d.items.map((r) => (r.id === updated.id ? { ...updated, unread: false } : r)) } : d));
      const first = updated.applicant.name.split(' ')[0];
      setMessage({
        tone: 'success',
        text: {
          invite: `${first} has been invited to meet. Plan the details in Messages.`,
          approve: `You approved ${first}’s adoption request. When the adoption is complete, mark the listing as rehomed.`,
          decline: `${first}’s request was closed. They’ve been notified kindly.`,
        }[action],
      });
      setAction(null);
      setNote('');
    } catch (err) {
      setMessage({ tone: 'error', text: err instanceof ApiRequestError ? err.message : 'That didn’t work. Please try again.' });
      setAction(null);
    } finally {
      setBusy(false);
    }
  }

  const items = data?.items ?? [];
  const visible = items.filter((r) => (filter === 'all' ? true : filter === 'open' ? OPEN.includes(r.status) : !OPEN.includes(r.status)));
  const newCount = items.filter((r) => r.unread).length;
  const petName = data?.listing.name ?? 'your pet';
  const first = detail?.applicant.name.split(' ')[0] ?? '';

  return (
    <AppPage
      title="Good homes start with good questions."
      documentTitle={`Adoption requests for ${petName}`}
      subtitle={`Review adoption requests for ${petName}. Personal details are visible only to you.`}
    >
      {message && (
        <Alert tone={message.tone} className={styles.message}>
          {message.text}
        </Alert>
      )}
      {!data && !failed && (
        <div className={styles.center}>
          <Spinner size={32} label="Loading requests" />
        </div>
      )}
      {failed && (
        <EmptyState title="We couldn’t find those requests." text="This listing may not be yours, or it was removed." action={<Button to={ROUTES.myListings}>Back to My listings</Button>} />
      )}
      {data && items.length === 0 && (
        <EmptyState
          title="No adoption requests yet."
          text={`When someone sends a request for ${petName}, it will appear here.`}
          action={<Button to={ROUTES.myListings}>Back to My listings</Button>}
        />
      )}

      {data && items.length > 0 && (
        <div className={styles.layout}>
          <aside className={styles.listCard} aria-label="Requests">
            <h2 className={styles.listTitle}>
              {petName} · {newCount > 0 ? `${newCount} new` : items.length} {newCount === 1 || (!newCount && items.length === 1) ? 'request' : 'requests'}
            </h2>
            <label className={styles.filterLabel} htmlFor="req-filter">
              Filter requests
            </label>
            <div className={styles.selectWrap}>
              <select id="req-filter" className={styles.select} value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
                <option value="open">Open requests</option>
                <option value="all">All requests</option>
                <option value="closed">Closed requests</option>
              </select>
              <Icon name="chevronDown" size={16} className={styles.chevron} />
            </div>
            <ul role="list" className={styles.list}>
              {visible.length === 0 && <li className={styles.none}>No requests in this view.</li>}
              {visible.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className={`${styles.item} ${detail?.id === r.id ? styles.selected : ''}`}
                    aria-current={detail?.id === r.id ? 'true' : undefined}
                    onClick={() => setParams({ request: r.id }, { replace: true })}
                  >
                    <Icon name="paw" size={24} className={styles.itemIcon} />
                    <span className={styles.itemText}>
                      <span className={styles.itemName}>
                        {r.applicant.name}
                        {r.unread && <span className={styles.dot} aria-label="new" />}
                      </span>
                      <span className={styles.itemMeta}>{formatAt(r.createdAt)}</span>
                      <span className={styles.itemLink}>
                        View request <Icon name="arrowRight" size={14} />
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <Link to={editListingPath(listingId)} className={styles.manage}>
              Manage listing <Icon name="arrowRight" size={14} />
            </Link>
          </aside>

          <section className={styles.detail} aria-live="polite" aria-label="Request details">
            {!detail ? (
              <div className={styles.center}>
                <Spinner size={28} label="Loading request" />
              </div>
            ) : (
              <>
                <div className={styles.detailHead}>
                  <Icon name="paw" size={40} className={styles.itemIcon} />
                  <div className={styles.detailWho}>
                    <h2>{detail.applicant.name}</h2>
                    <p>
                      Request for {petName} · {detail.applicant.city}
                    </p>
                  </div>
                  <StatusPill status={detail.status} label={detail.status === 'in_review' ? 'New request' : undefined} />
                </div>

                <dl className={styles.facts}>
                  <div>
                    <dt>Household</dt>
                    <dd>{detail.household}</dd>
                  </div>
                  <div>
                    <dt>Home</dt>
                    <dd>
                      {HOME_TYPE_LABEL[detail.homeType as keyof typeof HOME_TYPE_LABEL] ?? detail.homeType} ·{' '}
                      {HOUSING_LABEL[detail.housingPermission as keyof typeof HOUSING_LABEL] ?? detail.housingPermission}
                    </dd>
                  </div>
                  <div>
                    <dt>Other pets</dt>
                    <dd>{detail.otherPets || 'None mentioned'}</dd>
                  </div>
                  <div>
                    <dt>Experience</dt>
                    <dd>{detail.experience || 'Not shared'}</dd>
                  </div>
                  <div>
                    <dt>Contact</dt>
                    <dd>
                      {detail.applicant.email}
                      {detail.applicant.phone ? ` · ${detail.applicant.phone}` : ''}
                    </dd>
                  </div>
                </dl>

                <h3 className={styles.why}>Why {petName}?</h3>
                <p className={styles.quote}>“{detail.message}”</p>

                <p className={styles.tip}>
                  Take your time. Ask questions and meet safely. An invitation to meet does not finalize an adoption or share your private
                  address.
                </p>

                <div className={styles.actions}>
                  {['sent', 'in_review'].includes(detail.status) && (
                    <Button onClick={() => setAction('invite')} className={styles.primary}>
                      Invite to meet
                    </Button>
                  )}
                  {detail.status === 'meet_invited' && (
                    <Button onClick={() => setAction('approve')} className={styles.primary}>
                      Approve adoption
                    </Button>
                  )}
                  {detail.conversationId && (
                    <Button to={conversationPath(detail.conversationId)} variant="secondary" className={styles.primary}>
                      Message {first}
                    </Button>
                  )}
                  {OPEN.includes(detail.status) && (
                    <button type="button" className={styles.decline} onClick={() => setAction('decline')}>
                      Decline request
                    </button>
                  )}
                </div>
                <p className={styles.small}>Contact details are shared only through the adoption request process.</p>
              </>
            )}
          </section>
        </div>
      )}

      {data && (
        <div className={styles.back}>
          <Button to={ROUTES.myListings} variant="secondary">
            Back to My listings
          </Button>
        </div>
      )}

      <Dialog
        open={action !== null}
        title={
          action === 'invite' ? `Invite ${first} to meet ${petName}?` : action === 'approve' ? `Approve ${first}’s request?` : `Decline ${first}’s request?`
        }
        onClose={() => setAction(null)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setAction(null)}>
              Cancel
            </Button>
            <Button variant={action === 'decline' ? 'danger' : 'primary'} onClick={decide} loading={busy}>
              {action === 'invite' ? 'Send invitation' : action === 'approve' ? 'Approve adoption' : 'Decline request'}
            </Button>
          </>
        }
      >
        <p>
          {action === 'invite'
            ? `${first} will be invited to arrange a safe, in-person meet-and-greet. You’ll plan the details in Messages.`
            : action === 'approve'
              ? `${first} will be told the adoption is approved. Complete any paperwork in person — no payments go through Pawhaven.`
              : `${first} will be told this wasn’t a match. A kind note helps.`}
        </p>
        <Textarea
          label="Add a note (optional)"
          rows={3}
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className={styles.noteField}
        />
      </Dialog>
    </AppPage>
  );
}
