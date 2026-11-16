import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { z } from 'zod';
import {
  attestationsSchema,
  basicsSchema,
  healthSchema,
  storySchema,
  type DraftPatch,
  type EditableListing,
} from '../../../shared/schemas/listingForm';
import { AppPageShell } from '../../components/layout/AppPageShell';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Checkbox } from '../../components/ui/Checkbox';
import { EmptyState } from '../../components/ui/EmptyState';
import { Icon } from '../../components/ui/Icon';
import { Select } from '../../components/ui/Select';
import { Spinner } from '../../components/ui/Spinner';
import { Stepper } from '../../components/ui/Stepper';
import { Textarea } from '../../components/ui/Textarea';
import { TextField } from '../../components/ui/TextField';
import { editListingPath, ROUTES } from '../../lib/routes';
import { useDocumentTitle } from '../../lib/useDocumentTitle';
import { ApiRequestError } from '../../services/api/client';
import { useAuth } from '../../services/auth/AuthContext';
import { myListingsService } from '../../services/listings/myListingsService';
import { artworkFor } from '../../services/pets/artwork';
import { feeLabel } from '../../services/pets/petsService';
import {
  AGE_UNIT_OPTIONS,
  ENERGY_OPTIONS,
  GOOD_WITH_OPTIONS,
  labelOf,
  LISTING_TYPE_OPTIONS,
  SEX_OPTIONS,
  SIZE_OPTIONS,
  SPECIES_OPTIONS,
  TRISTATE_OPTIONS,
} from './listingFormOptions';
import { PhotoUploader } from './PhotoUploader';
import styles from './PostPetPage.module.css';

const STEPS = ['The basics', 'Health & care', 'Story & media', 'Review & submit'];

interface Form {
  name: string;
  species: string;
  breed: string;
  sex: string;
  ageValue: string;
  ageUnit: string;
  size: string;
  listingType: string;
  fee: string;
  city: string;
  vaccinated: string;
  spayedNeutered: string;
  microchipped: string;
  houseTrained: string;
  goodWith: string[];
  energyLevel: string;
  medicalNotes: string;
  behaviorNotes: string;
  careNeeds: string;
  headline: string;
  about: string;
  idealHome: string;
  rehomingReason: string;
  traits: string;
  artworkTone: EditableListing['artworkTone'];
}

const EMPTY: Form = {
  name: '', species: '', breed: '', sex: '', ageValue: '', ageUnit: 'years', size: '', listingType: '', fee: '0', city: '',
  vaccinated: '', spayedNeutered: '', microchipped: '', houseTrained: '', goodWith: [], energyLevel: '',
  medicalNotes: '', behaviorNotes: '', careNeeds: '', headline: '', about: '', idealHome: '', rehomingReason: '',
  traits: '', artworkTone: 'green',
};

function fromListing(l: EditableListing): Form {
  const s = (v: string | number | null) => (v == null ? '' : String(v));
  return {
    name: l.name, species: s(l.species), breed: s(l.breed), sex: s(l.sex), ageValue: s(l.ageValue),
    ageUnit: l.ageUnit ?? 'years', size: s(l.size), listingType: s(l.listingType), fee: s(l.fee ?? 0), city: s(l.city),
    vaccinated: s(l.vaccinated), spayedNeutered: s(l.spayedNeutered), microchipped: s(l.microchipped),
    houseTrained: s(l.houseTrained), goodWith: l.goodWith, energyLevel: s(l.energyLevel), medicalNotes: s(l.medicalNotes),
    behaviorNotes: s(l.behaviorNotes), careNeeds: s(l.careNeeds), headline: s(l.headline), about: s(l.about),
    idealHome: s(l.idealHome), rehomingReason: s(l.rehomingReason), traits: l.traits.join(', '), artworkTone: l.artworkTone,
  };
}

const STEP_FIELDS: Record<number, (keyof Form)[]> = {
  1: ['name', 'species', 'breed', 'sex', 'ageValue', 'ageUnit', 'size', 'listingType', 'fee', 'city'],
  2: ['vaccinated', 'spayedNeutered', 'microchipped', 'houseTrained', 'goodWith', 'energyLevel', 'medicalNotes', 'behaviorNotes', 'careNeeds'],
  3: ['headline', 'about', 'idealHome', 'rehomingReason', 'traits', 'artworkTone'],
};

/** Turns form strings into an API patch for the given fields ('' → null). */
function toPatch(form: Form, fields: (keyof Form)[]): DraftPatch {
  const patch: Record<string, unknown> = {};
  for (const f of fields) {
    const v = form[f];
    if (f === 'goodWith') patch.goodWith = v;
    else if (f === 'traits') patch.traits = splitTraits(form.traits);
    else if (f === 'ageValue' || f === 'fee') patch[f] = v === '' ? null : Number(v);
    else if (f === 'name') patch.name = (v as string).trim() || 'Untitled pet';
    else patch[f] = typeof v === 'string' ? (v.trim() === '' ? null : v.trim()) : v;
  }
  return patch as DraftPatch;
}

const splitTraits = (v: string) =>
  v
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 5);

function validateStep(step: number, form: Form): Record<string, string> {
  const schema: z.ZodType =
    step === 1 ? basicsSchema : step === 2 ? healthSchema : storySchema(form.listingType);
  const input =
    step === 3
      ? { ...form, traits: splitTraits(form.traits), headline: form.headline || undefined, rehomingReason: form.rehomingReason || undefined }
      : { ...form, careNeeds: form.careNeeds || undefined, ageValue: form.ageValue === '' ? undefined : form.ageValue, fee: form.fee === '' ? undefined : form.fee };
  const result = schema.safeParse(input);
  if (result.success) return {};
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) errors[String(issue.path[0])] ??= issue.message;
  return errors;
}

const FIELD_STEP: Record<string, number> = Object.fromEntries(
  Object.entries(STEP_FIELDS).flatMap(([step, fields]) => fields.map((f) => [f, Number(step)])),
);

type Load = { kind: 'loading' } | { kind: 'missing' } | { kind: 'ready' };

/** Figma 14:47–14:53 — Post a pet (four steps) with autosaved drafts. */
export function PostPetPage() {
  const { listingId } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [load, setLoad] = useState<Load>(listingId ? { kind: 'loading' } : { kind: 'ready' });
  const [listing, setListing] = useState<EditableListing | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<ReactNode>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState<'continue' | 'exit' | 'submit' | null>(null);
  const [attest, setAttest] = useState({ owner: false, accurate: false, rules: false });
  const [attestErrors, setAttestErrors] = useState<Record<string, string>>({});
  const headingRef = useRef<HTMLHeadingElement>(null);

  const requested = Number(params.get('step') ?? '1');
  const step = listingId ? Math.min(Math.max(requested, 1), 4) : 1;
  useDocumentTitle(`Post a pet · ${STEPS[step - 1]}`);

  useEffect(() => {
    if (!listingId) return;
    const controller = new AbortController();
    myListingsService
      .get(listingId, controller.signal)
      .then((l) => {
        setListing(l);
        setForm(fromListing(l));
        setLoad({ kind: 'ready' });
      })
      .catch((err) => {
        if (!(err instanceof DOMException && err.name === 'AbortError')) setLoad({ kind: 'missing' });
      });
    return () => controller.abort();
  }, [listingId]);

  // Move focus to the step heading when the step changes (not on first load).
  const lastStep = useRef(step);
  useEffect(() => {
    if (lastStep.current !== step) {
      lastStep.current = step;
      headingRef.current?.focus();
      window.scrollTo({ top: 0 });
    }
  }, [step]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: '' }));
  };

  const isPublic = listing && ['live', 'paused', 'pending'].includes(listing.status);
  const locked = listing && ['rehomed', 'rejected'].includes(listing.status);

  async function save(fields: (keyof Form)[]): Promise<EditableListing> {
    const patch = toPatch(form, fields);
    if (!listing) {
      const created = await myListingsService.create({ ...patch, name: patch.name ?? (form.name.trim() || 'Untitled pet') });
      setListing(created);
      return created;
    }
    const res = await myListingsService.update(listing.id, patch);
    setListing(res.listing);
    if (res.returnedToReview) setNotice('Your changes were saved. The listing will be reviewed again before it’s public.');
    return res.listing;
  }

  function goTo(n: number, id = listing?.id) {
    if (!id) return;
    if (!listingId) navigate(`${editListingPath(id)}?step=${n}`, { replace: true });
    else setParams({ step: String(n) });
  }

  function handleApiError(err: unknown) {
    if (err instanceof ApiRequestError && err.code === 'VALIDATION' && err.fields) {
      setErrors(err.fields);
      const first = Object.keys(err.fields).map((k) => FIELD_STEP[k] ?? 1);
      const target = first.length ? Math.min(...first) : step;
      setFormError(
        <>
          {err.message}{' '}
          {target !== step && (
            <button type="button" onClick={() => goTo(target)}>
              Go to {STEPS[target - 1]}
            </button>
          )}
        </>,
      );
      return;
    }
    setFormError(err instanceof ApiRequestError ? err.message : 'We couldn’t save your listing. Please try again.');
  }

  async function onContinue(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const found = validateStep(step, form);
    setErrors(found);
    if (Object.keys(found).length) {
      const firstKey = STEP_FIELDS[step]!.find((k) => found[k]);
      document.getElementById(`pp-${firstKey}`)?.focus();
      return;
    }
    setSaving('continue');
    try {
      const saved = await save(STEP_FIELDS[step]!);
      goTo(step + 1, saved.id);
    } catch (err) {
      handleApiError(err);
    } finally {
      setSaving(null);
    }
  }

  async function onSaveAndExit() {
    setFormError(null);
    if (!listing && !form.name.trim()) {
      navigate(ROUTES.myListings);
      return;
    }
    setSaving('exit');
    try {
      await save(step <= 3 ? STEP_FIELDS[step]! : []);
      navigate(ROUTES.myListings, { state: { notice: 'Your listing was saved.' } });
    } catch (err) {
      handleApiError(err);
      setSaving(null);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!listing) return;
    setFormError(null);
    if (isPublic) {
      navigate(ROUTES.myListings, { state: { notice: 'Your changes were saved.' } });
      return;
    }
    const parsed = attestationsSchema.safeParse(attest);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[String(i.path[0])] = i.message;
      setAttestErrors(errs);
      return;
    }
    setSaving('submit');
    try {
      await myListingsService.submit(listing.id, attest);
      navigate(`${editListingPath(listing.id)}/submitted`, { replace: true });
    } catch (err) {
      handleApiError(err);
      setSaving(null);
    }
  }

  if (load.kind === 'loading') {
    return (
      <AppPageShell>
        <div className={styles.center}>
          <Spinner size={32} label="Loading your listing" />
        </div>
      </AppPageShell>
    );
  }
  if (load.kind === 'missing') {
    return (
      <AppPageShell>
        <div className={`container ${styles.narrow}`}>
          <EmptyState title="We couldn’t find that listing." text="It may have been removed." action={<Button to={ROUTES.myListings}>Go to My listings</Button>} />
        </div>
      </AppPageShell>
    );
  }

  const petName = form.name.trim() || 'your pet';
  const possessive = form.sex === 'male' ? 'His' : form.sex === 'female' ? 'Her' : 'Their';
  const feeKind = form.listingType === 'adoption' ? 'Adoption fee (USD)' : 'Rehoming fee (USD)';

  const aside = {
    1: { title: 'Their welfare comes first.', text: 'Post only a pet you legally own or represent. Be transparent about needs and fees. Never list wildlife or endangered animals.' },
    2: { title: 'The right match needs the full picture.', text: 'Select “Unknown” when you aren’t sure. Disclose health and behavioral needs. Share veterinary records privately with a prospective adopter, not publicly.' },
    3: { title: 'The small details matter.', text: 'Share routines, personality, and what helps your pet feel safe. Keep phone numbers, addresses, and private health records out of the public description.' },
  }[step as 1 | 2 | 3];

  const field = (key: keyof Form) => ({
    id: `pp-${key}`,
    name: key,
    value: form[key] as string,
    error: errors[key] || undefined,
  });

  return (
    <AppPageShell>
      <div className={`container ${styles.page}`}>
        <header className={styles.head}>
          <div>
            <h1 className={styles.title}>A thoughtful listing. A loving home.</h1>
            <p className={styles.subtitle}>Tell their story honestly. Help the right people find them.</p>
          </div>
          {!locked && (
            <button type="button" className={styles.saveExit} onClick={onSaveAndExit} disabled={saving !== null}>
              {saving === 'exit' ? 'Saving…' : 'Save and exit'}
            </button>
          )}
        </header>

        <Stepper steps={STEPS} current={step} reachable={listing ? 4 : 1} onSelect={(n) => goTo(n)} />

        {locked && (
          <Alert tone="info" className={styles.alert} title="This listing is closed.">
            Listings that are rehomed or weren’t approved can’t be edited. <Link to={ROUTES.myListings}>Back to My listings</Link>
          </Alert>
        )}
        {listing?.status === 'changes_requested' && listing.moderationNote && (
          <Alert tone="warning" className={styles.alert} title="A few details need your care.">
            {listing.moderationNote}
          </Alert>
        )}
        {listing && ['live', 'paused'].includes(listing.status) && !notice && (
          <Alert tone="info" className={styles.alert}>
            This listing is public. Saving changes sends it back for a quick review before it reappears.
          </Alert>
        )}
        {notice && (
          <Alert tone="success" className={styles.alert}>
            {notice}
          </Alert>
        )}
        {user?.accountType === 'organization' && user.organizationVerification !== 'verified' && step === 4 && (
          <Alert tone="info" className={styles.alert} title="Your organization is being verified.">
            You can prepare listings now. You’ll be able to submit them once verification is complete.
          </Alert>
        )}
        {formError && (
          <Alert tone="error" className={styles.alert}>
            {formError}
          </Alert>
        )}

        {step < 4 ? (
          <form className={styles.layout} onSubmit={onContinue} noValidate>
            <fieldset className={styles.card} disabled={Boolean(locked)}>
              <h2 ref={headingRef} tabIndex={-1} className={styles.cardTitle}>
                {step === 1 ? 'Let’s start with the basics.' : step === 2 ? 'Good care starts with honesty.' : `Let ${petName}’s personality shine.`}
              </h2>

              {step === 1 && (
                <div className={styles.grid}>
                  <TextField label="Pet name *" autoComplete="off" maxLength={40} {...field('name')} onChange={(e) => set('name', e.target.value)} />
                  <Select label="Pet type *" options={SPECIES_OPTIONS} placeholder="Choose…" {...field('species')} onChange={(e) => set('species', e.target.value)} />
                  <TextField label="Breed / mix *" maxLength={60} hint="Write “Mixed breed” or “Unknown” if you aren’t sure." {...field('breed')} onChange={(e) => set('breed', e.target.value)} />
                  <Select label="Sex *" options={SEX_OPTIONS} placeholder="Choose…" {...field('sex')} onChange={(e) => set('sex', e.target.value)} />
                  <div className={styles.pair}>
                    <TextField label="Age *" type="number" inputMode="numeric" min={0} max={52} {...field('ageValue')} onChange={(e) => set('ageValue', e.target.value)} />
                    <Select label="Age unit *" options={AGE_UNIT_OPTIONS} {...field('ageUnit')} onChange={(e) => set('ageUnit', e.target.value)} />
                  </div>
                  <Select label="Size *" options={SIZE_OPTIONS} placeholder="Choose…" {...field('size')} onChange={(e) => set('size', e.target.value)} />
                  <Select
                    label="Listing type *"
                    options={user?.accountType === 'organization' ? LISTING_TYPE_OPTIONS : LISTING_TYPE_OPTIONS.slice().reverse()}
                    placeholder="Choose…"
                    {...field('listingType')}
                    onChange={(e) => set('listingType', e.target.value)}
                  />
                  <TextField
                    label={feeKind}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={750}
                    hint="Enter 0 for no fee. Pawhaven never collects payments."
                    {...field('fee')}
                    onChange={(e) => set('fee', e.target.value)}
                  />
                  <TextField
                    label="City / ZIP code *"
                    autoComplete="address-level2"
                    className={styles.full}
                    hint="Only your city is public. Your exact address is never displayed."
                    {...field('city')}
                    onChange={(e) => set('city', e.target.value)}
                  />
                </div>
              )}

              {step === 2 && (
                <div className={styles.grid}>
                  <Select label="Vaccinated *" options={TRISTATE_OPTIONS} placeholder="Choose…" {...field('vaccinated')} onChange={(e) => set('vaccinated', e.target.value)} />
                  <Select label="Spayed / neutered *" options={TRISTATE_OPTIONS} placeholder="Choose…" {...field('spayedNeutered')} onChange={(e) => set('spayedNeutered', e.target.value)} />
                  <Select label="Microchipped *" options={TRISTATE_OPTIONS} placeholder="Choose…" {...field('microchipped')} onChange={(e) => set('microchipped', e.target.value)} />
                  <Select label="House trained *" options={TRISTATE_OPTIONS} placeholder="Choose…" {...field('houseTrained')} onChange={(e) => set('houseTrained', e.target.value)} />
                  <fieldset className={styles.checks} id="pp-goodWith">
                    <legend>Comfortable with</legend>
                    <div className={styles.checkRow}>
                      {GOOD_WITH_OPTIONS.map((o) => (
                        <Checkbox
                          key={o.value}
                          label={o.label}
                          checked={form.goodWith.includes(o.value)}
                          onChange={(e) =>
                            set('goodWith', e.target.checked ? [...form.goodWith, o.value] : form.goodWith.filter((g) => g !== o.value))
                          }
                        />
                      ))}
                    </div>
                  </fieldset>
                  <Select label="Energy level *" options={ENERGY_OPTIONS} placeholder="Choose…" {...field('energyLevel')} onChange={(e) => set('energyLevel', e.target.value)} />
                  <Textarea label="Medical needs / medications *" rows={3} maxLength={1000} showCount className={styles.full} {...field('medicalNotes')} onChange={(e) => set('medicalNotes', e.target.value)} />
                  <Textarea label="Behavior & special care *" rows={3} maxLength={1000} showCount className={styles.full} {...field('behaviorNotes')} onChange={(e) => set('behaviorNotes', e.target.value)} />
                  <TextField label="Everyday care (optional)" placeholder="e.g. Daily walks and regular grooming" maxLength={200} className={styles.full} {...field('careNeeds')} onChange={(e) => set('careNeeds', e.target.value)} />
                </div>
              )}

              {step === 3 && listing && (
                <div className={styles.stack}>
                  <TextField label="Headline (optional)" placeholder="A gentle soul, ready for her people." maxLength={80} {...field('headline')} onChange={(e) => set('headline', e.target.value)} />
                  <Textarea label={`About ${petName} *`} rows={4} maxLength={2000} showCount {...field('about')} onChange={(e) => set('about', e.target.value)} />
                  <Textarea label={`${possessive} ideal home *`} rows={3} maxLength={1000} showCount {...field('idealHome')} onChange={(e) => set('idealHome', e.target.value)} />
                  {form.listingType === 'rehoming' && (
                    <Textarea label="Reason for rehoming *" rows={2} maxLength={1000} {...field('rehomingReason')} onChange={(e) => set('rehomingReason', e.target.value)} />
                  )}
                  <TextField label="Personality (optional)" placeholder="Gentle, Playful, Good with dogs" hint="Up to 5 short traits, separated by commas." {...field('traits')} onChange={(e) => set('traits', e.target.value)} />
                  <PhotoUploader
                    listingId={listing.id}
                    petName={petName}
                    photos={listing.photos}
                    onPhotosChange={(photos) => setListing((l) => (l ? { ...l, photos } : l))}
                    tone={form.artworkTone}
                    onToneChange={(t) => set('artworkTone', t)}
                  />
                </div>
              )}
            </fieldset>

            <aside className={styles.aside} aria-label="Guidance">
              <div className={styles.tip}>
                <Icon name="paw" size={40} className={styles.tipIcon} />
                <p className={styles.tipTitle}>{aside.title}</p>
                <p className={styles.tipText}>{aside.text}</p>
              </div>
              <p className={styles.stepNote}>Step {step} of 4 · Required fields are marked *</p>
            </aside>

            <div className={styles.footer}>
              {step === 1 ? (
                <Button to={ROUTES.myListings} variant="secondary" className={styles.back}>
                  Cancel
                </Button>
              ) : (
                <Button variant="secondary" className={styles.back} onClick={() => goTo(step - 1)}>
                  Back
                </Button>
              )}
              {!locked && (
                <Button type="submit" size="lg" className={styles.next} loading={saving === 'continue'} loadingText="Saving…">
                  {step === 1 ? 'Continue to health & care' : step === 2 ? 'Continue to story & media' : 'Review listing'}
                </Button>
              )}
            </div>
          </form>
        ) : (
          listing && (
            <form className={styles.layout} onSubmit={onSubmit} noValidate>
              <ReviewSummary listing={listing} form={form} onEdit={goTo} headingRef={headingRef} />
              <aside className={styles.aside} aria-label="Final check">
                {isPublic ? (
                  <div className={styles.checkCard}>
                    <p className={styles.checkTitle}>Changes saved as you go.</p>
                    <p className={styles.tipText}>
                      {listing.status === 'pending'
                        ? 'Your listing is waiting for review. We’ll let you know when it’s public again.'
                        : 'Your listing is up to date.'}
                    </p>
                  </div>
                ) : (
                  <div className={styles.checkCard}>
                    <p className={styles.checkTitle}>One last thoughtful check.</p>
                    <div className={styles.attest}>
                      <Checkbox
                        label={`I own or am authorized to rehome ${petName}.`}
                        checked={attest.owner}
                        error={attestErrors.owner}
                        onChange={(e) => setAttest((a) => ({ ...a, owner: e.target.checked }))}
                      />
                      <Checkbox
                        label="All details are accurate and I’ve disclosed known health and behavioral needs."
                        checked={attest.accurate}
                        error={attestErrors.accurate}
                        onChange={(e) => setAttest((a) => ({ ...a, accurate: e.target.checked }))}
                      />
                      <Checkbox
                        label={
                          <>
                            I agree to the <Link to={ROUTES.rehomingGuide}>listing rules</Link> and will screen adopters before any handover.
                          </>
                        }
                        checked={attest.rules}
                        error={attestErrors.rules}
                        onChange={(e) => setAttest((a) => ({ ...a, rules: e.target.checked }))}
                      />
                    </div>
                    <p className={styles.tipText}>Your listing is reviewed before it becomes public. No payment is collected here.</p>
                  </div>
                )}
                {user?.emailVerified && (
                  <p className={styles.verified}>
                    Your email is verified. <Icon name="check" size={14} strokeWidth={2.4} />
                  </p>
                )}
              </aside>
              <div className={styles.footer}>
                <Button variant="secondary" className={styles.back} onClick={() => goTo(3)}>
                  Back
                </Button>
                {!locked && (
                  <Button type="submit" size="lg" className={styles.next} loading={saving === 'submit'} loadingText="Submitting…">
                    {isPublic ? 'Done' : 'Submit for review'}
                  </Button>
                )}
              </div>
            </form>
          )
        )}
      </div>
    </AppPageShell>
  );
}

function ReviewSummary({
  listing,
  form,
  onEdit,
  headingRef,
}: {
  listing: EditableListing;
  form: Form;
  onEdit: (step: number) => void;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
}) {
  const name = form.name || 'Your pet';
  const fee = feeLabel(Number(form.fee || 0), form.listingType);
  const health = [
    form.vaccinated === 'yes' && 'Vaccinated',
    form.spayedNeutered === 'yes' && (form.sex === 'female' ? 'Spayed' : form.sex === 'male' ? 'Neutered' : 'Spayed / neutered'),
    form.microchipped === 'yes' && 'Microchipped',
    form.houseTrained === 'yes' && 'House trained',
  ].filter(Boolean);
  const cover = listing.photos[0];
  const age = form.ageValue ? `${form.ageValue} ${form.ageValue === '1' ? form.ageUnit.replace(/s$/, '') : form.ageUnit}` : '';

  return (
    <section className={`${styles.card} ${styles.review}`} aria-labelledby="review-name">
      <h2 ref={headingRef} tabIndex={-1} className="visually-hidden">
        Review your listing
      </h2>
      <div className={styles.reviewTop}>
        <div className={`${styles.reviewArt} ${styles[`tone_${form.artworkTone}`]}`}>
          {cover ? <img src={cover.thumbUrl} alt="" /> : <img src={artworkFor(form.artworkTone)} alt="" />}
        </div>
        <div className={styles.reviewMain}>
          <p id="review-name" className={styles.reviewName}>
            {name}
          </p>
          <p className={styles.muted}>
            {[labelOf(SPECIES_OPTIONS, form.species), form.breed, age, labelOf(SEX_OPTIONS, form.sex)].filter(Boolean).join(' · ')}
          </p>
          <p className={styles.reviewMeta}>
            {[form.city, labelOf(LISTING_TYPE_OPTIONS, form.listingType), fee.amount === 'No fee' ? 'No fee' : `${fee.amount} fee`]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <button type="button" className={styles.editLink} onClick={() => onEdit(1)}>
            Edit basics
          </button>
        </div>
      </div>

      <div className={styles.reviewSection}>
        <div className={styles.reviewHead}>
          <h3>Health &amp; care</h3>
          <button type="button" className={styles.editLink} onClick={() => onEdit(2)}>
            Edit health &amp; care
          </button>
        </div>
        {health.length > 0 && <p className={styles.muted}>{health.join(' · ')}</p>}
        <p className={styles.muted}>{form.medicalNotes}</p>
        <p className={styles.muted}>{form.behaviorNotes}</p>
      </div>

      <div className={styles.reviewSection}>
        <div className={styles.reviewHead}>
          <h3>{name}’s story</h3>
          <button type="button" className={styles.editLink} onClick={() => onEdit(3)}>
            Edit story
          </button>
        </div>
        <p className={styles.muted}>{form.about}</p>
        <h4>Ideal home</h4>
        <p className={styles.muted}>{form.idealHome}</p>
        {form.listingType === 'rehoming' && (
          <>
            <h4>Reason for rehoming</h4>
            <p className={styles.muted}>{form.rehomingReason}</p>
          </>
        )}
        <h4>Photos</h4>
        <p className={styles.muted}>
          {listing.photos.length ? `${listing.photos.length} photo${listing.photos.length === 1 ? '' : 's'}` : 'Paw artwork (no photos yet)'}
        </p>
      </div>
    </section>
  );
}
