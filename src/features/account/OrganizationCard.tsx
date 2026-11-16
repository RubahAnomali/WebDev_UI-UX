import { useState } from 'react';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { StatusPill } from '../../components/ui/StatusPill';
import { accountService } from '../../services/account/accountService';
import { ApiRequestError } from '../../services/api/client';
import { useAuth } from '../../services/auth/AuthContext';
import { OrgEvidenceFields, ORG_ORDER, validateOrg, type OrgValues } from '../auth/OrgEvidenceFields';
import styles from './AccountPage.module.css';

const STATUS = {
  pending: { pill: 'pending', label: 'Verification in progress' },
  verified: { pill: 'verified', label: 'Verified shelter / rescue' },
  rejected: { pill: 'rejected', label: 'Not verified' },
  not_applicable: { pill: 'draft', label: 'Not applicable' },
} as const;

/** Shelter / rescue verification details (Account & privacy). */
export function OrganizationCard() {
  const { user, setUser } = useAuth();
  const org = user?.organization;
  const [values, setValues] = useState<OrgValues>({
    organizationName: org?.name ?? '',
    registrationNumber: org?.registrationNumber ?? '',
    website: org?.website ?? '',
    reference: org?.reference ?? '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof OrgValues, string>>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  if (!org) return null;

  const verified = org.verification === 'verified';
  const missingEvidence = !org.registrationNumber || !(org.website || org.reference);
  const status = STATUS[org.verification];

  async function save() {
    setMessage(null);
    const found = validateOrg(values);
    setErrors(found);
    const first = ORG_ORDER.find((k) => found[k]);
    if (first) {
      document.getElementById(`org-${first}`)?.focus();
      return;
    }
    setBusy(true);
    try {
      const res = await accountService.updateOrganization(values);
      setUser(res.user);
      setMessage({ tone: 'success', text: 'Thanks — our team will review your organization details.' });
    } catch (err) {
      if (err instanceof ApiRequestError && err.fields) setErrors(err.fields);
      setMessage({ tone: 'error', text: err instanceof ApiRequestError ? err.message : 'We couldn’t save these details.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.card} aria-labelledby="acc-org">
      <div className={styles.cardHead}>
        <h2 id="acc-org" className={styles.cardTitle}>
          Organization details
        </h2>
        <StatusPill status={status.pill} label={status.label} />
      </div>

      {org.verification === 'rejected' && (
        <Alert tone="warning" className={styles.cardAlert} title="We couldn’t verify your organization yet.">
          {org.note ?? 'Please check your details below.'} Update them and we’ll review again.
        </Alert>
      )}
      {org.verification === 'pending' && missingEvidence && (
        <Alert tone="info" className={styles.cardAlert} title="Add your verification details.">
          We need your registration number and a website or reference before we can verify your organization.
        </Alert>
      )}
      {message && (
        <Alert tone={message.tone} className={styles.cardAlert}>
          {message.text}
        </Alert>
      )}

      {verified ? (
        <dl className={styles.orgFacts}>
          <div>
            <dt>Name</dt>
            <dd>{org.name}</dd>
          </div>
          <div>
            <dt>Registration number</dt>
            <dd>{org.registrationNumber ?? '—'}</dd>
          </div>
          {org.website && (
            <div>
              <dt>Website</dt>
              <dd>{org.website}</dd>
            </div>
          )}
          <p className={styles.small}>Verified details are locked. Contact support if something changes.</p>
        </dl>
      ) : (
        <>
          <OrgEvidenceFields
            idPrefix="org"
            values={values}
            errors={errors}
            onChange={(key, value) => {
              setValues((v) => ({ ...v, [key]: value }));
              if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
            }}
          />
          <div className={styles.orgSave}>
            <Button variant="secondary" onClick={save} loading={busy} loadingText="Saving…">
              Save organization details
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
