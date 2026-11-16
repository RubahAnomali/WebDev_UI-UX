import { useParams } from 'react-router-dom';
import emblem from '../../assets/figma/emblem-email.svg';
import { AppPageShell } from '../../components/layout/AppPageShell';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { StatusPill } from '../../components/ui/StatusPill';
import { conversationPath, requestPath, ROUTES } from '../../lib/routes';
import { useDocumentTitle } from '../../lib/useDocumentTitle';
import { useMyRequest } from './useRequest';
import styles from './RequestSentPage.module.css';

/** Figma 12:38 — Adoption request sent. */
export function RequestSentPage() {
  const { requestId = '' } = useParams();
  const { state } = useMyRequest(requestId);
  useDocumentTitle('Adoption request sent');

  if (state.kind !== 'ready') {
    return (
      <AppPageShell>
        <div className={styles.center}>
          <Spinner size={32} label="Loading" />
        </div>
      </AppPageShell>
    );
  }
  const { request } = state;
  const pet = request.listing.name;
  const lister = request.listing.listerName === 'Private pet parent' ? 'the pet parent' : request.listing.listerName;

  return (
    <AppPageShell>
      <div className={`container ${styles.wrap}`}>
        <section className={styles.card} aria-labelledby="sent-title">
          <img src={emblem} alt="" className={styles.emblem} />
          <h1 id="sent-title" className={styles.title}>
            A lovely first step.
          </h1>
          <p className={styles.text} role="status">
            Your adoption request to meet {pet} has been sent to {lister}.
            <br />
            You can follow the conversation in your messages.
          </p>
          <StatusPill status="approved" label="Adoption request received" />
          <div className={styles.next}>
            <h2>Your next chapter</h2>
            <ol>
              <li>
                <span>01</span> {lister.charAt(0).toUpperCase() + lister.slice(1)} reviews your home and care details.
              </li>
              <li>
                <span>02</span> They’ll contact you through Pawhaven with next steps.
              </li>
              <li>
                <span>03</span> Meet {pet} in person before making any commitment.
              </li>
            </ol>
          </div>
          <div className={styles.actions}>
            <Button to={request.conversationId ? conversationPath(request.conversationId) : ROUTES.messages} size="lg">
              Go to messages
            </Button>
            <Button to={requestPath(request.id)} variant="secondary" size="lg">
              Track your request
            </Button>
          </div>
        </section>
      </div>
    </AppPageShell>
  );
}
