import { sql, type SelectQueryBuilder } from 'kysely';
import { jsonArrayFrom, jsonObjectFrom } from 'kysely/helpers/postgres';
import type { ArtworkTone, PetDetail, PetSummary, PhotoRef, SearchResult } from '../../../shared/listings.ts';
import { ageInMonths, ageLabel } from '../../../shared/listings.ts';
import type { SearchQuery } from '../../../shared/schemas/listings.ts';
import type { SessionUser } from '../auth/policies.ts';
import { canViewListing } from '../auth/policies.ts';
import type { DB } from '../db/database.ts';
import { notFound } from '../lib/errors.ts';

export const PAGE_SIZE = 9;

export function photoRef(p: { id: string; storage_key: string; width: number; height: number }): PhotoRef {
  return {
    id: p.id,
    url: `/uploads/${p.storage_key}-lg.webp`,
    thumbUrl: `/uploads/${p.storage_key}-sm.webp`,
    width: p.width,
    height: p.height,
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyBuilder = SelectQueryBuilder<any, any, any>;

/** Base select shared by every card-level query. */
export function summaryQuery(db: DB) {
  return db
    .selectFrom('listings as l')
    .leftJoin('organizations as o', 'o.id', 'l.organization_id')
    .select((eb) => [
      'l.id',
      'l.name',
      'l.species',
      'l.breed',
      'l.age_value',
      'l.age_unit',
      'l.sex',
      'l.listing_type',
      'l.fee',
      'l.city',
      'l.status',
      'l.artwork_tone',
      'l.is_sample',
      'l.organization_id',
      'l.published_at',
      'l.lat',
      'l.lng',
      'o.name as org_name',
      'o.verification_status as org_status',
      jsonObjectFrom(
        eb
          .selectFrom('listing_photos as p')
          .select(['p.id', 'p.storage_key', 'p.width', 'p.height'])
          .where('p.listing_id', '=', eb.ref('l.id'))
          .orderBy('p.position')
          .limit(1),
      ).as('cover'),
    ]);
}

type SummaryRow = Awaited<ReturnType<ReturnType<typeof summaryQuery>['executeTakeFirstOrThrow']>> & {
  distance?: number | null;
};

export function toSummary(row: SummaryRow): PetSummary {
  return {
    id: row.id,
    name: row.name,
    species: (row.species as PetSummary['species']) ?? null,
    breed: row.breed,
    ageLabel: ageLabel(row.age_value, row.age_unit),
    sex: (row.sex as PetSummary['sex']) ?? null,
    listingType: (row.listing_type as PetSummary['listingType']) ?? null,
    fee: row.fee,
    city: row.city,
    distanceMiles: row.distance == null ? null : Math.max(1, Math.round(row.distance)),
    lister: row.organization_id
      ? { type: 'organization', name: row.org_name ?? 'Shelter / rescue', verified: row.org_status === 'verified' }
      : { type: 'individual', name: 'Private pet parent', verified: false },
    cover: row.cover ? photoRef(row.cover) : null,
    artworkTone: (row.artwork_tone as ArtworkTone) ?? 'green',
    status: row.status,
    isSample: row.is_sample,
  };
}

const haversine = (lat: number, lng: number) =>
  sql<number>`3958.8 * 2 * asin(sqrt(
    power(sin(radians(l.lat - ${lat}) / 2), 2) +
    cos(radians(${lat})) * cos(radians(l.lat)) * power(sin(radians(l.lng - ${lng}) / 2), 2)
  ))`;

const cityKey = (text: string) => text.split(',')[0]!.trim().toLowerCase();

/** Resolve a typed city to coordinates using existing listings in that city (no external geocoder). */
async function resolveOrigin(db: DB, query: SearchQuery) {
  if (query.near) {
    const [lat, lng] = query.near.split(',').map(Number) as [number, number];
    return { lat, lng, label: 'your location', approximate: true };
  }
  if (!query.location) return null;
  const key = cityKey(query.location);
  if (!key) return null;
  const row = await db
    .selectFrom('listings')
    .select([sql<number>`avg(lat)`.as('lat'), sql<number>`avg(lng)`.as('lng')])
    .where(sql<string>`lower(split_part(city, ',', 1))`, '=', key)
    .where('lat', 'is not', null)
    .executeTakeFirst();
  if (row?.lat == null || row.lng == null) return null;
  const label = query.location.split(',')[0]!.trim();
  return { lat: Number(row.lat), lng: Number(row.lng), label, approximate: true };
}

function ageCondition(groups: string[]) {
  // Normalised age in months.
  const months = sql<number>`case l.age_unit when 'weeks' then l.age_value / 4.345 when 'months' then l.age_value else l.age_value * 12 end`;
  const parts = groups.map((g) =>
    g === 'young' ? sql`${months} < 12` : g === 'adult' ? sql`(${months} >= 12 and ${months} < 96)` : sql`${months} >= 96`,
  );
  return sql<boolean>`(${sql.join(parts, sql` or `)})`;
}

export async function searchListings(db: DB, query: SearchQuery): Promise<SearchResult> {
  const origin = await resolveOrigin(db, query);
  const radius = query.distance ?? 25;

  const filtered = <Q extends AnyBuilder>(b: Q): Q => {
    let q: AnyBuilder = b.where(sql`l.status`, '=', 'live');
    if (query.type.length) q = q.where(sql`l.species`, 'in', query.type);
    if (query.listing) q = q.where(sql`l.listing_type`, '=', query.listing);
    if (query.age.length) q = q.where(ageCondition(query.age));
    if (query.goodWith.length) q = q.where(sql<boolean>`l.good_with @> ${sql.val(query.goodWith)}::text[]`);
    if (origin) {
      q = q.where(sql`l.lat`, 'is not', null).where(haversine(origin.lat, origin.lng), '<=', radius);
    } else if (query.location) {
      const key = cityKey(query.location);
      q = q.where(sql<string>`lower(l.city)`, 'like', `%${key.replace(/[%_\\]/g, '\\$&')}%`);
    }
    return q as Q;
  };

  const countRow = (await filtered(db.selectFrom('listings as l'))
    .select(sql<number>`count(*)::int`.as('n'))
    .executeTakeFirst()) as { n?: number } | undefined;
  const total = countRow?.n ?? 0;

  let q = filtered(summaryQuery(db));
  if (origin) q = q.select(haversine(origin.lat, origin.lng).as('distance')) as typeof q;
  const sort = query.sort ?? (origin ? 'nearest' : 'newest');
  if (sort === 'nearest' && origin) q = q.orderBy(sql`distance`, 'asc');
  else if (sort === 'fee_low') q = q.orderBy(sql`coalesce(l.fee, 0)`, 'asc');
  q = q.orderBy('l.published_at', 'desc').orderBy('l.id');

  const rows = (await q
    .limit(PAGE_SIZE)
    .offset((query.page - 1) * PAGE_SIZE)
    .execute()) as SummaryRow[];

  return {
    items: rows.map(toSummary),
    total,
    page: query.page,
    pageSize: PAGE_SIZE,
    origin: origin ? { label: origin.label, approximate: origin.approximate } : null,
  };
}

export async function featuredListings(db: DB): Promise<PetSummary[]> {
  const rows = (await summaryQuery(db)
    .where('l.status', '=', 'live')
    .orderBy('l.published_at', 'desc')
    .limit(4)
    .execute()) as SummaryRow[];
  return rows.map(toSummary);
}

export async function getListingDetail(db: DB, id: string, viewer: SessionUser | null): Promise<PetDetail> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw notFound('That pet');
  const row = await summaryQuery(db)
    .innerJoin('users as u', 'u.id', 'l.owner_id')
    .select((eb) => [
      'l.owner_id',
      'l.headline',
      'l.about',
      'l.ideal_home',
      'l.rehoming_reason',
      'l.traits',
      'l.size',
      'l.good_with',
      'l.energy_level',
      'l.vaccinated',
      'l.spayed_neutered',
      'l.microchipped',
      'l.house_trained',
      'l.medical_notes',
      'l.behavior_notes',
      'l.care_needs',
      'u.location as owner_location',
      'o.city as org_city',
      jsonArrayFrom(
        eb
          .selectFrom('listing_photos as p')
          .select(['p.id', 'p.storage_key', 'p.width', 'p.height'])
          .where('p.listing_id', '=', eb.ref('l.id'))
          .orderBy('p.position'),
      ).as('photos'),
    ])
    .where('l.id', '=', id)
    .executeTakeFirst();

  if (!row || !canViewListing(viewer, row)) throw notFound('That pet');

  let saved = false;
  let requestId: string | null = null;
  if (viewer) {
    const fav = await db
      .selectFrom('favorites')
      .select('listing_id')
      .where('user_id', '=', viewer.id)
      .where('listing_id', '=', id)
      .executeTakeFirst();
    saved = Boolean(fav);
    const req = await db
      .selectFrom('adoption_requests')
      .select('id')
      .where('listing_id', '=', id)
      .where('applicant_id', '=', viewer.id)
      .where('status', 'not in', ['withdrawn', 'declined'])
      .executeTakeFirst();
    requestId = req?.id ?? null;
  }

  return {
    ...toSummary(row as SummaryRow),
    headline: row.headline,
    about: row.about,
    idealHome: row.ideal_home,
    rehomingReason: row.listing_type === 'rehoming' ? row.rehoming_reason : null,
    traits: row.traits,
    size: row.size,
    goodWith: row.good_with,
    energyLevel: row.energy_level,
    health: {
      vaccinated: row.vaccinated,
      spayedNeutered: row.spayed_neutered,
      microchipped: row.microchipped,
      houseTrained: row.house_trained,
    },
    medicalNotes: row.medical_notes,
    behaviorNotes: row.behavior_notes,
    careNeeds: row.care_needs,
    photos: row.photos.map(photoRef),
    listerCity: row.org_city ?? row.owner_location.split(',').slice(0, 2).join(',').trim(),
    publishedAt: row.published_at?.toISOString() ?? null,
    viewer: {
      isOwner: viewer?.id === row.owner_id,
      saved,
      hasActiveRequest: Boolean(requestId),
      requestId,
    },
  };
}

export { ageInMonths };
