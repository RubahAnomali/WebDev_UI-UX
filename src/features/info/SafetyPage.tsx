import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { REPORT_REASON_LABEL, REPORT_REASONS } from '../../../shared/constants';
import { reportSchema } from '../../../shared/schemas/reports';
import { AppPage } from '../../components/layout/AppPage';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { TextField } from '../../components/ui/TextField';
import { ROUTES } from '../../lib/routes';
import { ApiRequestError, http } from '../../services/api/client';
import { useAuth } from '../../services/auth/AuthContext';
import styles from './SafetyPage.module.css';

const TIPS = [
  { title: 'Meet thoughtfully', text: ['Arrange a safe meet-and-greet.', 'Never send a deposit before meeting.'] },
  { title: 'Ask the right questions', text: ['Discuss health, care, and behavior.', 'Request veterinary records privately.'] },
  { title: 'Keep welfare first', text: ['No wildlife, illegal sales, or pet shipping.', 'Rehome responsibly, never in a rush.'] },
];

const FAQ = [
  {
    q: 'How does adoption work?',
    a: 'Start with an adoption request, chat, and a safe meeting. The shelter or pet parent handles the final adoption.',
  },
  {
    q: 'How do I spot a scam?',
    a: 'Be wary of urgent deposits, shipping offers, gift cards or payment apps, and anyone refusing an in-person meeting.',
  },
  {
    q: 'What can I post?',
    a: 'Only pets you own or are authorized to represent. No wildlife, endangered animals, or prohibited trade.',
  },
  {
    q: 'What if an animal is in danger?',
    a: 'For immediate danger, contact local animal welfare authorities or emergency services first, then let us know.',
  },
];

const TARGETS = [
  { value: 'listing', label: 'A listing' },
  { value: 'conversation', label: 'A conversation' },
  { value: 'user', label: 'A member' },
  { value: 'other', label: 'Something else' },
];

/** Figma 14:65 — Safety & support, with the frame-22 “thank you” state. */
export function SafetyPage() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const preType = params.get('report');
  const preId = params.get('id');
  const [form, setForm] = useState({
    targetType: TARGETS.some((t) => t.value === preType) ? (preType as string) : 'listing',
    link: preId ? `${window.location.origin}/${preType === 'conversation' ? 'messages' : 'pets'}/${preId}` : '',
    reason: '',
    details: '',
    email: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const set = (k: keyof typeof form, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: '' }));
  };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const payload = { ...form, email: user ? undefined : form.email || undefined };
    const result = reportSchema.safeParse(payload);
    const found: Record<string, string> = {};
    if (!result.success) for (const i of result.error.issues) found[String(i.path[0])] ??= i.message;
    if (!user && !form.email) found.email = 'Add an email so we can follow up.';
    if ((form.targetType === 'listing' || form.targetType === 'conversation') && !form.link.trim()) {
      found.link = 'Paste the Pawhaven link.';
    }
    setErrors(found);
    if (Object.keys(found).length) {
      const first = ['targetType', 'link', 'reason', 'details', 'email'].find((k) => found[k]);
      document.getElementById(`rp-${first}`)?.focus();
      return;
    }
    setSending(true);
    try {
      await http.post('/api/reports', payload);
      setSent(true);
    } catch (err) {
      if (err instanceof ApiRequestError && err.fields) setErrors(err.fields);
      setFormError(err instanceof ApiRequestError ? err.message : 'We couldn’t send your report. Please try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <AppPage title="A safer place for every paw." documentTitle="Safety & support" subtitle="Practical guidance, clear rules, and help when something doesn’t feel right.">
      <ol className={styles.tips} aria-label="Safety basics">
        {TIPS.map((t, i) => (
          <li key={t.title}>
            <span className={styles.num} aria-hidden="true">
              {String(i + 1).padStart(2, '0')}
            </span>
            <h2 className={styles.tipTitle}>{t.title}</h2>
            <p className={styles.tipText}>
              {t.text[0]}
              <br />
              {t.text[1]}
            </p>
          </li>
        ))}
      </ol>

      <div className={styles.columns}>
        <section className={styles.card} aria-labelledby="faq-title">
          <h2 id="faq-title" className={styles.cardTitle}>
            Here when you need us.
          </h2>
          <dl className={styles.faq}>
            {FAQ.map((f) => (
              <div key={f.q}>
                <dt>{f.q}</dt>
                <dd>{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section id="report" className={styles.card} aria-labelledby="report-title" tabIndex={-1}>
          {sent ? (
            <EmptyState
              tone="plain"
              title="Thank you for speaking up."
              text={
                <>
                  Your report has been received.
                  <br />
                  Our moderation team will review it.
                  <br />
                  For immediate danger, contact local authorities.
                </>
              }
              action={<Button to={ROUTES.home}>Return to Pawhaven</Button>}
            />
          ) : (
            <>
              <h2 id="report-title" className={styles.cardTitle}>
                Something doesn’t feel right?
              </h2>
              <p className={styles.lead}>Reports are private and reviewed by our moderation team.</p>
              {formError && (
                <Alert tone="error" className={styles.alert}>
                  {formError}
                </Alert>
              )}
              <form className={styles.form} onSubmit={onSubmit} noValidate aria-label="Report a concern">
                <Select id="rp-targetType" label="What are you reporting? *" options={TARGETS} value={form.targetType} onChange={(e) => set('targetType', e.target.value)} />
                {form.targetType !== 'other' && (
                  <TextField
                    id="rp-link"
                    label={form.targetType === 'conversation' ? 'Conversation link *' : form.targetType === 'user' ? 'Link to their listing or profile' : 'Listing link *'}
                    placeholder="Paste the Pawhaven link"
                    value={form.link}
                    error={errors.link}
                    onChange={(e) => set('link', e.target.value)}
                  />
                )}
                <Select
                  id="rp-reason"
                  label="Reason *"
                  placeholder="Choose a reason"
                  options={REPORT_REASONS.map((r) => ({ value: r, label: REPORT_REASON_LABEL[r] }))}
                  value={form.reason}
                  error={errors.reason}
                  onChange={(e) => set('reason', e.target.value)}
                />
                <Textarea
                  id="rp-details"
                  label="Tell us what happened *"
                  rows={3}
                  maxLength={2000}
                  placeholder="Include relevant details. Don’t include sensitive personal information."
                  value={form.details}
                  error={errors.details}
                  onChange={(e) => set('details', e.target.value)}
                />
                {!user && (
                  <TextField
                    id="rp-email"
                    label="Your email *"
                    type="email"
                    autoComplete="email"
                    hint="We’ll only use it to follow up on this report."
                    value={form.email}
                    error={errors.email}
                    onChange={(e) => set('email', e.target.value)}
                  />
                )}
                <Button type="submit" size="lg" block loading={sending} loadingText="Sending…">
                  Submit report
                </Button>
              </form>
            </>
          )}
        </section>
      </div>
    </AppPage>
  );
}
