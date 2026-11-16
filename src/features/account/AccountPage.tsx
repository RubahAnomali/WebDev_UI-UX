import { useEffect, useState, type FormEvent } from 'react';
import { NavLink } from 'react-router-dom';
import { AppPage } from '../../components/layout/AppPage';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { Icon } from '../../components/ui/Icon';
import { PasswordField } from '../../components/ui/PasswordField';
import { PasswordStrength } from '../../components/ui/PasswordStrength';
import { Spinner } from '../../components/ui/Spinner';
import { Switch } from '../../components/ui/Switch';
import { TextField } from '../../components/ui/TextField';
import { ROUTES } from '../../lib/routes';
import { accountService, type Prefs } from '../../services/account/accountService';
import { ApiRequestError } from '../../services/api/client';
import { useAuth } from '../../services/auth/AuthContext';
import { validateEmail, validateNewPassword } from '../auth/validation';
import { OrganizationCard } from './OrganizationCard';
import styles from './AccountPage.module.css';

const NAV = [
  { label: 'Profile & privacy', to: ROUTES.account },
  { label: 'My listings', to: ROUTES.myListings },
  { label: 'Adoption requests', to: ROUTES.requests },
  { label: 'Saved pets', to: ROUTES.saved },
  { label: 'Messages', to: ROUTES.messages },
  { label: 'Safety & support', to: ROUTES.safety },
];

type DialogKind = 'password' | 'email' | 'logout' | 'delete' | null;

/** Figma 14:63 — Account & privacy. */
export function AccountPage() {
  const { user, setUser } = useAuth();
  const [profile, setProfile] = useState({ fullName: user?.fullName ?? '', location: user?.location ?? '', phone: user?.phone ?? '' });
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [dialog, setDialog] = useState<DialogKind>(null);

  useEffect(() => {
    accountService
      .get()
      .then((r) => {
        setPrefs(r.prefs);
        setProfile({ fullName: r.user.fullName, location: r.user.location, phone: r.user.phone ?? '' });
      })
      .catch(() => setMessage({ tone: 'error', text: 'We couldn’t load your account. Please refresh.' }));
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    const found: Record<string, string> = {};
    if (profile.fullName.trim().length < 2) found.fullName = 'Enter your full name.';
    if (profile.location.trim().length < 2) found.location = 'Enter your city or ZIP code.';
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    try {
      const res = await accountService.update({ ...profile, prefs: prefs ?? undefined });
      setUser(res.user);
      setPrefs(res.prefs);
      setMessage({ tone: 'success', text: 'Your profile changes have been saved.' });
    } catch (err) {
      if (err instanceof ApiRequestError && err.fields) setErrors(err.fields);
      setMessage({ tone: 'error', text: err instanceof ApiRequestError ? err.message : 'We couldn’t save your changes.' });
    } finally {
      setSaving(false);
    }
  }

  if (!user) return null;

  return (
    <AppPage title="Your account. Your peace of mind." documentTitle="Account & privacy" subtitle="Keep your profile current and choose what you share.">
      <div className={styles.layout}>
        <nav className={styles.nav} aria-label="Account">
          <ul role="list">
            {NAV.map((n) => (
              <li key={n.to}>
                <NavLink to={n.to} end className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navActive : ''}`}>
                  {n.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <form className={styles.main} onSubmit={save} noValidate>
          {message && (
            <Alert tone={message.tone} className={styles.message}>
              {message.text}
            </Alert>
          )}

          <section className={styles.card} aria-labelledby="acc-profile">
            <h2 id="acc-profile" className={styles.cardTitle}>
              Profile details
            </h2>
            <div className={styles.grid}>
              <TextField
                label="Full name"
                autoComplete="name"
                value={profile.fullName}
                error={errors.fullName}
                onChange={(e) => setProfile((p) => ({ ...p, fullName: e.target.value }))}
              />
              <div className={styles.emailField}>
                <TextField label="Email address" value={user.email} readOnly />
                <button type="button" className={styles.inlineLink} onClick={() => setDialog('email')}>
                  Change email
                </button>
              </div>
              <TextField
                label="City / ZIP code"
                autoComplete="address-level2"
                value={profile.location}
                error={errors.location}
                onChange={(e) => setProfile((p) => ({ ...p, location: e.target.value }))}
              />
              <div className={styles.verified}>
                {user.emailVerified && (
                  <p className={styles.verifiedLine}>
                    <Icon name="check" size={14} strokeWidth={2.4} /> Email verified
                  </p>
                )}
                <p className={styles.small}>Your public profile shows your first name and city only.</p>
              </div>
              <TextField
                label="Phone number (optional)"
                type="tel"
                autoComplete="tel"
                value={profile.phone}
                error={errors.phone}
                hint="Only shared when you send an adoption request. Never shown on listings."
                onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
              />
            </div>
          </section>

          {user.accountType === 'organization' && user.organization && <OrganizationCard />}

          <section className={styles.card} aria-labelledby="acc-notify">
            <h2 id="acc-notify" className={styles.cardTitle}>
              Notifications &amp; privacy
            </h2>
            {!prefs ? (
              <Spinner size={22} label="Loading preferences" />
            ) : (
              <div className={styles.switches}>
                <Switch
                  label="Messages and adoption updates"
                  description="Email me when someone replies or updates a request."
                  checked={prefs.messages}
                  onChange={(v) => setPrefs({ ...prefs, messages: v })}
                />
                <Switch
                  label="Pet discovery emails"
                  description="Send me occasional pet recommendations."
                  checked={prefs.discovery}
                  onChange={(v) => setPrefs({ ...prefs, discovery: v })}
                />
              </div>
            )}
          </section>

          <section className={styles.card} aria-labelledby="acc-security">
            <h2 id="acc-security" className={styles.cardTitle}>
              Security
            </h2>
            <div className={styles.securityRow}>
              <Button variant="secondary" onClick={() => setDialog('password')} className={styles.securityButton}>
                Change password
              </Button>
              <Button variant="secondary" onClick={() => setDialog('logout')} className={styles.securityButton}>
                Log out all sessions
              </Button>
              <button type="button" className={styles.danger} onClick={() => setDialog('delete')}>
                Delete account
              </button>
            </div>
            <p className={styles.small}>
              Account deletion requires confirmation. You can{' '}
              <a href="/api/account/export" download className={styles.link}>
                export your data
              </a>{' '}
              before deleting.
            </p>
          </section>

          <div className={styles.saveRow}>
            <Button type="submit" size="lg" loading={saving} loadingText="Saving…" className={styles.save}>
              Save changes
            </Button>
          </div>
        </form>
      </div>

      <ChangePasswordDialog open={dialog === 'password'} onClose={() => setDialog(null)} onDone={(t) => setMessage({ tone: 'success', text: t })} />
      <ChangeEmailDialog open={dialog === 'email'} onClose={() => setDialog(null)} onDone={(t) => setMessage({ tone: 'success', text: t })} />
      <LogoutOthersDialog open={dialog === 'logout'} onClose={() => setDialog(null)} onDone={(t) => setMessage({ tone: 'success', text: t })} />
      <DeleteAccountDialog
        open={dialog === 'delete'}
        onClose={() => setDialog(null)}
        onDeleted={() => {
          // The server already ended every session. A full reload resets all client state.
          window.location.replace(ROUTES.home);
        }}
      />
    </AppPage>
  );
}

function errorText(err: unknown) {
  return err instanceof ApiRequestError ? err.message : 'That didn’t work. Please try again.';
}

function ChangePasswordDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: (t: string) => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit() {
    const found: Record<string, string> = {};
    if (!current) found.currentPassword = 'Enter your current password.';
    const pw = validateNewPassword(next);
    if (pw) found.newPassword = pw;
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      await accountService.changePassword(current, next);
      setCurrent('');
      setNext('');
      onClose();
      onDone('Your password was changed. Other devices were signed out.');
    } catch (err) {
      setErrors(err instanceof ApiRequestError && err.fields ? err.fields : { currentPassword: errorText(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      title="Change your password"
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy}>
            Change password
          </Button>
        </>
      }
    >
      <div className={styles.dialogFields}>
        <PasswordField label="Current password" autoComplete="current-password" value={current} error={errors.currentPassword} onChange={(e) => setCurrent(e.target.value)} />
        <PasswordField
          label="New password"
          autoComplete="new-password"
          value={next}
          error={errors.newPassword}
          onChange={(e) => setNext(e.target.value)}
          after={next ? <PasswordStrength password={next} /> : undefined}
        />
      </div>
    </Dialog>
  );
}

function ChangeEmailDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: (t: string) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit() {
    const found: Record<string, string> = {};
    const e = validateEmail(email);
    if (e) found.newEmail = e;
    if (!password) found.password = 'Enter your password.';
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      await accountService.changeEmail(email.trim(), password);
      onClose();
      onDone(`If ${email.trim()} can be used, we’ve sent a confirmation link there. Your email changes once you open it.`);
      setEmail('');
      setPassword('');
    } catch (err) {
      setErrors(err instanceof ApiRequestError && err.fields ? err.fields : { newEmail: errorText(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      title="Change your email"
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy}>
            Send confirmation
          </Button>
        </>
      }
    >
      <p>We’ll send a link to your new address. Your current email keeps working until you confirm.</p>
      <div className={styles.dialogFields}>
        <TextField label="New email address" type="email" autoComplete="email" value={email} error={errors.newEmail} onChange={(e) => setEmail(e.target.value)} />
        <PasswordField label="Password" autoComplete="current-password" value={password} error={errors.password} onChange={(e) => setPassword(e.target.value)} />
      </div>
    </Dialog>
  );
}

function LogoutOthersDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: (t: string) => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={open}
      title="Log out all other sessions?"
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await accountService.logoutOthers();
                onDone('You’ve been signed out on every other device.');
              } finally {
                setBusy(false);
                onClose();
              }
            }}
          >
            Log out other sessions
          </Button>
        </>
      }
    >
      You’ll stay signed in here. Everywhere else, you’ll need to log in again.
    </Dialog>
  );
}

function DeleteAccountDialog({ open, onClose, onDeleted }: { open: boolean; onClose: () => void; onDeleted: () => void }) {
  const [typed, setTyped] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ready = typed === 'DELETE' && password.length > 0;

  return (
    <Dialog
      open={open}
      title="Delete your account?"
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={!ready}
            loading={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await accountService.remove(password);
                onDeleted();
              } catch (err) {
                setError(errorText(err));
                setBusy(false);
              }
            }}
          >
            Delete account
          </Button>
        </>
      }
    >
      <p>
        This removes your profile and listings. <a href="/api/account/export" download className={styles.link}>Export your data</a> first. This can’t
        be undone.
      </p>
      {error && (
        <Alert tone="error" className={styles.dialogAlert}>
          {error}
        </Alert>
      )}
      <div className={styles.dialogFields}>
        <TextField label="Type DELETE to confirm" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />
        <PasswordField label="Password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
    </Dialog>
  );
}
