import type { FastifyInstance, FastifyRequest } from 'fastify';
import { randomUUID } from 'node:crypto';
import { sql } from 'kysely';
import { z } from 'zod';
import { MAX_ACTIVE_INDIVIDUAL_LISTINGS, MAX_PHOTOS } from '../../../shared/constants.ts';
import {
  attestationsSchema,
  basicsSchema,
  draftPatchSchema,
  healthSchema,
  storySchema,
} from '../../../shared/schemas/listingForm.ts';
import { requireVerified } from '../auth/policies.ts';
import { requireUser } from '../auth/session.ts';
import type { DB } from '../db/database.ts';
import type { ListingRow } from '../db/schema.ts';
import { audit } from '../lib/audit.ts';
import { ApiError } from '../lib/errors.ts';
import { localStorage, processPhoto } from '../lib/photos.ts';
import { parse } from '../lib/validate.ts';
import { photoRef } from '../listings/repo.ts';
import { approximateCoordinates, COLUMN, loadOwnListing, toEditable } from '../listings/owner.ts';

const ACTIVE = ['pending', 'changes_requested', 'live', 'paused'] as const;
/** Statuses where content edits are allowed. */
const EDITABLE = new Set(['draft', 'changes_requested', 'pending', 'live', 'paused']);
const DELETABLE = new Set(['draft', 'changes_requested', 'rejected', 'paused']);

/** Editing a public listing sends it back to moderation. */
function statusAfterEdit(status: ListingRow['status']): ListingRow['status'] {
  return status === 'live' || status === 'paused' ? 'pending' : status;
}

function toColumns(patch: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    const col = COLUMN[k];
    if (col && v !== undefined) out[col] = typeof v === 'string' && v === '' ? null : v;
  }
  return out;
}

/** Converts a listing row into the camelCase shape the step schemas validate. */
function asForm(row: ListingRow) {
  return {
    name: row.name,
    species: row.species ?? undefined,
    breed: row.breed ?? undefined,
    sex: row.sex ?? undefined,
    ageValue: row.age_value ?? undefined,
    ageUnit: row.age_unit ?? undefined,
    size: row.size ?? undefined,
    listingType: row.listing_type ?? undefined,
    fee: row.fee ?? undefined,
    city: row.city ?? undefined,
    vaccinated: row.vaccinated ?? undefined,
    spayedNeutered: row.spayed_neutered ?? undefined,
    microchipped: row.microchipped ?? undefined,
    houseTrained: row.house_trained ?? undefined,
    goodWith: row.good_with,
    energyLevel: row.energy_level ?? undefined,
    medicalNotes: row.medical_notes ?? undefined,
    behaviorNotes: row.behavior_notes ?? undefined,
    careNeeds: row.care_needs ?? undefined,
    headline: row.headline ?? undefined,
    about: row.about ?? undefined,
    idealHome: row.ideal_home ?? undefined,
    rehomingReason: row.rehoming_reason ?? undefined,
    traits: row.traits,
    artworkTone: row.artwork_tone,
  };
}

/** Which wizard step each field belongs to (used to send people back to fix it). */
const STEP_OF: Record<string, number> = {
  name: 1, species: 1, breed: 1, sex: 1, ageValue: 1, ageUnit: 1, size: 1, listingType: 1, fee: 1, city: 1,
  vaccinated: 2, spayedNeutered: 2, microchipped: 2, houseTrained: 2, goodWith: 2, energyLevel: 2,
  medicalNotes: 2, behaviorNotes: 2, careNeeds: 2,
  headline: 3, about: 3, idealHome: 3, rehomingReason: 3, traits: 3, artworkTone: 3,
};

export function myListingRoutes(app: FastifyInstance, { db }: { db: DB }) {
  /* ---------- Overview (My listings 14:57) ---------- */
  app.get('/api/my/listings', async (req) => {
    const user = requireUser(req);
    const rows = await db
      .selectFrom('listings as l')
      .select((eb) => [
        'l.id',
        'l.name',
        'l.breed',
        'l.fee',
        'l.listing_type',
        'l.status',
        'l.artwork_tone',
        'l.updated_at',
        'l.moderation_note',
        eb
          .selectFrom('adoption_requests as r')
          .select(sql<number>`count(*)::int`.as('n'))
          .whereRef('r.listing_id', '=', 'l.id')
          .where('r.seller_unread', '=', true)
          .where('r.status', 'in', ['sent', 'in_review'])
          .as('new_requests'),
        eb
          .selectFrom('adoption_requests as r')
          .select(sql<number>`count(*)::int`.as('n'))
          .whereRef('r.listing_id', '=', 'l.id')
          .where('r.status', 'not in', ['withdrawn'])
          .as('total_requests'),
        eb
          .selectFrom('listing_photos as p')
          .select('p.storage_key')
          .whereRef('p.listing_id', '=', 'l.id')
          .orderBy('p.position')
          .limit(1)
          .as('cover_key'),
      ])
      .where('l.owner_id', '=', user.id)
      .orderBy('l.updated_at', 'desc')
      .execute();

    const items = rows.map((r) => ({
      id: r.id,
      name: r.name,
      breed: r.breed,
      fee: r.fee,
      listingType: r.listing_type,
      status: r.status,
      artworkTone: r.artwork_tone,
      updatedAt: r.updated_at.toISOString(),
      moderationNote: r.moderation_note,
      newRequests: r.new_requests ?? 0,
      totalRequests: r.total_requests ?? 0,
      thumbUrl: r.cover_key ? `/uploads/${r.cover_key}-sm.webp` : null,
    }));
    const count = (s: string) => items.filter((i) => i.status === s).length;
    return {
      items,
      stats: {
        live: count('live'),
        pending: count('pending') + count('changes_requested'),
        drafts: count('draft'),
        newRequests: items.reduce((n, i) => n + i.newRequests, 0),
      },
    };
  });

  /* ---------- Create a draft ---------- */
  app.post('/api/my/listings', async (req) => {
    const user = requireUser(req);
    requireVerified(user);
    const patch = parse(draftPatchSchema.required({ name: true }), req.body);
    const drafts = await db
      .selectFrom('listings')
      .select(sql<number>`count(*)::int`.as('n'))
      .where('owner_id', '=', user.id)
      .where('status', '=', 'draft')
      .executeTakeFirst();
    if ((drafts?.n ?? 0) >= 10) {
      throw new ApiError('CONFLICT', 'You have 10 drafts already. Finish or delete one before starting another.');
    }
    const row = await db
      .insertInto('listings')
      .values({
        ...(toColumns(patch) as object),
        name: patch.name,
        owner_id: user.id,
        organization_id: user.organization_id,
        status: 'draft',
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return { listing: await toEditable(db, row) };
  });

  app.get<{ Params: { id: string } }>('/api/my/listings/:id', async (req) => {
    const user = requireUser(req);
    return { listing: await toEditable(db, await loadOwnListing(db, user, req.params.id)) };
  });

  /* ---------- Save changes (draft-friendly) ---------- */
  app.patch<{ Params: { id: string } }>('/api/my/listings/:id', async (req) => {
    const user = requireUser(req);
    const row = await loadOwnListing(db, user, req.params.id);
    if (!EDITABLE.has(row.status)) throw new ApiError('CONFLICT', 'This listing can no longer be edited.');
    const patch = parse(draftPatchSchema, req.body);
    const columns = toColumns(patch);
    if (Object.keys(columns).length === 0) return { listing: await toEditable(db, row) };
    const nextStatus = statusAfterEdit(row.status);
    const updated = await db
      .updateTable('listings')
      .set({ ...(columns as object), status: nextStatus, updated_at: new Date() })
      .where('id', '=', row.id)
      .returningAll()
      .executeTakeFirstOrThrow();
    return { listing: await toEditable(db, updated), returnedToReview: nextStatus !== row.status };
  });

  /* ---------- Submit for review (14:53 → 14:55) ---------- */
  app.post<{ Params: { id: string } }>('/api/my/listings/:id/submit', async (req) => {
    const user = requireUser(req);
    requireVerified(user);
    const row = await loadOwnListing(db, user, req.params.id);
    if (!['draft', 'changes_requested'].includes(row.status)) {
      throw new ApiError('CONFLICT', 'This listing has already been submitted.');
    }
    const attestations = parse(z.object({ attestations: attestationsSchema }), req.body).attestations;

    // Full completeness check, reported per field with the step to return to.
    const form = asForm(row);
    const fields: Record<string, string> = {};
    for (const schema of [basicsSchema, healthSchema, storySchema(row.listing_type)]) {
      const result = schema.safeParse(form);
      if (!result.success) for (const i of result.error.issues) fields[String(i.path[0])] ??= i.message;
    }
    if (Object.keys(fields).length) {
      const step = Math.min(...Object.keys(fields).map((k) => STEP_OF[k] ?? 1));
      throw new ApiError('VALIDATION', `A few details still need your care (step ${step}).`, { fields });
    }

    if (user.account_type === 'organization') {
      const org = user.organization_id
        ? await db.selectFrom('organizations').select('verification_status').where('id', '=', user.organization_id).executeTakeFirst()
        : null;
      if (org?.verification_status !== 'verified') {
        throw new ApiError(
          'FORBIDDEN',
          'Your organization is still being verified. Your listing is saved as a draft and you can submit it once verification is complete.',
        );
      }
    } else {
      const active = await db
        .selectFrom('listings')
        .select(sql<number>`count(*)::int`.as('n'))
        .where('owner_id', '=', user.id)
        .where('status', 'in', ACTIVE)
        .where('id', '!=', row.id)
        .executeTakeFirst();
      if ((active?.n ?? 0) >= MAX_ACTIVE_INDIVIDUAL_LISTINGS) {
        throw new ApiError(
          'CONFLICT',
          `Individuals can have up to ${MAX_ACTIVE_INDIVIDUAL_LISTINGS} active listings. Mark a pet as rehomed or remove a listing first.`,
        );
      }
    }

    const coords = row.lat == null ? await approximateCoordinates(db, row.city) : null;
    await db.transaction().execute(async (trx) => {
      await trx
        .updateTable('listings')
        .set({
          status: 'pending',
          attestations: JSON.stringify(attestations),
          submitted_at: new Date(),
          updated_at: new Date(),
          moderation_note: null,
          ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
        })
        .where('id', '=', row.id)
        .execute();
      // Accepting the listing rules grants the seller capability to individuals.
      const u = await trx.selectFrom('users').select(['roles', 'listing_rules_accepted_at']).where('id', '=', user.id).executeTakeFirstOrThrow();
      if (!u.roles.includes('seller') || !u.listing_rules_accepted_at) {
        await trx
          .updateTable('users')
          .set({ roles: Array.from(new Set([...u.roles, 'seller'])), listing_rules_accepted_at: u.listing_rules_accepted_at ?? new Date() })
          .where('id', '=', user.id)
          .execute();
      }
    });
    await audit(db, req, { action: 'listing.submitted', entityType: 'listing', entityId: row.id });
    const updated = await loadOwnListing(db, user, row.id);
    return { listing: await toEditable(db, updated) };
  });

  /* ---------- Lifecycle ---------- */
  const transition = (from: ListingRow['status'][], to: ListingRow['status'], action: string) =>
    async (req: FastifyRequest) => {
      const user = requireUser(req);
      const row = await loadOwnListing(db, user, (req.params as { id: string }).id);
      if (!from.includes(row.status)) throw new ApiError('CONFLICT', 'That change isn’t available for this listing right now.');
      await db
        .updateTable('listings')
        .set({ status: to, updated_at: new Date(), ...(to === 'rehomed' ? { rehomed_at: new Date() } : {}) })
        .where('id', '=', row.id)
        .execute();
      if (to === 'rehomed') {
        // Let current applicants know the pet is no longer available.
        const open = await db
          .updateTable('adoption_requests')
          .set({ status: 'declined', updated_at: new Date() })
          .where('listing_id', '=', row.id)
          .where('status', 'in', ['sent', 'in_review', 'meet_invited'])
          .returning('id')
          .execute();
        if (open.length) {
          await db
            .insertInto('request_events')
            .values(open.map((r) => ({ request_id: r.id, status: 'declined', actor_id: user.id, note: `${row.name} has found a home.` })))
            .execute();
        }
      }
      await audit(db, req, { action, entityType: 'listing', entityId: row.id });
      return { listing: await toEditable(db, await loadOwnListing(db, user, row.id)) };
    };

  app.post('/api/my/listings/:id/pause', transition(['live'], 'paused', 'listing.paused'));
  app.post('/api/my/listings/:id/resume', transition(['paused'], 'live', 'listing.resumed'));
  app.post('/api/my/listings/:id/rehomed', transition(['live', 'paused'], 'rehomed', 'listing.rehomed'));

  app.delete<{ Params: { id: string } }>('/api/my/listings/:id', async (req) => {
    const user = requireUser(req);
    const row = await loadOwnListing(db, user, req.params.id);
    if (!DELETABLE.has(row.status)) {
      throw new ApiError('CONFLICT', 'Pause the listing or mark your pet as rehomed before removing it.');
    }
    const photos = await db.selectFrom('listing_photos').select('storage_key').where('listing_id', '=', row.id).execute();
    await db.deleteFrom('listings').where('id', '=', row.id).execute();
    await Promise.all(photos.map((p) => localStorage.removePrefix(p.storage_key)));
    await audit(db, req, { action: 'listing.deleted', entityType: 'listing', entityId: row.id, data: { name: row.name } });
    return { ok: true };
  });

  /* ---------- Photos ---------- */
  app.post<{ Params: { id: string } }>('/api/my/listings/:id/photos', async (req) => {
    const user = requireUser(req);
    const row = await loadOwnListing(db, user, req.params.id);
    if (!EDITABLE.has(row.status)) throw new ApiError('CONFLICT', 'This listing can no longer be edited.');
    const existing = await db
      .selectFrom('listing_photos')
      .select(sql<number>`count(*)::int`.as('n'))
      .where('listing_id', '=', row.id)
      .executeTakeFirst();
    if ((existing?.n ?? 0) >= MAX_PHOTOS) throw new ApiError('CONFLICT', `You can add up to ${MAX_PHOTOS} photos.`);

    const file = await req.file();
    if (!file) throw new ApiError('VALIDATION', 'Choose a photo to upload.');
    const buffer = await file.toBuffer();
    if (file.file.truncated) throw new ApiError('PAYLOAD_TOO_LARGE', 'That photo is larger than 8 MB.');

    const photoId = randomUUID();
    const key = `listings/${row.id}/${photoId}`;
    const size = await processPhoto(buffer, key);
    const photo = await db
      .insertInto('listing_photos')
      .values({ id: photoId, listing_id: row.id, position: existing?.n ?? 0, storage_key: key, ...size })
      .returning(['id', 'storage_key', 'width', 'height'])
      .executeTakeFirstOrThrow();
    const nextStatus = statusAfterEdit(row.status);
    await db.updateTable('listings').set({ updated_at: new Date(), status: nextStatus }).where('id', '=', row.id).execute();
    return { photo: photoRef(photo), returnedToReview: nextStatus !== row.status };
  });

  app.delete<{ Params: { id: string; photoId: string } }>('/api/my/listings/:id/photos/:photoId', async (req) => {
    const user = requireUser(req);
    const row = await loadOwnListing(db, user, req.params.id);
    if (!EDITABLE.has(row.status)) throw new ApiError('CONFLICT', 'This listing can no longer be edited.');
    const photo = await db
      .deleteFrom('listing_photos')
      .where('id', '=', req.params.photoId)
      .where('listing_id', '=', row.id)
      .returning('storage_key')
      .executeTakeFirst();
    if (photo) await localStorage.removePrefix(photo.storage_key);
    const remaining = await db.selectFrom('listing_photos').select('id').where('listing_id', '=', row.id).orderBy('position').execute();
    for (const [i, p] of remaining.entries()) {
      await db.updateTable('listing_photos').set({ position: i }).where('id', '=', p.id).execute();
    }
    await db.updateTable('listings').set({ updated_at: new Date(), status: statusAfterEdit(row.status) }).where('id', '=', row.id).execute();
    return { ok: true };
  });

  app.put<{ Params: { id: string } }>('/api/my/listings/:id/photos/order', async (req) => {
    const user = requireUser(req);
    const row = await loadOwnListing(db, user, req.params.id);
    const { ids } = parse(z.object({ ids: z.array(z.string().uuid()).max(MAX_PHOTOS) }), req.body);
    const current = await db.selectFrom('listing_photos').select('id').where('listing_id', '=', row.id).execute();
    const known = new Set(current.map((p) => p.id));
    if (ids.length !== known.size || !ids.every((i) => known.has(i))) {
      throw new ApiError('VALIDATION', 'Photo order doesn’t match this listing’s photos.');
    }
    for (const [i, id] of ids.entries()) {
      await db.updateTable('listing_photos').set({ position: i }).where('id', '=', id).execute();
    }
    await db.updateTable('listings').set({ updated_at: new Date(), status: statusAfterEdit(row.status) }).where('id', '=', row.id).execute();
    return { ok: true };
  });
}
