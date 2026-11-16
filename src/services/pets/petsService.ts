import { http } from '../api/client';
import type { PetDetail, PetSummary, SearchResult } from './types';

export interface PetsService {
  getFeatured(signal?: AbortSignal): Promise<PetSummary[]>;
  search(params: URLSearchParams, signal?: AbortSignal): Promise<SearchResult>;
  get(id: string, signal?: AbortSignal): Promise<PetDetail>;
  listSaved(signal?: AbortSignal): Promise<PetSummary[]>;
  savedIds(): Promise<string[]>;
  setSaved(id: string, saved: boolean): Promise<boolean>;
}

export const petsService: PetsService = {
  getFeatured: (signal) => http.get<{ items: PetSummary[] }>('/api/listings/featured', signal).then((r) => r.items),
  search: (params, signal) => http.get<SearchResult>(`/api/listings?${params.toString()}`, signal),
  get: (id, signal) =>
    http.get<{ listing: PetDetail }>(`/api/listings/${encodeURIComponent(id)}`, signal).then((r) => r.listing),
  listSaved: (signal) => http.get<{ items: PetSummary[] }>('/api/favorites', signal).then((r) => r.items),
  savedIds: () => http.get<{ ids: string[] }>('/api/favorites/ids').then((r) => r.ids),
  setSaved: (id, saved) =>
    (saved
      ? http.put<{ saved: boolean }>(`/api/favorites/${id}`)
      : http.del<{ saved: boolean }>(`/api/favorites/${id}`)
    ).then((r) => r.saved),
};

/** Formats a fee for display, labelled per the approved design decision. */
export function feeLabel(fee: number | null | undefined, listingType: string | null | undefined) {
  const kind = listingType === 'rehoming' ? 'Rehoming fee' : 'Adoption fee';
  if (!fee) return { kind, amount: 'No fee', full: `${kind}: none` };
  return { kind, amount: `$${fee}`, full: `${kind} $${fee}` };
}

export const SEX_LABEL: Record<string, string> = { female: 'Female', male: 'Male', unknown: 'Sex unknown' };
