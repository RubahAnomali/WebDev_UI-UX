import { z } from 'zod';
import { AGE_UNITS, ENERGY, GOOD_WITH, LISTING_TYPES, SEX, SIZES, SPECIES, TRISTATE } from '../constants';

/** Public text must not contain contact details — conversations stay on Pawhaven. */
const CONTACT_RE =
  /([^\s@]+@[^\s@]+\.[a-z]{2,})|(\+?\d[\d\s().-]{7,}\d)|(https?:\/\/|www\.)|(\b(whatsapp|telegram|venmo|cashapp|zelle|paypal)\b)/i;
export const CONTACT_MESSAGE = 'Please keep phone numbers, emails, links, and payment handles out of the public description.';

const text = (min: number, max: number, required: string) =>
  z
    .string({ error: required })
    .trim()
    .min(min, min <= 1 ? required : `Please write at least ${min} characters.`)
    .max(max, `Please use ${max} characters or fewer.`)
    .refine((v) => !CONTACT_RE.test(v), CONTACT_MESSAGE);

export const MAX_FEE = 750;

/* ---------- Step 1 · The basics ---------- */
export const basicsSchema = z
  .object({
    name: z
      .string({ error: 'Enter your pet’s name.' })
      .trim()
      .min(1, 'Enter your pet’s name.')
      .max(40, 'Please use 40 characters or fewer.'),
    species: z.enum(SPECIES, { error: 'Choose a pet type.' }),
    breed: text(2, 60, 'Enter a breed or mix (or “Unknown”).'),
    sex: z.enum(SEX, { error: 'Choose a sex.' }),
    ageValue: z.coerce
      .number({ error: 'Enter an age.' })
      .int('Use a whole number.')
      .min(0, 'Enter an age.')
      .max(52, 'That age looks too high.'),
    ageUnit: z.enum(AGE_UNITS, { error: 'Choose an age unit.' }),
    size: z.enum(SIZES, { error: 'Choose a size.' }),
    listingType: z.enum(LISTING_TYPES, { error: 'Choose a listing type.' }),
    fee: z.coerce
      .number({ error: 'Enter a fee, or 0 for no fee.' })
      .int('Use whole dollars.')
      .min(0, 'Fees can’t be negative.')
      .max(MAX_FEE, `Fees on Pawhaven are capped at $${MAX_FEE} to discourage sales.`),
    city: text(2, 80, 'Enter your city or ZIP code.'),
  })
  .superRefine((v, ctx) => {
    const years = v.ageUnit === 'years' ? v.ageValue : v.ageUnit === 'months' ? v.ageValue / 12 : v.ageValue / 52;
    if (years > 40) ctx.addIssue({ code: 'custom', path: ['ageValue'], message: 'That age looks too high.' });
  });

/* ---------- Step 2 · Health & care ---------- */
export const healthSchema = z.object({
  vaccinated: z.enum(TRISTATE, { error: 'Choose Yes, No, or Unknown.' }),
  spayedNeutered: z.enum(TRISTATE, { error: 'Choose Yes, No, or Unknown.' }),
  microchipped: z.enum(TRISTATE, { error: 'Choose Yes, No, or Unknown.' }),
  houseTrained: z.enum(TRISTATE, { error: 'Choose Yes, No, or Unknown.' }),
  goodWith: z.array(z.enum(GOOD_WITH)).max(4).default([]),
  energyLevel: z.enum(ENERGY, { error: 'Choose an energy level.' }),
  medicalNotes: text(2, 1000, 'Describe medical needs, or write “None known”.'),
  behaviorNotes: text(2, 1000, 'Describe behavior and special care.'),
  careNeeds: z
    .string()
    .trim()
    .max(200, 'Please use 200 characters or fewer.')
    .refine((v) => !CONTACT_RE.test(v), CONTACT_MESSAGE)
    .optional(),
});

/* ---------- Step 3 · Story & media ---------- */
export const storyBaseSchema = z.object({
  headline: z
    .string()
    .trim()
    .max(80, 'Please use 80 characters or fewer.')
    .refine((v) => !CONTACT_RE.test(v), CONTACT_MESSAGE)
    .optional(),
  about: text(40, 2000, 'Tell people about your pet.'),
  idealHome: text(10, 1000, 'Describe their ideal home.'),
  rehomingReason: z.string().trim().max(1000).optional(),
  traits: z.array(z.string().trim().min(2).max(24)).max(5, 'Choose up to 5 traits.').default([]),
  artworkTone: z.enum(['green', 'peach', 'lilac', 'sage']).default('green'),
});

export const storySchema = (listingType: string | null | undefined) =>
  storyBaseSchema.superRefine((v, ctx) => {
    if (listingType !== 'rehoming') return;
    const reason = v.rehomingReason ?? '';
    if (reason.length < 10) {
      ctx.addIssue({ code: 'custom', path: ['rehomingReason'], message: 'Please share why you’re rehoming (10+ characters).' });
    } else if (CONTACT_RE.test(reason)) {
      ctx.addIssue({ code: 'custom', path: ['rehomingReason'], message: CONTACT_MESSAGE });
    }
  });

/* ---------- Step 4 · Review & submit ---------- */
export const attestationsSchema = z.object({
  owner: z.literal(true, { error: 'Please confirm you own or are authorized to rehome this pet.' }),
  accurate: z.literal(true, { error: 'Please confirm the details are accurate.' }),
  rules: z.literal(true, { error: 'Please agree to the listing rules.' }),
});

/** Draft saves: every field optional, but anything provided must be well-formed. */
export const draftPatchSchema = z
  .object({
    name: z.string().trim().min(1).max(40),
    species: z.enum(SPECIES).nullable(),
    breed: z.string().trim().max(60).nullable(),
    sex: z.enum(SEX).nullable(),
    ageValue: z.coerce.number().int().min(0).max(52).nullable(),
    ageUnit: z.enum(AGE_UNITS).nullable(),
    size: z.enum(SIZES).nullable(),
    listingType: z.enum(LISTING_TYPES).nullable(),
    fee: z.coerce.number().int().min(0).max(MAX_FEE).nullable(),
    city: z.string().trim().max(80).nullable(),
    lat: z.number().min(-90).max(90).nullable(),
    lng: z.number().min(-180).max(180).nullable(),
    vaccinated: z.enum(TRISTATE).nullable(),
    spayedNeutered: z.enum(TRISTATE).nullable(),
    microchipped: z.enum(TRISTATE).nullable(),
    houseTrained: z.enum(TRISTATE).nullable(),
    goodWith: z.array(z.enum(GOOD_WITH)).max(4),
    energyLevel: z.enum(ENERGY).nullable(),
    medicalNotes: z.string().trim().max(1000).nullable(),
    behaviorNotes: z.string().trim().max(1000).nullable(),
    careNeeds: z.string().trim().max(200).nullable(),
    headline: z.string().trim().max(80).nullable(),
    about: z.string().trim().max(2000).nullable(),
    idealHome: z.string().trim().max(1000).nullable(),
    rehomingReason: z.string().trim().max(1000).nullable(),
    traits: z.array(z.string().trim().min(1).max(24)).max(5),
    artworkTone: z.enum(['green', 'peach', 'lilac', 'sage']),
  })
  .partial();

export type DraftPatch = z.infer<typeof draftPatchSchema>;

/** Editable listing as returned to its owner. */
export interface EditableListing {
  id: string;
  status: 'draft' | 'pending' | 'changes_requested' | 'live' | 'paused' | 'rehomed' | 'rejected';
  name: string;
  species: string | null;
  breed: string | null;
  sex: string | null;
  ageValue: number | null;
  ageUnit: string | null;
  size: string | null;
  listingType: string | null;
  fee: number | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  vaccinated: string | null;
  spayedNeutered: string | null;
  microchipped: string | null;
  houseTrained: string | null;
  goodWith: string[];
  energyLevel: string | null;
  medicalNotes: string | null;
  behaviorNotes: string | null;
  careNeeds: string | null;
  headline: string | null;
  about: string | null;
  idealHome: string | null;
  rehomingReason: string | null;
  traits: string[];
  artworkTone: 'green' | 'peach' | 'lilac' | 'sage';
  photos: { id: string; url: string; thumbUrl: string; width: number; height: number }[];
  moderationNote: string | null;
  updatedAt: string;
}

export function containsContactInfo(value: string) {
  return CONTACT_RE.test(value);
}
