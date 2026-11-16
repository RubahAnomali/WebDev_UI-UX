import type { FastifyInstance } from 'fastify';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ATTEST, Client, createListing, makeApp, multipart, signUp } from './helpers.ts';
import { testDb } from './setup.ts';

let app: FastifyInstance;
beforeAll(async () => {
  app = await makeApp();
});
afterAll(async () => {
  await app.close();
});

describe('drafts', () => {
  it('requires a session to create a listing', async () => {
    expect((await new Client(app).post('/api/my/listings', { name: 'Finn' })).statusCode).toBe(401);
  });

  it('saves partial drafts and keeps them private', async () => {
    const { client } = await signUp(app);
    const res = await client.post('/api/my/listings', { name: 'Olive' });
    expect(res.statusCode).toBe(200);
    const { id, status } = res.json().listing;
    expect(status).toBe('draft');
    const patched = await client.patch(`/api/my/listings/${id}`, { species: 'cat', breed: 'Tabby' });
    expect(patched.json().listing.breed).toBe('Tabby');
    expect((await client.get('/api/my/listings')).json().stats.drafts).toBe(1);
    expect((await new Client(app).get(`/api/listings/${id}`)).statusCode).toBe(404);
  });

  it('rejects malformed values even in drafts', async () => {
    const { client } = await signUp(app);
    const { id } = await createListing(client);
    const res = await client.patch(`/api/my/listings/${id}`, { species: 'tiger', fee: 99999 });
    expect(res.statusCode).toBe(400);
    expect(Object.keys(res.json().error.fields)).toEqual(expect.arrayContaining(['species', 'fee']));
  });

  it('hides other people’s listings (404, not 403)', async () => {
    const { client } = await signUp(app);
    const { id } = await createListing(client);
    const other = (await signUp(app)).client;
    expect((await other.get(`/api/my/listings/${id}`)).statusCode).toBe(404);
    expect((await other.patch(`/api/my/listings/${id}`, { name: 'Mine now' })).statusCode).toBe(404);
    expect((await other.post(`/api/my/listings/${id}/submit`, ATTEST)).statusCode).toBe(404);
    expect((await other.del(`/api/my/listings/${id}`)).statusCode).toBe(404);
  });
});

describe('submit', () => {
  it('requires every attestation', async () => {
    const { client } = await signUp(app);
    const { id } = await createListing(client);
    const res = await client.post(`/api/my/listings/${id}/submit`, { attestations: { owner: true } });
    expect(res.statusCode).toBe(400);
  });

  it('reports missing fields with the step to return to', async () => {
    const { client } = await signUp(app);
    const res = await client.post('/api/my/listings', { name: 'Olive', species: 'cat' });
    const out = await client.post(`/api/my/listings/${res.json().listing.id}/submit`, ATTEST);
    expect(out.statusCode).toBe(400);
    expect(out.json().error.message).toMatch(/step 1/);
    expect(out.json().error.fields).toHaveProperty('breed');
  });

  it('blocks contact details in public text', async () => {
    const { client } = await signUp(app);
    const { id } = await createListing(client, { about: 'Lovely cat, text me at (512) 555-0142 or finn@example.com for details!' });
    const res = await client.post(`/api/my/listings/${id}/submit`, ATTEST);
    expect(res.statusCode).toBe(400);
    expect(res.json().error.fields.about).toMatch(/phone numbers, emails/);
  });

  it('moves to pending review and grants the seller capability to individuals', async () => {
    const { client, userId } = await signUp(app);
    const { id } = await createListing(client);
    const res = await client.post(`/api/my/listings/${id}/submit`, ATTEST);
    expect(res.statusCode).toBe(200);
    expect(res.json().listing.status).toBe('pending');
    const user = await testDb.selectFrom('users').select(['roles', 'listing_rules_accepted_at']).where('id', '=', userId).executeTakeFirstOrThrow();
    expect(user.roles).toContain('seller');
    expect(user.roles).not.toContain('admin');
    expect(user.listing_rules_accepted_at).not.toBeNull();
    // Still not public until a moderator approves it.
    expect((await new Client(app).get(`/api/listings/${id}`)).statusCode).toBe(404);
  });

  it('keeps unverified shelters in draft', async () => {
    const { client } = await signUp(app, { accountType: 'organization' });
    const { id } = await createListing(client, { listingType: 'adoption', rehomingReason: null });
    const res = await client.post(`/api/my/listings/${id}/submit`, ATTEST);
    expect(res.statusCode).toBe(403);
    expect(res.json().error.message).toMatch(/still being verified/);
  });

  it('limits individuals to 3 active listings', async () => {
    const { client } = await signUp(app);
    for (let i = 0; i < 3; i++) {
      const { id } = await createListing(client, { name: `Pet ${i}` });
      expect((await client.post(`/api/my/listings/${id}/submit`, ATTEST)).statusCode).toBe(200);
    }
    const { id } = await createListing(client, { name: 'Pet 4' });
    const res = await client.post(`/api/my/listings/${id}/submit`, ATTEST);
    expect(res.statusCode).toBe(409);
  });
});

describe('lifecycle', () => {
  async function liveListing() {
    const ctx = await signUp(app);
    const { id } = await createListing(ctx.client);
    await ctx.client.post(`/api/my/listings/${id}/submit`, ATTEST);
    await testDb.updateTable('listings').set({ status: 'live', published_at: new Date() }).where('id', '=', id).execute();
    return { ...ctx, id };
  }

  it('pauses, resumes and marks rehomed, closing open requests', async () => {
    const { client, id } = await liveListing();
    expect((await client.post(`/api/my/listings/${id}/pause`)).json().listing.status).toBe('paused');
    expect((await new Client(app).get(`/api/listings?type=cat`)).json().total).toBe(0);
    expect((await client.post(`/api/my/listings/${id}/resume`)).json().listing.status).toBe('live');

    const adopter = await signUp(app);
    await testDb
      .insertInto('adoption_requests')
      .values({
        listing_id: id,
        applicant_id: adopter.userId,
        full_name: 'A',
        email: adopter.email,
        city: 'Austin',
        home_type: 'house',
        housing_permission: 'own',
        household: 'Two adults',
        message: 'Hello',
      })
      .execute();
    expect((await client.post(`/api/my/listings/${id}/rehomed`)).json().listing.status).toBe('rehomed');
    const req = await testDb.selectFrom('adoption_requests').select('status').executeTakeFirstOrThrow();
    expect(req.status).toBe('declined');
    expect((await client.post(`/api/my/listings/${id}/pause`)).statusCode).toBe(409);
  });

  it('sends edited live listings back to review', async () => {
    const { client, id } = await liveListing();
    const res = await client.patch(`/api/my/listings/${id}`, { about: 'Finn is a curious cat who now also loves watching birds from the window.' });
    expect(res.json().returnedToReview).toBe(true);
    expect(res.json().listing.status).toBe('pending');
  });

  it('only deletes listings that are not live', async () => {
    const { client, id } = await liveListing();
    expect((await client.del(`/api/my/listings/${id}`)).statusCode).toBe(409);
    await client.post(`/api/my/listings/${id}/pause`);
    expect((await client.del(`/api/my/listings/${id}`)).statusCode).toBe(200);
  });
});

describe('photos', () => {
  async function jpegWithGps() {
    return sharp({ create: { width: 800, height: 600, channels: 3, background: '#e6ecdf' } })
      .jpeg()
      .withExif({ IFD0: { Copyright: 'Private owner' }, IFD3: { GPSLatitudeRef: 'N', GPSLongitudeRef: 'W' } })
      .toBuffer();
  }

  it('re-encodes uploads to WebP and strips metadata', async () => {
    const original = await jpegWithGps();
    expect((await sharp(original).metadata()).exif).toBeDefined();
    const { client } = await signUp(app);
    const { id } = await createListing(client);
    const body = multipart(original);
    const res = await client.request({ method: 'POST', url: `/api/my/listings/${id}/photos`, ...body });
    expect(res.statusCode).toBe(200);
    const photo = res.json().photo;
    expect(photo.url).toMatch(/-lg\.webp$/);
    const file = await app.inject({ method: 'GET', url: photo.url });
    expect(file.statusCode).toBe(200);
    const meta = await sharp(file.rawPayload).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.exif).toBeUndefined();
  });

  it('rejects non-images even with an image filename', async () => {
    const { client } = await signUp(app);
    const { id } = await createListing(client);
    const body = multipart(Buffer.from('<script>alert(1)</script>'), 'cute.jpg');
    const res = await client.request({ method: 'POST', url: `/api/my/listings/${id}/photos`, ...body });
    expect(res.statusCode).toBe(415);
  });

  it('reorders and deletes photos', async () => {
    const { client } = await signUp(app);
    const { id } = await createListing(client);
    const ids: string[] = [];
    for (let i = 0; i < 2; i++) {
      const res = await client.request({ method: 'POST', url: `/api/my/listings/${id}/photos`, ...multipart(await jpegWithGps()) });
      ids.push(res.json().photo.id);
    }
    expect((await client.put(`/api/my/listings/${id}/photos/order`, { ids: [ids[1], ids[0]] })).statusCode).toBe(200);
    expect((await client.get(`/api/my/listings/${id}`)).json().listing.photos.map((p: { id: string }) => p.id)).toEqual([ids[1], ids[0]]);
    await client.del(`/api/my/listings/${id}/photos/${ids[1]}`);
    expect((await client.get(`/api/my/listings/${id}`)).json().listing.photos).toHaveLength(1);
  });
});
