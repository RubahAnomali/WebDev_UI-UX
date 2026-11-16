import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AppPage } from '../../components/layout/AppPage';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { Icon } from '../../components/ui/Icon';
import { Spinner } from '../../components/ui/Spinner';
import { StatusPill } from '../../components/ui/StatusPill';
import { conversationPath, petPath, ROUTES } from '../../lib/routes';
import { ApiRequestError } from '../../services/api/client';
import { artworkFor } from '../../services/pets/artwork';
import { requestsService, type MyRequest } from '../../services/requests/requestsService';
import { useMyRequest } from './useRequest';
import styles from './RequestStatusPage.module.css';

const STEPS = [
  { status: 'sent', title: 'Request sent' },
  { status: 'in_review', title: 'Under review' },
  { status: 'meet_invited', title: 'Meet & greet' },
  { status: 'approved', title: 'Welcome home' },
] as const;

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function describe(step: (typeof STEPS)[number]['status'], lister: string, pet: string) {
  return {
    sent: `Your adoption request reached ${lister}.`,
    in_review: `${cap(lister)} will review your home and lifestyle.`,
    meet_invited: `Arrange a safe meeting if ${lister} thinks it’s a fit.`,
    approved: `Complete ${lister}’s adoption process together and welcome ${pet} home.`,
  }[step];
}

const formatAt = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/** Figma 14:45 — Adoption request status. */
export function RequestStatusPage() {
  const { requestId = '' } = useParams();
  const { state, setState } = useMyRequest(requestId);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (state.kind === 'loading') {
    return (
      <AppPage title="Your next chapter is in motion." documentTitle="Adoption request">
        <div className={styles.center}>
          <Spinner size={32} label="Loading your request" />
        </div>
      </AppPage>
    );
  }
  if (state.kind === 'missing') {
    return (
      <AppPage title="We couldn’t find that request." documentTitle="Adoption request">
        <EmptyState title="This request isn’t available." text="It may have been removed." action={<Button to={ROUTES.requests}>My adoption requests</Button>} />
      </AppPage>
    );
  }

  const { request } = state;
  const { listing } = request;
  const lister = listing.listerType === 'organization' ? listing.listerName : 'the pet parent';
  const listerShort = listing.listerType === 'organization' ? listing.listerName.split(' ').slice(0, 2).join(' ') : 'the pet parent';
  const reached = new Map(request.events.map((e) => [e.status, e]));
  const closed = request.status === 'declined' || request.status === 'withdrawn';
  const currentIndex = STEPS.findIndex((s) => s.status === request.status);
  const open = ['sent', 'in_review', 'meet_invited'].includes(request.status);
  const lastNote = [...request.events].reverse().find((e) => e.note)?.note;

  async function withdraw() {
    setBusy(true);
    try {
      const updated = await requestsService.withdraw(request.id);
      setState({ kind: 'ready', request: updated as MyRequest });
      setConfirm(false);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'We couldn’t withdraw your request. Please try again.');
      setConfirm(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppPage
      title="Your next chapter is in motion."
      documentTitle={`Adoption request for ${listing.name}`}
      subtitle="Track your adoption request and keep the conversation going."
    >
      {error && (
        <Alert tone="error" className={styles.alert}>
          {error}
        </Alert>
      )}
      <div className={styles.layout}>
        <div className={styles.main}>
          <Link to={petPath(listing.id)} className={styles.petCard}>
            <span className={`${styles.thumb} ${styles[`tone_${listing.artworkTone}`]}`}>
              <img src={listing.thumbUrl ?? artworkFor(listing.artworkTone)} alt="" />
            </span>
            <span>
              <span className={styles.petName}>{listing.name}</span>
              <span className={styles.petMeta}>{[listing.breed, listing.ageLabel].filter(Boolean).join(' · ')}</span>
              <span className={styles.petSmall}>{[listing.listerName, listing.city].filter(Boolean).join(' · ')}</span>
            </span>
          </Link>

          <section className={styles.timelineCard} aria-labelledby="req-title">
            <div className={styles.timelineHead}>
              <h2 id="req-title">Adoption request</h2>
              <StatusPill status={request.status} />
            </div>

            {closed && (
              <Alert tone="info" className={styles.closed} title={request.status === 'withdrawn' ? 'You withdrew this request.' : 'This request is closed.'}>
                {request.status === 'declined'
                  ? lastNote ?? `${listing.name} wasn’t a match this time. There are more companions waiting for a loving home.`
                  : 'You can send a new request any time while the listing is open.'}{' '}
                <Link to={ROUTES.findPet}>Find other pets</Link>
              </Alert>
            )}

            <ol className={styles.timeline}>
              {STEPS.map((step, i) => {
                const event = reached.get(step.status);
                const done = Boolean(event) && (i < currentIndex || request.status === 'approved' || (closed && Boolean(event)));
                const current = !closed && i === currentIndex && request.status !== 'approved';
                return (
                  <li key={step.status} className={`${styles.step} ${done ? styles.done : ''} ${current ? styles.current : ''}`}>
                    <span className={styles.marker} aria-hidden="true">
                      {done || (current && step.status === 'sent') ? <Icon name="check" size={14} strokeWidth={2.4} /> : i + 1}
                    </span>
                    <div>
                      <p className={styles.stepTitle}>
                        {step.title}
                        <span className="visually-hidden">{done ? ' — done' : current ? ' — current step' : ' — upcoming'}</span>
                      </p>
                      <p className={styles.stepText}>
                        {event ? `${formatAt(event.at)} · ` : ''}
                        {describe(step.status, lister, listing.name)}
                      </p>
                      {event?.note && <p className={styles.note}>“{event.note}”</p>}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
          <div>
            <Button to={ROUTES.findPet} variant="secondary" className={styles.explore}>
              Continue exploring
            </Button>
          </div>
        </div>

        <aside className={styles.side}>
          <div className={styles.sideCard}>
            <h2 className={styles.sideTitle}>Stay connected</h2>
            <p className={styles.sideText}>
              {open ? 'You can ask questions while your adoption request is being reviewed.' : 'Your conversation stays available in Messages.'}
            </p>
            <div className={styles.sideActions}>
              {request.conversationId && (
                <Button to={conversationPath(request.conversationId)} block>
                  Message {listerShort}
                </Button>
              )}
              <Button to={petPath(listing.id)} variant="secondary" block>
                View {listing.name}’s profile
              </Button>
              {open && (
                <button type="button" className={styles.withdraw} onClick={() => setConfirm(true)}>
                  Withdraw request
                </button>
              )}
            </div>
          </div>
          <p className={styles.safety}>
            Please don’t send a deposit before meeting.
            <br />
            Pawhaven does not collect adoption payments.
          </p>
        </aside>
      </div>

      <Dialog
        open={confirm}
        title="Withdraw your request?"
        onClose={() => setConfirm(false)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirm(false)}>
              Keep request
            </Button>
            <Button variant="danger" onClick={withdraw} loading={busy}>
              Withdraw request
            </Button>
          </>
        }
      >
        {listing.name}’s lister will see that you’ve withdrawn. You can send a new request later while the listing is open.
      </Dialog>
    </AppPage>
  );
}
