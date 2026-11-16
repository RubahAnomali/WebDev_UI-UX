import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { seedSampleData } from '../src/db/seed.ts';
import { Client, makeApp, signUp } from './helpers.ts';
import { testDb } from './setup.ts';

let app: FastifyInstance;
beforeAll(async () => {
  app = await makeApp();
});
afterAll(async () => {
  await app.close();
});
beforeEach(async () => {
  await seedSampleData(testDb);
});

const names = (body: { items: { name: string }[] }) => body.items.map((i) => i.name).sort();

describe('search', () => {
  it('lists live pets with summary fields only', async () => {
    const res = await new Client(app).get('/api/listings');
    const body = res.json();
    expect(body.total).toBe(6);
    const luna = body.items.find((i: { name: string }) => i.name === 'Luna');
    expect(luna.lister).toEqual({ type: 'organization', name: 'Happy Tails Rescue', verified: true });
    expect(luna).not.toHaveProperty('owner_id');
    const milo = body.items.find((i: { name: string }) => i.name === 'Milo');
    expect(milo.lister.name).toBe('Private pet parent');
  });

  it('filters by species, listing type, age and good-with', async () => {
    const c = new Client(app);
    expect(names((await c.get('/api/listings?type=cat')).json())).toEqual(['Milo', 'Poppy']);
    expect(names((await c.get('/api/listings?listing=rehoming')).json())).toEqual(['Milo', 'Teddy']);
    expect(names((await c.get('/api/listings?age=young')).json())).toEqual(['Willow']);
    expect(names((await c.get('/api/listings?type=dog&goodWith=children,dogs')).json())).toEqual(['Luna', 'Nala', 'Teddy']);
  });

  it('measures distance from a known city and sorts nearest first', async () => {
    const body = (await new Client(app).get('/api/listings?location=Austin,%20TX&distance=10')).json();
    expect(body.origin.label).toBe('Austin');
    expect(names(body)).toEqual(['Luna', 'Milo', 'Poppy']);
    const d = body.items.map((i: { distanceMiles: number }) => i.distanceMiles);
    expect([...d].sort((a, b) => a - b)).toEqual(d);
  });

  it('rejects unknown filter values', async () => {
    const res = await new Client(app).get('/api/listings?type=dragon&sort=bogus&page=-3');
    expect(res.statusCode).toBe(400);
  });

  it('treats LIKE wildcards in location literally', async () => {
    const body = (await new Client(app).get('/api/listings?location=%25')).json();
    expect(body.total).toBe(0);
  });
});

describe('visibility', () => {
  it('hides non-live listings from the public but shows them to the owner', async () => {
    const { client, userId } = await signUp(app);
    const draft = await testDb
      .insertInto('listings')
      .values({ owner_id: userId, name: 'Finn', status: 'draft' })
      .returning('id')
      .executeTakeFirstOrThrow();
    expect((await new Client(app).get(`/api/listings/${draft.id}`)).statusCode).toBe(404);
    const other = (await signUp(app)).client;
    expect((await other.get(`/api/listings/${draft.id}`)).statusCode).toBe(404);
    const own = await client.get(`/api/listings/${draft.id}`);
    expect(own.statusCode).toBe(200);
    expect(own.json().listing.viewer.isOwner).toBe(true);
    expect((await client.get('/api/listings')).json().total).toBe(6);
  });

  it('returns 404 for malformed ids', async () => {
    expect((await new Client(app).get('/api/listings/not-a-uuid')).statusCode).toBe(404);
  });
});

describe('favorites', () => {
  it('requires a session', async () => {
    const res = await new Client(app).get('/api/favorites');
    expect(res.statusCode).toBe(401);
  });

  it('saves, lists and removes pets', async () => {
    const { client } = await signUp(app);
    const luna = (await client.get('/api/listings?type=dog')).json().items.find((i: { name: string }) => i.name === 'Luna');
    expect((await client.put(`/api/favorites/${luna.id}`)).json()).toEqual({ saved: true });
    expect((await client.put(`/api/favorites/${luna.id}`)).statusCode).toBe(200); // idempotent
    expect((await client.get('/api/favorites/ids')).json().ids).toEqual([luna.id]);
    expect(names((await client.get('/api/favorites')).json())).toEqual(['Luna']);
    expect((await client.get(`/api/listings/${luna.id}`)).json().listing.viewer.saved).toBe(true);
    await client.del(`/api/favorites/${luna.id}`);
    expect((await client.get('/api/favorites')).json().items).toEqual([]);
  });

  it('cannot save a listing that is not live', async () => {
    const { client, userId } = await signUp(app);
    const draft = await testDb
      .insertInto('listings')
      .values({ owner_id: userId, name: 'Finn', status: 'pending' })
      .returning('id')
      .executeTakeFirstOrThrow();
    expect((await client.put(`/api/favorites/${draft.id}`)).statusCode).toBe(404);
  });
});
