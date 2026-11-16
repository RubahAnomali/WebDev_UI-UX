import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { adoptionRequestSchema, HOUSING_LABEL, HOME_TYPE_LABEL } from '../../../shared/schemas/requests';
import { AppPageShell } from '../../components/layout/AppPageShell';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Checkbox } from '../../components/ui/Checkbox';
import { EmptyState } from '../../components/ui/EmptyState';
import { Select } from '../../components/ui/Select';
import { Spinner } from '../../components/ui/Spinner';
import { Textarea } from '../../components/ui/Textarea';
import { TextField } from '../../components/ui/TextField';
import { petPath, requestPath, ROUTES } from '../../lib/routes';
import { readJSON, removeKey, writeJSON } from '../../lib/storage';
import { useDocumentTitle } from '../../lib/useDocumentTitle';
import { ApiRequestError } from '../../services/api/client';
import { useAuth } from '../../services/auth/AuthContext';
import { refreshCounts } from '../../services/me/useCounts';
import { artworkFor } from '../../services/pets/artwork';
import { petsService, SEX_LABEL } from '../../services/pets/petsService';
import type { PetDetail } from '../../services/pets/types';
import { requestsService } from '../../services/requests/requestsService';
import styles from './ApplyPage.module.css';

interface Form {
  fullName: string;
  phone: string;
  city: string;
  homeType: string;
  housingPermission: string;
  household: string;
  otherPets: string;
  experience: string;
  message: string;
  agreeCare: boolean;
  agreeShare: boolean;
}

const HOME_OPTIONS = Object.entries(HOME_TYPE_LABEL).map(([value, label]) => ({ value, label }));
const HOUSING_OPTIONS = Object.entries(HOUSING_LABEL).map(([value, label]) => ({ value, label }));
const ORDER: (keyof Form)[] = ['fullName', 'phone', 'city', 'homeType', 'housingPermission', 'household', 'otherPets', 'experience', 'message', 'agreeCare', 'agreeShare'];

/** Drafts stay on this device only — nothing is shared until the request is sent. */
const draftKey = (listingId: string) => `pawhaven.requestDraft.${listingId}`;

/** Figma 12:34 — Send an adoption request (approved term: “adoption request”). */
export function ApplyPage() {
  const { petId = '' } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pet, setPet] = useState<PetDetail | null>(null);
  const [missing, setMissing] = useState(false);
  const [form, setForm] = useState<Form>(() => {
    const draft = readJSON<Partial<Form> | null>(draftKey(petId), null);
    return {
      fullName: user?.fullName ?? '',
      phone: user?.phone ?? '',
      city: user?.location ?? '',
      homeType: '',
      housingPermission: '',
      household: '',
      otherPets: '',
      experience: '',
      message: '',
      agreeCare: false,
      agreeShare: false,
      ...draft,
    };
  });
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [sending, setSending] = useState(false);
  useDocumentTitle(pet ? `Adoption request for ${pet.name}` : 'Adoption request');

  useEffect(() => {
    const controller = new AbortController();
    petsService
      .get(petId, controller.signal)
      .then(setPet)
      .catch((err) => {
        if (!(err instanceof DOMException && err.name === 'AbortError')) setMissing(true);
      });
    return () => controller.abort();
  }, [petId]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  if (missing) {
    return (
      <AppPageShell>
        <div className={`container ${styles.narrow}`}>
          <EmptyState
            title="This chapter has moved on."
            text="This pet is no longer available. There are more companions waiting for a loving home."
            action={<Button to={ROUTES.findPet}>Find other pets</Button>}
          />
        </div>
      </AppPageShell>
    );
  }
  if (!pet) {
    return (
      <AppPageShell>
        <div className={styles.center}>
          <Spinner size={32} label="Loading" />
        </div>
      </AppPageShell>
    );
  }
  if (pet.viewer.requestId) return <Navigate to={requestPath(pet.viewer.requestId)} replace />;
  if (pet.viewer.isOwner || pet.status !== 'live') return <Navigate to={petPath(pet.id)} replace />;

  const lister = pet.lister.type === 'organization' ? pet.lister.name : 'the pet parent';
  const listerShort = pet.lister.type === 'organization' ? pet.lister.name : 'The pet parent';

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const result = adoptionRequestSchema.safeParse(form);
    if (!result.success) {
      const found: Partial<Record<keyof Form, string>> = {};
      for (const i of result.error.issues) found[i.path[0] as keyof Form] ??= i.message;
      setErrors(found);
      const first = ORDER.find((k) => found[k]);
      document.getElementById(`ap-${first}`)?.focus();
      return;
    }
    setSending(true);
    try {
      const request = await requestsService.send(pet!.id, result.data);
      removeKey(draftKey(pet!.id));
      refreshCounts();
      navigate(`${requestPath(request.id)}/sent`, { replace: true });
    } catch (err) {
      setSending(false);
      if (err instanceof ApiRequestError && err.fields) {
        setErrors(err.fields as Partial<Record<keyof Form, string>>);
        return;
      }
      setFormError(err instanceof ApiRequestError ? err.message : 'We couldn’t send your request. Please try again.');
    }
  }

  function saveDraft() {
    const { agreeCare: _c, agreeShare: _s, ...rest } = form;
    writeJSON(draftKey(pet!.id), rest);
    setSaved(true);
  }

  const field = (key: keyof Form) => ({ id: `ap-${key}`, name: key, value: form[key] as string, error: errors[key] });
  const meta = [pet.breed, pet.sex ? SEX_LABEL[pet.sex] : null, pet.ageLabel].filter(Boolean).join(' · ');

  return (
    <AppPageShell>
      <div className={`container ${styles.page}`}>
        <p className={styles.eyebrow}>A thoughtful first hello</p>
        <h1 className={styles.title}>Ask to meet {pet.name}.</h1>
        <p className={styles.subtitle}>
          Share a little about your home. {listerShort} will review your adoption request before arranging a meeting.
        </p>

        <div className={styles.layout}>
          <form className={styles.card} onSubmit={onSubmit} noValidate aria-labelledby="ap-heading">
            <h2 id="ap-heading" className={styles.cardTitle}>
              Your details &amp; home
            </h2>
            {formError && (
              <Alert tone="error" className={styles.alert}>
                {formError}
              </Alert>
            )}
            <div className={styles.grid}>
              <TextField label="Full name" autoComplete="name" {...field('fullName')} onChange={(e) => set('fullName', e.target.value)} />
              <TextField
                label="Email address"
                id="ap-email"
                value={user?.email ?? ''}
                readOnly
                hint="Your verified account email is used."
              />
              <TextField label="Phone number (optional)" type="tel" autoComplete="tel" {...field('phone')} onChange={(e) => set('phone', e.target.value)} />
              <TextField label="City and ZIP code" autoComplete="address-level2" {...field('city')} onChange={(e) => set('city', e.target.value)} />
              <Select label="Home type" options={HOME_OPTIONS} placeholder="Choose…" {...field('homeType')} onChange={(e) => set('homeType', e.target.value)} />
              <Select label="Housing permission" options={HOUSING_OPTIONS} placeholder="Choose…" {...field('housingPermission')} onChange={(e) => set('housingPermission', e.target.value)} />
              <Textarea
                label="Tell us about your household and pet experience"
                className={styles.full}
                rows={3}
                maxLength={2000}
                placeholder="Two adults, no children. We have a secure yard and experience caring for dogs."
                {...field('household')}
                onChange={(e) => set('household', e.target.value)}
              />
              <TextField label="Other pets at home (optional)" {...field('otherPets')} onChange={(e) => set('otherPets', e.target.value)} />
              <TextField label="Pet care experience (optional)" {...field('experience')} onChange={(e) => set('experience', e.target.value)} />
              <Textarea
                label={`Why ${pet.name}?`}
                className={styles.full}
                rows={3}
                maxLength={1000}
                showCount
                hint="This becomes the first message in your conversation."
                {...field('message')}
                onChange={(e) => set('message', e.target.value)}
              />
            </div>
            <div className={styles.agree}>
              <Checkbox
                id="ap-agreeCare"
                label={`I can provide ongoing care and meet ${lister}’s adoption requirements.`}
                checked={form.agreeCare}
                error={errors.agreeCare}
                onChange={(e) => set('agreeCare', e.target.checked)}
              />
              <Checkbox
                id="ap-agreeShare"
                label={`I agree my request details, including my email and phone, will be shared with ${lister}.`}
                checked={form.agreeShare}
                error={errors.agreeShare}
                onChange={(e) => set('agreeShare', e.target.checked)}
              />
            </div>
            <div className={styles.actions}>
              <Button type="submit" size="lg" loading={sending} loadingText="Sending…" className={styles.send}>
                Send adoption request
              </Button>
              <Button variant="secondary" size="lg" onClick={saveDraft} className={styles.draft}>
                Save draft
              </Button>
              {saved && (
                <span className={styles.saved} role="status">
                  Draft saved on this device.
                </span>
              )}
            </div>
          </form>

          <aside className={styles.side} aria-label={`About ${pet.name}`}>
            <div className={`${styles.portrait} ${styles[`tone_${pet.artworkTone}`]}`}>
              {pet.cover ? <img src={pet.cover.url} alt={`Photo of ${pet.name}`} /> : <img src={artworkFor(pet.artworkTone)} alt="" className={styles.art} />}
            </div>
            <p className={styles.petName}>{pet.name}</p>
            <p className={styles.petMeta}>
              {meta}
              <br />
              {[pet.lister.name, pet.city].filter(Boolean).join(' · ')}
            </p>
            <h2 className={styles.nextTitle}>What happens next?</h2>
            <ol className={styles.next}>
              <li>{listerShort} reviews your adoption request.</li>
              <li>You’ll hear back in your messages.</li>
              <li>Arrange a safe in-person meeting.</li>
            </ol>
            <p className={styles.small}>An adoption request is not an adoption guarantee. Never send a deposit before meeting.</p>
          </aside>
        </div>
      </div>
    </AppPageShell>
  );
}
