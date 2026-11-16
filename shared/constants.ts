/** Values shared by the web client and the API. */
export const SPECIES = ['dog', 'cat', 'small', 'bird'] as const;
export type Species = (typeof SPECIES)[number];

export const SPECIES_LABEL: Record<Species, string> = {
  dog: 'Dog',
  cat: 'Cat',
  small: 'Small pet',
  bird: 'Bird & more',
};

export const LISTING_TYPES = ['adoption', 'rehoming'] as const;
export type ListingType = (typeof LISTING_TYPES)[number];

export const LISTING_STATUSES = ['draft', 'pending', 'changes_requested', 'live', 'paused', 'rehomed', 'rejected'] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const REQUEST_STATUSES = ['sent', 'in_review', 'meet_invited', 'approved', 'declined', 'withdrawn'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const ACCOUNT_TYPES = ['individual', 'organization'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ROLES = ['member', 'seller', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export const ORG_VERIFICATION = ['not_applicable', 'pending', 'verified', 'rejected'] as const;
export type OrganizationVerification = (typeof ORG_VERIFICATION)[number];

export const SEX = ['female', 'male', 'unknown'] as const;
export const AGE_UNITS = ['weeks', 'months', 'years'] as const;
export const SIZES = ['small', 'medium', 'large', 'extra_large'] as const;
export const TRISTATE = ['yes', 'no', 'unknown'] as const;
export const ENERGY = ['low', 'moderate', 'high'] as const;
export const GOOD_WITH = ['children', 'dogs', 'cats', 'adults'] as const;
export const HOME_TYPES = ['house', 'apartment', 'townhouse', 'other'] as const;
export const HOUSING_PERMISSION = ['own', 'rent_allowed', 'rent_pending', 'other'] as const;

export const REPORT_TARGETS = ['listing', 'user', 'conversation'] as const;
export const REPORT_REASONS = [
  'scam_or_fraud',
  'animal_welfare',
  'prohibited_animal',
  'misleading_information',
  'harassment',
  'other',
] as const;

export const REPORT_REASON_LABEL: Record<(typeof REPORT_REASONS)[number], string> = {
  scam_or_fraud: 'Scam, deposit request, or fraud',
  animal_welfare: 'Animal welfare concern',
  prohibited_animal: 'Prohibited animal or sale',
  misleading_information: 'Misleading information',
  harassment: 'Harassment or abuse',
  other: 'Something else',
};

export const MAX_PHOTOS = 8;
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
export const MAX_ACTIVE_INDIVIDUAL_LISTINGS = 3;
export const RESEND_COOLDOWN_SECONDS = 60;
export const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
export const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;
