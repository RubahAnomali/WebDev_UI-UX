export type Species = 'dog' | 'cat' | 'small' | 'bird';
export type ListingType = 'adoption' | 'rehoming';
export type ListerType = 'organization' | 'individual';

export interface PetSummary {
  id: string;
  name: string;
  species: Species;
  breed: string;
  age: string;
  sex: 'Female' | 'Male';
  listingType: ListingType;
  /** Adoption / rehoming fee in whole USD. 0 = no fee. */
  fee: number;
  city: string;
  distanceMiles?: number;
  lister: { type: ListerType; name: string };
  /** Local artwork (the design uses paw artwork instead of photos). */
  artwork: string;
}
