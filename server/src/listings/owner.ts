import { sql } from 'kysely';
import type { EditableListing } from '../../../shared/schemas/listingForm.ts';
import type { DB } from '../db/database.ts';
import type { ListingRow } from '../db/schema.ts';
import { notFound } from '../lib/errors.ts';
import { photoRef } from './repo.ts';
import type { SessionUser } from '../auth/policies.ts';
import { assertCanManageListing } from '../auth/policies.ts';

const UUID = /^[0-9a-f-]{36}$/i;

/** Loads a listing the user owns (404 for anything else, so ids can't be probed). */
export async function loadOwnListing(db: DB, user: SessionUser, id: string): Promise<ListingRow> {
  if (!UUID.test(id)) throw notFound('That listing');
  const row = await db.selectFrom('listings').selectAll().where('id', '=', id).executeTakeFirst();
  if (!row || row.owner_id !== user.id) throw notFound('That listing');
  assertCanManageListing(user, row);
  return row;
}

export async function toEditable(db: DB, row: ListingRow): Promise<EditableListing> {
  const photos = await db
    .selectFrom('listing_photos')
    .select(['id', 'storage_key', 'width', 'height'])
    .where('listing_id', '=', row.id)
    .orderBy('position')
    .execute();
  return {
    id: row.id,
    status: row.status,
    name: row.name,
    species: row.species,
    breed: row.breed,
    sex: row.sex,
    ageValue: row.age_value,
    ageUnit: row.age_unit,
    size: row.size,
    listingType: row.listing_type,
    fee: row.fee,
    city: row.city,
    lat: row.lat,
    lng: row.lng,
    vaccinated: row.vaccinated,
    spayedNeutered: row.spayed_neutered,
    microchipped: row.microchipped,
    houseTrained: row.house_trained,
    goodWith: row.good_with,
    energyLevel: row.energy_level,
    medicalNotes: row.medical_notes,
    behaviorNotes: row.behavior_notes,
    careNeeds: row.care_needs,
    headline: row.headline,
    about: row.about,
    idealHome: row.ideal_home,
    rehomingReason: row.rehoming_reason,
    traits: row.traits,
    artworkTone: (row.artwork_tone as EditableListing['artworkTone']) ?? 'green',
    photos: photos.map(photoRef),
    moderationNote: row.moderation_note,
    updatedAt: row.updated_at.toISOString(),
  };
}

/** camelCase patch → snake_case columns. */
export const COLUMN: Record<string, string> = {
  name: 'name',
  species: 'species',
  breed: 'breed',
  sex: 'sex',
  ageValue: 'age_value',
  ageUnit: 'age_unit',
  size: 'size',
  listingType: 'listing_type',
  fee: 'fee',
  city: 'city',
  lat: 'lat',
  lng: 'lng',
  vaccinated: 'vaccinated',
  spayedNeutered: 'spayed_neutered',
  microchipped: 'microchipped',
  houseTrained: 'house_trained',
  goodWith: 'good_with',
  energyLevel: 'energy_level',
  medicalNotes: 'medical_notes',
  behaviorNotes: 'behavior_notes',
  careNeeds: 'care_needs',
  headline: 'headline',
  about: 'about',
  idealHome: 'ideal_home',
  rehomingReason: 'rehoming_reason',
  traits: 'traits',
  artworkTone: 'artwork_tone',
};

/** Fills coordinates from other listings in the same city when none were provided. */
export async function approximateCoordinates(db: DB, city: string | null) {
  if (!city) return null;
  const key = city.split(',')[0]!.trim().toLowerCase();
  const row = await db
    .selectFrom('listings')
    .select([sql<number>`avg(lat)`.as('lat'), sql<number>`avg(lng)`.as('lng')])
    .where(sql<string>`lower(split_part(city, ',', 1))`, '=', key)
    .where('lat', 'is not', null)
    .executeTakeFirst();
  return row?.lat == null ? null : { lat: Number(row.lat), lng: Number(row.lng) };
}
