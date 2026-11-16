/**
 * SAMPLE DATA from the Figma design. Every row is flagged `is_sample = true`
 * and the UI labels these listings as samples — they are not real pets.
 * Re-running the seed replaces previous sample rows.
 */
import type { DB } from './database.ts';
import { hashPassword, randomToken } from '../lib/crypto.ts';

const AUSTIN = { lat: 30.2672, lng: -97.7431 };
const ROUND_ROCK = { lat: 30.5083, lng: -97.6789 };
const CEDAR_PARK = { lat: 30.5052, lng: -97.8203 };

export async function seedSampleData(db: DB) {
  await db.deleteFrom('listings').where('is_sample', '=', true).execute();
  await db.deleteFrom('users').where('is_sample', '=', true).execute();
  await db.deleteFrom('organizations').where('is_sample', '=', true).execute();

  const unusable = await hashPassword(randomToken(32)); // sample owners can't log in
  const now = Date.now();

  const [happyTails, littlePaws] = await Promise.all(
    [
      { name: 'Happy Tails Rescue', city: 'Austin, Texas' },
      { name: 'Little Paws Sanctuary', city: 'Round Rock, Texas' },
    ].map((o) =>
      db
        .insertInto('organizations')
        .values({ ...o, verification_status: 'verified', verified_at: new Date(), is_sample: true })
        .returning('id')
        .executeTakeFirstOrThrow(),
    ),
  );

  const owner = async (email: string, name: string, location: string, orgId: string | null) =>
    (
      await db
        .insertInto('users')
        .values({
          email,
          full_name: name,
          location,
          account_type: orgId ? 'organization' : 'individual',
          password_hash: unusable,
          roles: ['member', 'seller'],
          organization_id: orgId,
          email_verified_at: new Date(),
          listing_rules_accepted_at: new Date(),
          terms_accepted_at: new Date(),
          is_sample: true,
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;

  const htOwner = await owner('sample+happytails@pawhaven.local', 'Happy Tails Team', 'Austin, TX', happyTails!.id);
  const lpOwner = await owner('sample+littlepaws@pawhaven.local', 'Little Paws Team', 'Round Rock, TX', littlePaws!.id);
  const jordan = await owner('sample+jordan@pawhaven.local', 'Jordan Lee', 'Austin, TX', null);
  const casey = await owner('sample+casey@pawhaven.local', 'Casey Rivera', 'Cedar Park, TX', null);

  const base = {
    status: 'live' as const,
    is_sample: true,
    attestations: JSON.stringify({ owner: true, accurate: true, rules: true }),
  };

  const pets = [
    {
      owner_id: htOwner,
      organization_id: happyTails!.id,
      name: 'Luna',
      headline: 'A gentle soul, ready for her people.',
      species: 'dog',
      breed: 'Golden retriever',
      sex: 'female',
      age_value: 2,
      age_unit: 'years',
      size: 'large',
      listing_type: 'adoption',
      fee: 150,
      city: 'Austin, TX',
      ...AUSTIN,
      vaccinated: 'yes',
      spayed_neutered: 'yes',
      microchipped: 'yes',
      house_trained: 'yes',
      good_with: ['children', 'dogs', 'adults'],
      energy_level: 'moderate',
      care_needs: 'Daily walks and regular grooming',
      traits: ['Gentle', 'Playful', 'Good with dogs'],
      about:
        'Luna is a curious, affectionate companion who loves slow morning walks, weekend adventures, and being close to her favorite people. She’s looking for a calm, caring home with time for play, training, and plenty of cuddles.',
      ideal_home: 'A patient home with a secure yard and people who enjoy daily walks.',
      medical_notes: 'No known medical conditions. Up to date on routine care.',
      artwork_tone: 'green',
    },
    {
      owner_id: jordan,
      organization_id: null,
      name: 'Milo',
      headline: 'A curious soul. A sunny-window kind of companion.',
      species: 'cat',
      breed: 'Domestic shorthair',
      sex: 'male',
      age_value: 1,
      age_unit: 'years',
      size: 'small',
      listing_type: 'rehoming',
      fee: 50,
      city: 'Austin, TX',
      lat: AUSTIN.lat + 0.03,
      lng: AUSTIN.lng - 0.05,
      vaccinated: 'yes',
      spayed_neutered: 'yes',
      microchipped: 'yes',
      house_trained: 'yes',
      good_with: ['adults', 'cats'],
      energy_level: 'moderate',
      care_needs: 'Indoor only, daily play sessions',
      traits: ['Curious', 'Affectionate', 'Indoor cat'],
      about: 'Milo is a curious, gentle cat who loves a sunny windowsill and an evening play session with a feather wand.',
      ideal_home: 'A calm indoor home with someone who can make time for play.',
      rehoming_reason: 'My housing circumstances have changed and I can no longer keep pets.',
      medical_notes: 'No known medical conditions.',
      artwork_tone: 'peach',
    },
    {
      owner_id: lpOwner,
      organization_id: littlePaws!.id,
      name: 'Willow',
      headline: 'Soft ears, big personality.',
      species: 'small',
      breed: 'Holland lop rabbit',
      sex: 'female',
      age_value: 8,
      age_unit: 'months',
      size: 'small',
      listing_type: 'adoption',
      fee: 75,
      city: 'Round Rock, TX',
      ...ROUND_ROCK,
      vaccinated: 'yes',
      spayed_neutered: 'yes',
      microchipped: 'no',
      house_trained: 'yes',
      good_with: ['adults', 'children'],
      energy_level: 'low',
      care_needs: 'Hay-based diet and daily time outside her pen',
      traits: ['Calm', 'Litter trained'],
      about: 'Willow is a calm, curious rabbit who loves fresh greens and a quiet corner to explore.',
      ideal_home: 'A quiet home with space for a large pen and supervised free-roam time.',
      artwork_tone: 'lilac',
    },
    {
      owner_id: casey,
      organization_id: null,
      name: 'Teddy',
      headline: 'A cuddly companion for calm days.',
      species: 'dog',
      breed: 'Cavalier spaniel',
      sex: 'male',
      age_value: 3,
      age_unit: 'years',
      size: 'small',
      listing_type: 'rehoming',
      fee: 100,
      city: 'Cedar Park, TX',
      ...CEDAR_PARK,
      vaccinated: 'yes',
      spayed_neutered: 'yes',
      microchipped: 'yes',
      house_trained: 'yes',
      good_with: ['adults', 'children', 'dogs'],
      energy_level: 'low',
      care_needs: 'Short daily walks and weekly brushing',
      traits: ['Cuddly', 'Quiet', 'Good with kids'],
      about: 'Teddy is a gentle, people-loving spaniel who is happiest curled up beside you.',
      ideal_home: 'A calm home where someone is around for much of the day.',
      rehoming_reason: 'A new work schedule means Teddy would be alone too much.',
      artwork_tone: 'sage',
    },
    {
      owner_id: htOwner,
      organization_id: happyTails!.id,
      name: 'Poppy',
      headline: 'Quietly confident and full of love.',
      species: 'cat',
      breed: 'Domestic shorthair',
      sex: 'female',
      age_value: 4,
      age_unit: 'years',
      size: 'small',
      listing_type: 'adoption',
      fee: 80,
      city: 'Austin, TX',
      lat: AUSTIN.lat - 0.04,
      lng: AUSTIN.lng + 0.02,
      vaccinated: 'yes',
      spayed_neutered: 'yes',
      microchipped: 'yes',
      house_trained: 'yes',
      good_with: ['adults'],
      energy_level: 'low',
      care_needs: 'A quiet space to settle in',
      traits: ['Independent', 'Gentle'],
      about: 'Poppy takes a little time to warm up, then follows you from room to room.',
      ideal_home: 'An adult-only home without other pets.',
      artwork_tone: 'peach',
    },
    {
      owner_id: lpOwner,
      organization_id: littlePaws!.id,
      name: 'Nala',
      headline: 'Adventure buddy in training.',
      species: 'dog',
      breed: 'Mixed breed',
      sex: 'female',
      age_value: 18,
      age_unit: 'months',
      size: 'medium',
      listing_type: 'adoption',
      fee: 120,
      city: 'Round Rock, TX',
      lat: ROUND_ROCK.lat - 0.02,
      lng: ROUND_ROCK.lng + 0.03,
      vaccinated: 'yes',
      spayed_neutered: 'yes',
      microchipped: 'yes',
      house_trained: 'unknown',
      good_with: ['dogs', 'children', 'adults'],
      energy_level: 'high',
      care_needs: 'Daily exercise and ongoing training',
      traits: ['Energetic', 'Smart', 'Good with dogs'],
      about: 'Nala is a bright, bouncy young dog who loves fetch, puzzles, and making new friends.',
      ideal_home: 'An active home that enjoys hikes and training together.',
      artwork_tone: 'green',
    },
  ];

  for (const [i, pet] of pets.entries()) {
    const at = new Date(now - (i + 1) * 3600_000);
    await db
      .insertInto('listings')
      .values({ ...base, ...pet, submitted_at: at, published_at: at, created_at: at, updated_at: at })
      .execute();
  }
  return pets.length;
}
