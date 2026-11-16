import type { PetSummary } from '../services/pets/types';

export const pet = (overrides: Partial<PetSummary> = {}): PetSummary => ({
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Luna',
  species: 'dog',
  breed: 'Golden retriever',
  ageLabel: '2 years',
  sex: 'female',
  listingType: 'adoption',
  fee: 150,
  city: 'Austin, TX',
  distanceMiles: 3,
  lister: { type: 'organization', name: 'Happy Tails Rescue', verified: true },
  cover: null,
  artworkTone: 'green',
  status: 'live',
  isSample: true,
  ...overrides,
});
