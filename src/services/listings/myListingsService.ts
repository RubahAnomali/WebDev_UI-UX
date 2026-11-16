import type { DraftPatch, EditableListing } from '../../../shared/schemas/listingForm';
import { http } from '../api/client';

export type { EditableListing } from '../../../shared/schemas/listingForm';

export interface MyListingRow {
  id: string;
  name: string;
  breed: string | null;
  fee: number | null;
  listingType: string | null;
  status: EditableListing['status'];
  artworkTone: EditableListing['artworkTone'];
  updatedAt: string;
  moderationNote: string | null;
  newRequests: number;
  totalRequests: number;
  thumbUrl: string | null;
}

export interface MyListingsOverview {
  items: MyListingRow[];
  stats: { live: number; pending: number; drafts: number; newRequests: number };
}

const base = '/api/my/listings';

export const myListingsService = {
  overview: (signal?: AbortSignal) => http.get<MyListingsOverview>(base, signal),
  get: (id: string, signal?: AbortSignal) => http.get<{ listing: EditableListing }>(`${base}/${id}`, signal).then((r) => r.listing),
  create: (patch: DraftPatch & { name: string }) => http.post<{ listing: EditableListing }>(base, patch).then((r) => r.listing),
  update: (id: string, patch: DraftPatch) =>
    http.patch<{ listing: EditableListing; returnedToReview?: boolean }>(`${base}/${id}`, patch),
  submit: (id: string, attestations: { owner: boolean; accurate: boolean; rules: boolean }) =>
    http.post<{ listing: EditableListing }>(`${base}/${id}/submit`, { attestations }).then((r) => r.listing),
  pause: (id: string) => http.post(`${base}/${id}/pause`),
  resume: (id: string) => http.post(`${base}/${id}/resume`),
  markRehomed: (id: string) => http.post(`${base}/${id}/rehomed`),
  remove: (id: string) => http.del(`${base}/${id}`),
  uploadPhoto: (id: string, file: File) => {
    const form = new FormData();
    form.append('photo', file);
    return http.post<{ photo: EditableListing['photos'][number] }>(`${base}/${id}/photos`, form).then((r) => r.photo);
  },
  deletePhoto: (id: string, photoId: string) => http.del(`${base}/${id}/photos/${photoId}`),
  reorderPhotos: (id: string, ids: string[]) => http.put(`${base}/${id}/photos/order`, { ids }),
};
