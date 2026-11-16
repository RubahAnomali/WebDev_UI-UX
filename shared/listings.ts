import type { ListingStatus, ListingType, Species } from './constants';

export type ArtworkTone = 'green' | 'peach' | 'lilac' | 'sage';

export interface PhotoRef {
  id: string;
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
}

/** Card-level listing data (search results, saved, featured). */
export interface PetSummary {
  id: string;
  name: string;
  species: Species | null;
  breed: string | null;
  ageLabel: string | null;
  sex: 'female' | 'male' | 'unknown' | null;
  listingType: ListingType | null;
  fee: number | null;
  city: string | null;
  distanceMiles: number | null;
  lister: { type: 'organization' | 'individual'; name: string; verified: boolean };
  cover: PhotoRef | null;
  artworkTone: ArtworkTone;
  status: ListingStatus;
  isSample: boolean;
}

export interface PetDetail extends PetSummary {
  headline: string | null;
  about: string | null;
  idealHome: string | null;
  rehomingReason: string | null;
  traits: string[];
  size: string | null;
  goodWith: string[];
  energyLevel: string | null;
  health: {
    vaccinated: string | null;
    spayedNeutered: string | null;
    microchipped: string | null;
    houseTrained: string | null;
  };
  medicalNotes: string | null;
  behaviorNotes: string | null;
  careNeeds: string | null;
  photos: PhotoRef[];
  listerCity: string | null;
  publishedAt: string | null;
  viewer: { isOwner: boolean; saved: boolean; hasActiveRequest: boolean; requestId: string | null };
}

export interface SearchResult {
  items: PetSummary[];
  total: number;
  page: number;
  pageSize: number;
  /** Where distance was measured from, when known. */
  origin: { label: string; approximate: boolean } | null;
}

export const SEARCH_DISTANCES = [10, 25, 50, 100] as const;
export const AGE_GROUPS = ['young', 'adult', 'senior'] as const;
export type AgeGroup = (typeof AGE_GROUPS)[number];
export const SORTS = ['nearest', 'newest', 'fee_low'] as const;
export type SortOption = (typeof SORTS)[number];

export function ageLabel(value: number | null, unit: string | null): string | null {
  if (value == null || !unit) return null;
  const singular = unit.replace(/s$/, '');
  return `${value} ${value === 1 ? singular : `${singular}s`}`;
}

/** Age in months, used for the Young (< 1 yr) / Adult (1–7) / Senior (8+) filter. */
export function ageInMonths(value: number | null, unit: string | null): number | null {
  if (value == null || !unit) return null;
  if (unit === 'weeks') return value / 4.345;
  if (unit === 'months') return value;
  return value * 12;
}
