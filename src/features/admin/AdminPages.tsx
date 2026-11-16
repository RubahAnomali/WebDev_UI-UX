import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { REPORT_REASON_LABEL } from '../../../shared/constants';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { Icon } from '../../components/ui/Icon';
import { Select } from '../../components/ui/Select';
import { Spinner } from '../../components/ui/Spinner';
import { StatusPill } from '../../components/ui/StatusPill';
import { Textarea } from '../../components/ui/Textarea';
import { petPath } from '../../lib/routes';
import {
  adminService,
  type AdminSummary,
  type AuditItem,
  type MemberItem,
  type OrgItem,
  type ReportDetail,
  type ReportItem,
} from '../../services/admin/adminService';
import { ApiRequestError } from '../../services/api/client';
import { AdminLayout } from './AdminLayout';
import { StatCards } from './ReviewQueuePage';
import styles from './AdminPages.module.css';

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const errText = (err: unknown) => (err instanceof ApiRequestError ? err.message : 'That didn’t work. Please try again.');
const reasonLabel = (r: string) => REPORT_REASON_LABEL[r as keyof typeof REPORT_REASON_LABEL] ?? r;

function useSummary() {
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const reload = useCallback(() => {
    adminService.summary().then(setSummary).catch(() => undefined);
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);
  return { summary, reload };
}

/* ---------------- Reports ---------------- */

export function AdminReportsPage() {
  const { summary, reload } = useSummary();
  const [closed, setClosed] = useState(false);
  const [items, setItems] = useState<ReportItem[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<ReportDetail | null>(null);
  const [status, setStatus] = useState<'resolved' | 'dismissed'>('resolved');
  const [action, setAction] = useState<'none' | 'pause_listing' | 'suspend_user'>('none');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(() => {
    adminService
      .reports(closed)
      .then((list) => {
        setItems(list);
        setSelected((cur) => (cur && list.some((r) => r.id === cur) ? cur : list[0]?.id ?? null));
      })
      .catch(() => setItems([]));
  }, [closed]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!selected) return;
    let active = true;
    adminService.report(selected).then((r) => active && setDetail(r));
    return () => {
      active = false;
    };
  }, [selected]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!detail) return;
    setBusy(true);
    try {
      await adminService.resolve(detail.id, status, note.trim(), status === 'dismissed' ? 'none' : action);
      setMessage({ tone: 'success', text: `Report ${status}.` });
      setNote('');
      setAction('none');
      setDetail(null);
      setSelected(null);
      load();
      reload();
    } catch (err) {
      setMessage({ tone: 'error', text: errText(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminLayout title="Reports">
      <StatCards summary={summary} />
      {message && (
        <Alert tone={message.tone} className={styles.message}>
          {message.text}
        </Alert>
      )}
      <div className={styles.split}>
        <aside className={styles.listCard} aria-label="Reports">
          <div className={styles.listHead}>
            <h2 className={styles.listTitle}>{closed ? 'Closed reports' : `Open reports (${items?.length ?? '–'})`}</h2>
            <button type="button" className={styles.linkButton} onClick={() => setClosed((c) => !c)}>
              {closed ? 'Show open' : 'Show closed'}
            </button>
          </div>
          {!items && <Spinner size={24} label="Loading reports" />}
          {items?.length === 0 && <p className={styles.muted}>{closed ? 'No closed reports yet.' : 'No open reports.'}</p>}
          <ul role="list" className={styles.items}>
            {items?.map((r) => (
              <li key={r.id}>
                <button type="button" className={`${styles.item} ${r.id === selected ? styles.selected : ''}`} onClick={() => setSelected(r.id)}>
                  <Icon name="alert" size={22} className={styles.itemIcon} />
                  <span className={styles.itemText}>
                    <span className={styles.itemName}>{reasonLabel(r.reason)}</span>
                    <span className={styles.itemMeta}>{r.target}</span>
                    <span className={styles.itemSmall}>
                      {r.reporter} · {when(r.createdAt)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className={styles.detail} aria-label="Report details">
          {!detail ? (
            items && items.length === 0 ? (
              <EmptyState tone="plain" title="All clear." text="There are no reports in this view." />
            ) : (
              <div className={styles.center}>
                <Spinner size={28} label="Loading report" />
              </div>
            )
          ) : (
            <>
              <div className={styles.detailHeadRow}>
                <h2 className={styles.detailTitle}>{reasonLabel(detail.reason)}</h2>
                <StatusPill status={detail.status} />
              </div>
              <p className={styles.muted}>
                {detail.target}
                {detail.targetListingId && (
                  <>
                    {' · '}
                    <Link to={petPath(detail.targetListingId)} target="_blank" rel="noopener">
                      Open listing
                    </Link>
                  </>
                )}
              </p>
              <dl className={styles.facts}>
                <div>
                  <dt>Reported by</dt>
                  <dd>
                    {detail.reporter}
                    {detail.reporterEmail ? ` · ${detail.reporterEmail}` : ''}
                  </dd>
                </div>
                <div>
                  <dt>Received</dt>
                  <dd>{when(detail.createdAt)}</dd>
                </div>
                <div>
                  <dt>What happened</dt>
                  <dd>{detail.details}</dd>
                </div>
                {detail.resolutionNote && (
                  <div>
                    <dt>Resolution</dt>
                    <dd>{detail.resolutionNote}</dd>
                  </div>
                )}
              </dl>

              {detail.messages.length > 0 && (
                <details className={styles.fullText} open>
                  <summary>Recent messages in this conversation (access is logged)</summary>
                  <ol className={styles.transcript}>
                    {detail.messages.map((m, i) => (
                      <li key={i}>
                        <strong>{m.from}</strong> · {when(m.at)}
                        <p>{m.body}</p>
                      </li>
                    ))}
                  </ol>
                </details>
              )}

              {detail.status === 'open' && (
                <form className={styles.resolveForm} onSubmit={submit}>
                  <div className={styles.twoCol}>
                    <Select
                      label="Outcome"
                      value={status}
                      onChange={(e) => setStatus(e.target.value as 'resolved' | 'dismissed')}
                      options={[
                        { value: 'resolved', label: 'Resolve (action taken)' },
                        { value: 'dismissed', label: 'Dismiss (no violation)' },
                      ]}
                    />
                    {status === 'resolved' && (
                      <Select
                        label="Enforcement"
                        value={action}
                        onChange={(e) => setAction(e.target.value as typeof action)}
                        options={[
                          { value: 'none', label: 'No enforcement' },
                          ...(detail.targetListingId ? [{ value: 'pause_listing', label: 'Pause the listing' }] : []),
                          ...(detail.targetUserId ? [{ value: 'suspend_user', label: 'Suspend the member' }] : []),
                        ]}
                      />
                    )}
                  </div>
                  <Textarea label="Internal note" rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
                  <div className={styles.actions}>
                    <Button type="submit" disabled={note.trim().length < 3} loading={busy} variant={action === 'suspend_user' ? 'danger' : 'primary'} className={styles.primary}>
                      {status === 'dismissed' ? 'Dismiss report' : action === 'suspend_user' ? 'Resolve and suspend' : 'Resolve report'}
                    </Button>
                  </div>
                </form>
              )}
            </>
          )}
        </section>
      </div>
    </AdminLayout>
  );
}

/* ---------------- Organizations ---------------- */

export function AdminOrganizationsPage() {
  const [items, setItems] = useState<OrgItem[] | null>(null);
  const [rejecting, setRejecting] = useState<OrgItem | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(() => {
    adminService.organizations().then(setItems).catch(() => setItems([]));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function decide(org: OrgItem, decision: 'verify' | 'reject') {
    setBusy(org.id);
    try {
      await adminService.decideOrg(org.id, decision, decision === 'reject' ? note.trim() : undefined);
      setMessage({ tone: 'success', text: decision === 'verify' ? `${org.name} is verified and can now submit listings.` : `${org.name} was not verified.` });
      setRejecting(null);
      setNote('');
      load();
    } catch (err) {
      setMessage({ tone: 'error', text: errText(err) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <AdminLayout title="Organizations">
      <h2 className={styles.sectionTitle}>Shelters &amp; rescues awaiting verification</h2>
      <p className={styles.muted}>Confirm the organization is real (registration, website, references) before verifying.</p>
      {message && (
        <Alert tone={message.tone} className={styles.message}>
          {message.text}
        </Alert>
      )}
      {!items && <Spinner size={28} label="Loading organizations" />}
      {items?.length === 0 && <EmptyState title="No organizations waiting." text="New shelter and rescue accounts will appear here." />}
      <ul role="list" className={styles.cards}>
        {items?.map((o) => (
          <li key={o.id} className={styles.card}>
            <div>
              <p className={styles.cardTitle}>{o.name}</p>
              <p className={styles.muted}>
                {o.city} · Joined {new Date(o.createdAt).toLocaleDateString()}
              </p>
              {o.contact && (
                <p className={styles.small}>
                  Contact: {o.contact.name} · {o.contact.email} · {o.contact.emailVerified ? 'email verified' : 'email not verified'}
                </p>
              )}
            </div>
            <div className={styles.cardActions}>
              <Button onClick={() => decide(o, 'verify')} loading={busy === o.id && !rejecting}>
                Verify
              </Button>
              <button type="button" className={styles.reject} onClick={() => setRejecting(o)}>
                Decline
              </button>
            </div>
          </li>
        ))}
      </ul>
      <Dialog
        open={rejecting !== null}
        title={`Decline ${rejecting?.name ?? ''}?`}
        onClose={() => setRejecting(null)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button variant="danger" disabled={note.trim().length < 10} loading={busy !== null} onClick={() => rejecting && decide(rejecting, 'reject')}>
              Decline verification
            </Button>
          </>
        }
      >
        <Textarea label="Reason (emailed to the organization)" rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} className={styles.dialogField} />
      </Dialog>
    </AdminLayout>
  );
}

/* ---------------- Members ---------------- */

export function AdminMembersPage() {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<MemberItem[] | null>(null);
  const [target, setTarget] = useState<{ member: MemberItem; action: 'suspend' | 'reinstate' } | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const search = useCallback((query: string) => {
    adminService.members(query).then(setItems).catch(() => setItems([]));
  }, []);
  useEffect(() => {
    search('');
  }, [search]);

  async function apply() {
    if (!target) return;
    setBusy(true);
    try {
      await adminService.setMemberStatus(target.member.id, target.action, note.trim());
      setMessage({ tone: 'success', text: `${target.member.name} was ${target.action === 'suspend' ? 'suspended' : 'reinstated'}.` });
      setTarget(null);
      setNote('');
      search(q);
    } catch (err) {
      setMessage({ tone: 'error', text: errText(err) });
      setTarget(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminLayout title="Members">
      <form
        className={styles.searchRow}
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          search(q);
        }}
      >
        <label htmlFor="member-q" className="visually-hidden">
          Search members
        </label>
        <input id="member-q" className={styles.searchInput} type="search" placeholder="Search by name or email" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button type="submit" iconStart={<Icon name="search" size={18} />}>
          Search
        </Button>
      </form>
      {message && (
        <Alert tone={message.tone} className={styles.message}>
          {message.text}
        </Alert>
      )}
      {!items && <Spinner size={28} label="Loading members" />}
      {items?.length === 0 && <EmptyState title="No members found." text="Try a different name or email." />}
      {items && items.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Member</th>
                <th scope="col">Account</th>
                <th scope="col">Roles</th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((m) => (
                <tr key={m.id}>
                  <td>
                    <strong>{m.name}</strong>
                    <br />
                    <span className={styles.small}>{m.email}</span>
                  </td>
                  <td>{m.accountType === 'organization' ? 'Shelter / rescue' : 'Pet parent'}</td>
                  <td>{m.roles.join(', ')}</td>
                  <td>
                    <StatusPill status={m.status === 'active' ? 'live' : 'rejected'} label={m.status === 'active' ? 'Active' : 'Suspended'} />
                  </td>
                  <td>
                    {!m.roles.includes('admin') &&
                      (m.status === 'active' ? (
                        <button type="button" className={styles.reject} onClick={() => setTarget({ member: m, action: 'suspend' })}>
                          Suspend
                        </button>
                      ) : (
                        <button type="button" className={styles.linkButton} onClick={() => setTarget({ member: m, action: 'reinstate' })}>
                          Reinstate
                        </button>
                      ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Dialog
        open={target !== null}
        title={target?.action === 'suspend' ? `Suspend ${target?.member.name}?` : `Reinstate ${target?.member.name}?`}
        onClose={() => setTarget(null)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setTarget(null)}>
              Cancel
            </Button>
            <Button variant={target?.action === 'suspend' ? 'danger' : 'primary'} disabled={note.trim().length < 3} loading={busy} onClick={apply}>
              {target?.action === 'suspend' ? 'Suspend member' : 'Reinstate member'}
            </Button>
          </>
        }
      >
        <p>
          {target?.action === 'suspend'
            ? 'They’ll be signed out everywhere, can’t log in, and their live listings will be paused.'
            : 'They’ll be able to log in again. Paused listings stay paused until they resume them.'}
        </p>
        <Textarea label="Internal note" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} className={styles.dialogField} />
      </Dialog>
    </AdminLayout>
  );
}

/* ---------------- Audit ---------------- */

export function AdminAuditPage() {
  const [items, setItems] = useState<AuditItem[] | null>(null);
  useEffect(() => {
    adminService.audit().then(setItems).catch(() => setItems([]));
  }, []);
  return (
    <AdminLayout title="Audit trail">
      <h2 className={styles.sectionTitle}>Recent actions</h2>
      {!items && <Spinner size={28} label="Loading audit trail" />}
      {items?.length === 0 && <EmptyState title="Nothing recorded yet." />}
      {items && items.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Who</th>
                <th scope="col">Action</th>
                <th scope="col">Details</th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id}>
                  <td className={styles.nowrap}>{when(a.at)}</td>
                  <td>{a.actor}</td>
                  <td>
                    <code className={styles.code}>{a.action}</code>
                  </td>
                  <td className={styles.small}>
                    {a.entityType}
                    {a.entityId ? ` ${a.entityId.slice(0, 8)}…` : ''}
                    {a.data && Object.keys(a.data).length > 0
                      ? ` · ${Object.entries(a.data)
                          .filter(([, v]) => v !== null && v !== '')
                          .map(([k, v]) => `${k}: ${String(v)}`)
                          .join(' · ')}`
                      : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  );
}
