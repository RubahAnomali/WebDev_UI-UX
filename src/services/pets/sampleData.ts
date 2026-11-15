/**
 * SAMPLE DATA — illustrative listings from the Figma design, used only until
 * the listings API exists. These are not real pets available for adoption.
 */
import luna from '../../assets/figma/pet-luna.svg';
import milo from '../../assets/figma/pet-milo.svg';
import teddy from '../../assets/figma/pet-teddy.svg';
import willow from '../../assets/figma/pet-willow.svg';
import type { PetSummary } from './types';

export const SAMPLE_FEATURED_PETS: PetSummary[] = [
  {
    id: 'sample-luna',
    name: 'Luna',
    species: 'dog',
    breed: 'Golden retriever',
    age: '2 years',
    sex: 'Female',
    listingType: 'adoption',
    fee: 150,
    city: 'Austin, TX',
    distanceMiles: 3,
    lister: { type: 'organization', name: 'Happy Tails Rescue' },
    artwork: luna,
  },
  {
    id: 'sample-milo',
    name: 'Milo',
    species: 'cat',
    breed: 'Domestic shorthair',
    age: '1 year',
    sex: 'Male',
    listingType: 'rehoming',
    fee: 50,
    city: 'Austin, TX',
    distanceMiles: 5,
    lister: { type: 'individual', name: 'Private pet parent' },
    artwork: milo,
  },
  {
    id: 'sample-willow',
    name: 'Willow',
    species: 'small',
    breed: 'Holland lop rabbit',
    age: '8 months',
    sex: 'Female',
    listingType: 'adoption',
    fee: 75,
    city: 'Round Rock, TX',
    distanceMiles: 12,
    lister: { type: 'organization', name: 'Little Paws Sanctuary' },
    artwork: willow,
  },
  {
    id: 'sample-teddy',
    name: 'Teddy',
    species: 'dog',
    breed: 'Cavalier spaniel',
    age: '3 years',
    sex: 'Male',
    listingType: 'rehoming',
    fee: 100,
    city: 'Cedar Park, TX',
    distanceMiles: 16,
    lister: { type: 'individual', name: 'Private pet parent' },
    artwork: teddy,
  },
];
