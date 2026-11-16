import { z } from 'zod';
import { HOME_TYPES, HOUSING_PERMISSION } from '../constants';
import { fullNameSchema, locationSchema } from './auth';

export const adoptionRequestSchema = z.object({
  fullName: fullNameSchema,
  phone: z
    .string()
    .trim()
    .max(30, 'Please use 30 characters or fewer.')
    .regex(/^[\d\s()+.-]*$/, 'Use digits, spaces, and ( ) + - only.')
    .optional()
    .or(z.literal('')),
  city: locationSchema,
  homeType: z.enum(HOME_TYPES, { error: 'Choose your home type.' }),
  housingPermission: z.enum(HOUSING_PERMISSION, { error: 'Choose your housing situation.' }),
  household: z
    .string({ error: 'Tell the lister about your household.' })
    .trim()
    .min(20, 'Please share a little more (20+ characters).')
    .max(2000, 'Please use 2000 characters or fewer.'),
  otherPets: z.string().trim().max(300).optional().or(z.literal('')),
  experience: z.string().trim().max(500).optional().or(z.literal('')),
  message: z
    .string({ error: 'Tell them why this pet is a good fit.' })
    .trim()
    .min(10, 'Please write at least 10 characters.')
    .max(1000, 'Please use 1000 characters or fewer.'),
  agreeCare: z.literal(true, { error: 'Please confirm you can provide ongoing care.' }),
  agreeShare: z.literal(true, { error: 'Please agree to share your details with the lister.' }),
});

export type AdoptionRequestInput = z.infer<typeof adoptionRequestSchema>;

export const decisionSchema = z.object({ note: z.string().trim().max(500).optional() });

export const HOME_TYPE_LABEL: Record<(typeof HOME_TYPES)[number], string> = {
  house: 'House',
  apartment: 'Apartment',
  townhouse: 'Townhouse',
  other: 'Other',
};
export const HOUSING_LABEL: Record<(typeof HOUSING_PERMISSION)[number], string> = {
  own: 'I own my home',
  rent_allowed: 'I rent — pets are allowed',
  rent_pending: 'I rent — I’ll confirm with my landlord',
  other: 'Other',
};

export interface RequestEvent {
  status: string;
  note: string | null;
  at: string;
}

export interface RequestListingInfo {
  id: string;
  name: string;
  breed: string | null;
  ageLabel: string | null;
  sex: string | null;
  city: string | null;
  status: string;
  listerName: string;
  listerType: 'organization' | 'individual';
  thumbUrl: string | null;
  artworkTone: 'green' | 'peach' | 'lilac' | 'sage';
}

/** What an applicant sees about their own request. */
export interface MyRequest {
  id: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  listing: RequestListingInfo;
  events: RequestEvent[];
  conversationId: string | null;
}

/** What a lister sees about a request for their pet. */
export interface IncomingRequest {
  id: string;
  status: string;
  unread: boolean;
  createdAt: string;
  applicant: { name: string; city: string; email: string; phone: string | null };
  homeType: string;
  housingPermission: string;
  household: string;
  otherPets: string | null;
  experience: string | null;
  message: string;
  conversationId: string | null;
}
