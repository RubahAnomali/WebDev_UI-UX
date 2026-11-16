import type { AdoptionRequestInput, IncomingRequest, MyRequest } from '../../../shared/schemas/requests';
import { http } from '../api/client';

export type { IncomingRequest, MyRequest } from '../../../shared/schemas/requests';

export const requestsService = {
  send: (listingId: string, input: AdoptionRequestInput) =>
    http.post<{ request: MyRequest }>(`/api/listings/${listingId}/requests`, input).then((r) => r.request),
  mine: (signal?: AbortSignal) => http.get<{ items: MyRequest[] }>('/api/requests', signal).then((r) => r.items),
  get: (id: string, signal?: AbortSignal) => http.get<{ request: MyRequest }>(`/api/requests/${id}`, signal).then((r) => r.request),
  withdraw: (id: string) => http.post<{ request: MyRequest }>(`/api/requests/${id}/withdraw`).then((r) => r.request),

  forListing: (listingId: string, signal?: AbortSignal) =>
    http.get<{ listing: { id: string; name: string; status: string }; items: IncomingRequest[] }>(
      `/api/my/listings/${listingId}/requests`,
      signal,
    ),
  open: (id: string) => http.get<{ request: IncomingRequest }>(`/api/my/requests/${id}`).then((r) => r.request),
  decide: (id: string, action: 'invite' | 'approve' | 'decline', note?: string) =>
    http.post<{ request: IncomingRequest }>(`/api/my/requests/${id}/${action}`, note ? { note } : {}).then((r) => r.request),
};
