import type { FastifyInstance } from 'fastify';
import { searchQuerySchema } from '../../../shared/schemas/listings.ts';
import { requireUser } from '../auth/session.ts';
import type { DB } from '../db/database.ts';
import { notFound } from '../lib/errors.ts';
import { featuredListings, getListingDetail, summaryQuery, toSummary } from '../listings/repo.ts';
import { searchListings } from '../listings/repo.ts';
import { parse } from '../lib/validate.ts';

const UUID = /^[0-9a-f-]{36}$/i;

export function listingRoutes(app: FastifyInstance, { db }: { db: DB }) {
  app.get('/api/listings', async (req) => searchListings(db, parse(searchQuerySchema, req.query)));

  app.get('/api/listings/featured', async () => ({ items: await featuredListings(db) }));

  app.get<{ Params: { id: string } }>('/api/listings/:id', async (req) => ({
    listing: await getListingDetail(db, req.params.id, req.user),
  }));

  /* ---------- Favorites (saved pets) ---------- */

  app.get('/api/favorites', async (req) => {
    const user = requireUser(req);
    const rows = await summaryQuery(db)
      .innerJoin('favorites as f', 'f.listing_id', 'l.id')
      .where('f.user_id', '=', user.id)
      // Saved pets stay visible after rehoming so people learn what happened.
      .where('l.status', 'in', ['live', 'paused', 'rehomed'])
      .orderBy('f.created_at', 'desc')
      .execute();
    return { items: rows.map(toSummary) };
  });

  app.get('/api/favorites/ids', async (req) => {
    const user = requireUser(req);
    const rows = await db.selectFrom('favorites').select('listing_id').where('user_id', '=', user.id).execute();
    return { ids: rows.map((r) => r.listing_id) };
  });

  app.put<{ Params: { id: string } }>('/api/favorites/:id', async (req) => {
    const user = requireUser(req);
    if (!UUID.test(req.params.id)) throw notFound('That pet');
    const listing = await db
      .selectFrom('listings')
      .select('id')
      .where('id', '=', req.params.id)
      .where('status', '=', 'live')
      .executeTakeFirst();
    if (!listing) throw notFound('That pet');
    await db
      .insertInto('favorites')
      .values({ user_id: user.id, listing_id: listing.id })
      .onConflict((oc) => oc.doNothing())
      .execute();
    return { saved: true };
  });

  app.delete<{ Params: { id: string } }>('/api/favorites/:id', async (req) => {
    const user = requireUser(req);
    if (!UUID.test(req.params.id)) throw notFound('That pet');
    await db.deleteFrom('favorites').where('user_id', '=', user.id).where('listing_id', '=', req.params.id).execute();
    return { saved: false };
  });
}
