import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Checkbox } from '../../components/ui/Checkbox';
import { PasswordField } from '../../components/ui/PasswordField';
import { PasswordStrength } from '../../components/ui/PasswordStrength';
import { SegmentedChoice, type ChoiceOption } from '../../components/ui/SegmentedChoice';
import { TextField } from '../../components/ui/TextField';
import { ROUTES } from '../../lib/routes';
import { useDocumentTitle } from '../../lib/useDocumentTitle';
import { useAuth } from '../../services/auth/AuthContext';
import { AuthError, type AccountType } from '../../services/auth/types';
import { getPendingSignup, setPendingSignup } from './pendingSignup';
import { hasErrors, validateRegister, type FieldErrors, type RegisterValues } from './validation';
import styles from './AuthPage.module.css';

const ACCOUNT_OPTIONS: ChoiceOption<AccountType>[] = [
  { value: 'individual', label: 'Pet parent' },
  { value: 'organization', label: 'Shelter / rescue' },
];

const ACCOUNT_HELP: Record<AccountType, string> = {
  individual: 'For adopting a companion, or responsibly rehoming a pet you own.',
  organization: 'For shelters and rescues listing animals in their care.',
};

const FIELD_ORDER: (keyof RegisterValues)[] = ['fullName', 'email', 'password', 'location', 'consent'];
const FIELD_IDS: Record<keyof RegisterValues, string> = {
  fullName: 'register-name',
  email: 'register-email',
  password: 'register-password',
  location: 'register-location',
  consent: 'register-consent',
};

export function RegisterPage() {
  useDocumentTitle('Create an account');
  const { user, service, status } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const changingEmail = Boolean((location.state as { changeEmail?: boolean } | null)?.changeEmail);

  // "Use a different email" on the verify screen sends people back here with
  // their earlier (non-secret) answers restored and the email cleared.
  const [restored] = useState(() => {
    if (!changingEmail) return null;
    return getPendingSignup();
  });

  const [accountType, setAccountType] = useState<AccountType>(restored?.accountType ?? 'individual');
  const [organizationName, setOrganizationName] = useState('');
  const [orgError, setOrgError] = useState<string | undefined>();
  const [values, setValues] = useState<RegisterValues>({
    fullName: restored?.fullName ?? '',
    email: '',
    password: '',
    location: restored?.location ?? '',
    consent: false,
  });
  const [errors, setErrors] = useState<FieldErrors<keyof RegisterValues>>({});
  const [attempted, setAttempted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (status === 'ready' && user) return <Navigate to={ROUTES.home} replace />;

  function update<K extends keyof RegisterValues>(key: K, value: RegisterValues[K]) {
    const nextValues = { ...values, [key]: value };
    setValues(nextValues);
    if (attempted) setErrors(validateRegister(nextValues));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setAttempted(true);
    setFormError(null);
    const found = validateRegister(values);
    setErrors(found);
    const orgMissing =
      accountType === 'organization' && organizationName.trim().length < 2 ? 'Enter your shelter or rescue’s name.' : undefined;
    setOrgError(orgMissing);
    if (orgMissing && !hasErrors(found)) {
      document.getElementById('register-org')?.focus();
      return;
    }
    if (hasErrors(found)) {
      const first = FIELD_ORDER.find((k) => found[k]);
      if (first) document.getElementById(FIELD_IDS[first])?.focus();
      return;
    }
    setSubmitting(true);
    try {
      const { email } = await service.register({
        fullName: values.fullName,
        email: values.email,
        password: values.password,
        location: values.location,
        accountType,
        acceptedTerms: values.consent,
        organizationName: accountType === 'organization' ? organizationName.trim() : undefined,
      });
      setPendingSignup({ email, fullName: values.fullName.trim(), location: values.location.trim(), accountType });
      navigate(ROUTES.verifyEmail, { state: { reason: 'registered' } });
    } catch (err) {
      setSubmitting(false);
      if (err instanceof AuthError && err.code === 'VALIDATION' && err.fields) {
        const map: Partial<Record<string, keyof RegisterValues>> = {
          fullName: 'fullName',
          email: 'email',
          password: 'password',
          location: 'location',
          acceptedTerms: 'consent',
        };
        const serverErrors: FieldErrors<keyof RegisterValues> = {};
        for (const [k, v] of Object.entries(err.fields)) {
          const key = map[k];
          if (key) serverErrors[key] = v;
        }
        setErrors(serverErrors);
        setAttempted(true);
        return;
      }
      setFormError(
        err instanceof AuthError && err.code === 'RATE_LIMITED'
          ? 'Too many attempts from this device. Please wait a few minutes and try again.'
          : 'We couldn’t create your account just now. Please try again in a moment.',
      );
    }
  }

  return (
    <AuthLayout>
      <header className={styles.header}>
        <h1 className={styles.title}>A fresh start begins here.</h1>
        <p className={styles.subtitle}>Create your free Pawhaven account.</p>
      </header>

      {restored && (
        <Alert tone="info" className={styles.alert}>
          Enter the email address you’d like to use instead.
        </Alert>
      )}
      {formError && (
        <Alert tone="error" title="Something went wrong." className={styles.alert}>
          {formError}
        </Alert>
      )}

      <form className={styles.form} onSubmit={onSubmit} noValidate aria-label="Create an account">
        <SegmentedChoice
          legend="I’m joining as"
          name="accountType"
          value={accountType}
          options={ACCOUNT_OPTIONS}
          onChange={setAccountType}
          help={ACCOUNT_HELP[accountType]}
        />
        {accountType === 'organization' && (
          <TextField
            id="register-org"
            label="Shelter or rescue name"
            name="organization"
            autoComplete="organization"
            placeholder="Happy Tails Rescue"
            value={organizationName}
            onChange={(e) => {
              setOrganizationName(e.target.value);
              if (orgError) setOrgError(undefined);
            }}
            error={orgError}
            hint="We’ll verify your organization before its listings go live."
            required
          />
        )}
        <TextField
          id={FIELD_IDS.fullName}
          label={accountType === 'organization' ? 'Your full name' : 'Full name'}
          name="name"
          autoComplete="name"
          placeholder="Your name"
          value={values.fullName}
          onChange={(e) => update('fullName', e.target.value)}
          error={errors.fullName}
          hint={accountType === 'organization' ? 'The person managing this organization’s account.' : undefined}
          required
        />
        <TextField
          id={FIELD_IDS.email}
          label="Email address"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          value={values.email}
          onChange={(e) => update('email', e.target.value)}
          error={errors.email}
          autoFocus={Boolean(restored)}
          required
        />
        <PasswordField
          id={FIELD_IDS.password}
          label="Password"
          name="new-password"
          autoComplete="new-password"
          placeholder="Create a strong password"
          value={values.password}
          onChange={(e) => update('password', e.target.value)}
          error={errors.password}
          hint={values.password ? undefined : 'Use 12+ characters, including a number and a symbol.'}
          after={values.password ? <PasswordStrength password={values.password} /> : undefined}
          required
        />
        <TextField
          id={FIELD_IDS.location}
          label="City or ZIP code"
          name="location"
          autoComplete="address-level2"
          placeholder="Austin, TX"
          value={values.location}
          onChange={(e) => update('location', e.target.value)}
          error={errors.location}
          hint="Only your city is shown publicly."
          required
        />
        <Checkbox
          id={FIELD_IDS.consent}
          name="consent"
          checked={values.consent}
          onChange={(e) => update('consent', e.target.checked)}
          error={errors.consent}
          label={
            <>
              I’m 18 or older and agree to the <Link to={ROUTES.terms}>Terms of Use</Link>,{' '}
              <Link to={ROUTES.privacy}>Privacy Policy</Link>, and{' '}
              <Link to={ROUTES.rehomingGuide}>responsible rehoming guidelines</Link>.
            </>
          }
        />
        <Button type="submit" block size="lg" loading={submitting} loadingText="Creating your account…" className={styles.submit}>
          Create account
        </Button>
      </form>

      <p className={styles.switch}>
        Already have an account?
        <Link to={ROUTES.login}>Log in</Link>
      </p>
    </AuthLayout>
  );
}
