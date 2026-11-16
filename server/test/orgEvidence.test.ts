import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { adminClient, makeApp, signUp } from './helpers.ts';
import { testDb } from './setup.ts';

let app: FastifyInstance;
beforeAll(async () => {
  app = await makeApp();
});
afterAll(async () => {
  await app.close();
});

describe('shelter verification evidence', () => {
  it('accepts a reference instead of a website and rejects bad links', async () => {
    const shelter = await signUp(app, { accountType: 'organization' });
    const bad = await shelter.client.patch('/api/account/organization', { organizationName: 'Happy Tails', registrationNumber: 'TX-1', website: 'happytails' });
    expect(bad.statusCode).toBe(400);
    const ok = await shelter.client.patch('/api/account/organization', {
      organizationName: 'Happy Tails Rescue',
      registrationNumber: 'TX-501C3-99',
      website: '',
      reference: 'Dr. Lee, Austin Vet Clinic, (512) 555-0100',
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().user.organization).toMatchObject({ registrationNumber: 'TX-501C3-99', website: null });
  });

  it('only organization accounts can edit organization details', async () => {
    const member = await signUp(app);
    expect((await member.client.patch('/api/account/organization', { organizationName: 'X' })).statusCode).toBe(403);
  });

  it('shows evidence to staff and refuses to verify without it', async () => {
    const shelter = await signUp(app, { accountType: 'organization' });
    const { client } = await adminClient(app);
    const item = (await client.get('/api/admin/organizations')).json().items[0];
    expect(item.evidence).toEqual({ registrationNumber: 'TX-501C3-12345', website: 'https://happytails.example.org', reference: null });

    // A legacy shelter with no evidence can't be verified until it adds some.
    await testDb.updateTable('organizations').set({ registration_number: null }).where('id', '=', item.id).execute();
    expect((await client.post(`/api/admin/organizations/${item.id}/decision`, { decision: 'verify' })).statusCode).toBe(409);
    await testDb.updateTable('organizations').set({ registration_number: 'TX-1' }).where('id', '=', item.id).execute();
    expect((await client.post(`/api/admin/organizations/${item.id}/decision`, { decision: 'verify' })).statusCode).toBe(200);

    // Once verified, details are locked.
    const locked = await shelter.client.patch('/api/account/organization', { organizationName: 'Other', registrationNumber: 'TX-2', website: 'https://x.example.org' });
    expect(locked.statusCode).toBe(409);
  });

  it('a declined shelter that updates its evidence returns to the queue', async () => {
    const shelter = await signUp(app, { accountType: 'organization' });
    const { client } = await adminClient(app);
    const item = (await client.get('/api/admin/organizations')).json().items[0];
    await client.post(`/api/admin/organizations/${item.id}/decision`, { decision: 'reject', note: 'We could not find this registration number.' });
    expect((await shelter.client.get('/api/auth/me')).json().user.organization.verification).toBe('rejected');
    await shelter.client.patch('/api/account/organization', { organizationName: 'Happy Tails Rescue', registrationNumber: 'TX-501C3-77', website: 'https://happytails.example.org' });
    expect((await client.get('/api/admin/organizations')).json().items.map((o: { id: string }) => o.id)).toContain(item.id);
  });
});
