import type { FastifyInstance, FastifyRequest } from 'fastify';
import { sql } from 'kysely';
import { z } from 'zod';
import { ageLabel } from '../../../shared/listings.ts';
import { containsContactInfo } from '../../../shared/schemas/listingForm.ts';
import { requireRole } from '../auth/policies.ts';
import { destroyAllSessions, requireUser } from '../auth/session.ts';
import { config } from '../config.ts';
import type { DB } from '../db/database.ts';
import { audit } from '../lib/audit.ts';
import { ApiError, notFound } from '../lib/errors.ts';
import type { Mailer } from '../lib/mailer.ts';
import { parse } from '../lib/validate.ts';
import { photoRef } from '../listings/repo.ts';

const UUID = /^[0-9a-f-]{36}$/i;
const CHECKS = ['ownership', 'health', 'welfare', 'noContact'] as const;

const decisionSchema = z
  .object({
    decision: z.enum(['approve', 'request_changes', 'reject']),
    reason: z.string().trim().max(1000).optional(),
    checklist: z.object(Object.fromEntries(CHECKS.map((c) => [c, z.boolean()])) as Record<(typeof CHECKS)[number], z.ZodBoolean>),
  })
  .superRefine((v, ctx) => {
    if (v.decision === 'approve' && !CHECKS.every((c) => v.checklist[c])) {
      ctx.addIssue({ code: 'custom', path: ['checklist'], message: 'Complete every checklist item before approving.' });
    }
    if (v.decision !== 'approve' && (v.reason ?? '').length < 10) {
      ctx.addIssue({ code: 'custom', path: ['reason'], message: 'Explain what needs to change (10+ characters).' });
    }
  });

const resolveSchema = z.object({
  status: z.enum(['resolved', 'dismissed']),
  note: z.string().trim().min(3, 'Add a short note.').max(1000),
  action: z.enum(['none', 'pause_listing', 'suspend_user']).default('none'),
});

const orgDecisionSchema = z
  .object({ decision: z.enum(['verify', 'reject']), note: z.string().trim().max(1000).optional() })
  .superRefine((v, ctx) => {
    if (v.decision === 'reject' && (v.note ?? '').length < 10) {
      ctx.addIssue({ code: 'custom', path: ['note'], message: 'Explain why (10+ characters).' });
    }
  });

/** Every route here is staff-only. Authorization happens on the server for each request. */
function requireAdmin(req: FastifyRequest) {
  const user = requireUser(req);
  requireRole(user, 'admin');
  return user;
}

export function adminRoutes(app: FastifyInstance, { db, mailer }: { db: DB; mailer: Mailer }) {
  const startOfToday = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  };

  app.get('/api/admin/summary', async (req) => {
    requireAdmin(req);
    const count = async (q: Promise<{ n: number } | undefined>) => (await q)?.n ?? 0;
    return {
      pendingListings: await count(
        db.selectFrom('listings').select(sql<number>`count(*)::int`.as('n')).where('status', '=', 'pending').executeTakeFirst(),
      ),
      openReports: await count(
        db.selectFrom('reports').select(sql<number>`count(*)::int`.as('n')).where('status', '=', 'open').executeTakeFirst(),
      ),
      pendingOrganizations: await count(
        db.selectFrom('organizations').select(sql<number>`count(*)::int`.as('n')).where('verification_status', '=', 'pending').executeTakeFirst(),
      ),
      reviewedToday: await count(
        db
          .selectFrom('moderation_actions')
          .select(sql<number>`count(*)::int`.as('n'))
          .where('created_at', '>=', startOfToday())
          .executeTakeFirst(),
      ),
    };
  });

  /* ---------- Listing review ---------- */

  app.get('/api/admin/listings', async (req) => {
    requireAdmin(req);
    const rows = await db
      .selectFrom('listings as l')
      .innerJoin('users as u', 'u.id', 'l.owner_id')
      .leftJoin('organizations as o', 'o.id', 'l.organization_id')
      .select(['l.id', 'l.name', 'l.listing_type', 'l.submitted_at', 'u.full_name', 'u.account_type', 'o.name as org_name'])
      .where('l.status', '=', 'pending')
      .orderBy('l.submitted_at', 'asc')
      .execute();
    return {
      items: rows.map((r) => ({
        id: r.id,
        name: r.name,
        listingType: r.listing_type,
        submittedAt: r.submitted_at?.toISOString() ?? null,
        lister: r.org_name ?? r.full_name,
        listerType: r.account_type,
      })),
    };
  });

  app.get<{ Params: { id: string } }>('/api/admin/listings/:id', async (req) => {
    requireAdmin(req);
    if (!UUID.test(req.params.id)) throw notFound('That listing');
    const l = await db
      .selectFrom('listings as l')
      .innerJoin('users as u', 'u.id', 'l.owner_id')
      .leftJoin('organizations as o', 'o.id', 'l.organization_id')
      .selectAll('l')
      .select([
        'u.full_name as owner_name',
        'u.email_verified_at as owner_verified',
        'u.location as owner_location',
        'u.account_type as owner_type',
        'u.created_at as owner_since',
        'o.name as org_name',
        'o.verification_status as org_status',
      ])
      .where('l.id', '=', req.params.id)
      .executeTakeFirst();
    if (!l) throw notFound('That listing');
    const photos = await db.selectFrom('listing_photos').select(['id', 'storage_key', 'width', 'height']).where('listing_id', '=', l.id).orderBy('position').execute();
    const history = await db
      .selectFrom('moderation_actions as m')
      .innerJoin('users as u', 'u.id', 'm.moderator_id')
      .select(['m.decision', 'm.reason', 'm.created_at', 'u.full_name'])
      .where('m.listing_id', '=', l.id)
      .orderBy('m.created_at', 'desc')
      .execute();
    const publicText = [l.headline, l.about, l.ideal_home, l.rehoming_reason, l.medical_notes, l.behavior_notes, l.care_needs].filter(Boolean).join('\n');
    const previous = await db
      .selectFrom('listings')
      .select(sql<number>`count(*)::int`.as('n'))
      .where('owner_id', '=', l.owner_id)
      .where('status', 'in', ['live', 'rehomed'])
      .executeTakeFirst();

    return {
      listing: {
        id: l.id,
        name: l.name,
        status: l.status,
        species: l.species,
        breed: l.breed,
        sex: l.sex,
        ageLabel: ageLabel(l.age_value, l.age_unit),
        size: l.size,
        listingType: l.listing_type,
        fee: l.fee,
        city: l.city,
        headline: l.headline,
        about: l.about,
        idealHome: l.ideal_home,
        rehomingReason: l.rehoming_reason,
        medicalNotes: l.medical_notes,
        behaviorNotes: l.behavior_notes,
        health: { vaccinated: l.vaccinated, spayedNeutered: l.spayed_neutered, microchipped: l.microchipped, houseTrained: l.house_trained },
        attestations: l.attestations,
        artworkTone: l.artwork_tone,
        photos: photos.map(photoRef),
        submittedAt: l.submitted_at?.toISOString() ?? null,
        flags: { contactInfo: containsContactInfo(publicText) },
        owner: {
          name: l.owner_name,
          emailVerified: Boolean(l.owner_verified),
          location: l.owner_location,
          accountType: l.owner_type,
          memberSince: l.owner_since.toISOString(),
          previousListings: previous?.n ?? 0,
          organization: l.org_name ? { name: l.org_name, verification: l.org_status } : null,
        },
        history: history.map((h) => ({ decision: h.decision, reason: h.reason, at: h.created_at.toISOString(), moderator: h.full_name })),
      },
    };
  });

  app.post<{ Params: { id: string } }>('/api/admin/listings/:id/decision', async (req) => {
    const admin = requireAdmin(req);
    if (!UUID.test(req.params.id)) throw notFound('That listing');
    const input = parse(decisionSchema, req.body);
    const l = await db
      .selectFrom('listings as l')
      .innerJoin('users as u', 'u.id', 'l.owner_id')
      .leftJoin('organizations as o', 'o.id', 'l.organization_id')
      .select(['l.id', 'l.name', 'l.status', 'l.published_at', 'l.owner_id', 'u.email', 'o.verification_status as org_status', 'l.organization_id'])
      .where('l.id', '=', req.params.id)
      .executeTakeFirst();
    if (!l) throw notFound('That listing');
    if (l.status !== 'pending') throw new ApiError('CONFLICT', 'This listing isn’t waiting for review.');
    if (l.owner_id === admin.id) throw new ApiError('FORBIDDEN', 'You can’t review your own listing.');
    if (input.decision === 'approve' && l.organization_id && l.org_status !== 'verified') {
      throw new ApiError('CONFLICT', 'Verify this organization before approving its listings.');
    }

    const status = { approve: 'live', request_changes: 'changes_requested', reject: 'rejected' }[input.decision] as 'live';
    await db.transaction().execute(async (trx) => {
      await trx
        .updateTable('listings')
        .set({
          status,
          moderation_note: input.decision === 'approve' ? null : input.reason!,
          updated_at: new Date(),
          ...(input.decision === 'approve' ? { published_at: l.published_at ?? new Date() } : {}),
        })
        .where('id', '=', l.id)
        .execute();
      await trx
        .insertInto('moderation_actions')
        .values({ moderator_id: admin.id, listing_id: l.id, decision: input.decision, reason: input.reason || null, checklist: JSON.stringify(input.checklist) })
        .execute();
    });
    await audit(db, req, { action: `listing.${input.decision}`, entityType: 'listing', entityId: l.id, data: { reason: input.reason ?? null } });

    const mail = {
      approve: { subject: `${l.name}’s listing is live`, body: `Good news — ${l.name}’s listing passed review and is now visible on Pawhaven.` },
      request_changes: { subject: `A few details need your care: ${l.name}`, body: `Our moderators asked for changes before ${l.name}’s listing can go live: ${input.reason}` },
      reject: { subject: `${l.name}’s listing wasn’t approved`, body: `${l.name}’s listing wasn’t approved: ${input.reason}` },
    }[input.decision];
    await mailer.send({ to: l.email, ...mail, link: `${config.appOrigin}/my-listings` });
    return { status };
  });

  /* ---------- Reports ---------- */

  async function reportTarget(r: { target_type: string; target_id: string | null; reporter_id: string | null }) {
    if (!r.target_id) return { label: 'Not linked', userId: null as string | null, listingId: null as string | null };
    if (r.target_type === 'listing') {
      const l = await db.selectFrom('listings').select(['id', 'name', 'owner_id', 'status']).where('id', '=', r.target_id).executeTakeFirst();
      return l ? { label: `Listing · ${l.name} (${l.status})`, userId: l.owner_id, listingId: l.id } : { label: 'Listing removed', userId: null, listingId: null };
    }
    if (r.target_type === 'conversation') {
      const other = await db
        .selectFrom('conversation_participants as p')
        .innerJoin('users as u', 'u.id', 'p.user_id')
        .innerJoin('conversations as c', 'c.id', 'p.conversation_id')
        .innerJoin('listings as l', 'l.id', 'c.listing_id')
        .select(['u.id', 'u.full_name', 'l.name as listing_name', 'l.id as listing_id'])
        .where('p.conversation_id', '=', r.target_id)
        .where('p.user_id', '!=', r.reporter_id ?? '00000000-0000-0000-0000-000000000000')
        .executeTakeFirst();
      return other
        ? { label: `Conversation with ${other.full_name} about ${other.listing_name}`, userId: other.id, listingId: other.listing_id }
        : { label: 'Conversation', userId: null, listingId: null };
    }
    if (r.target_type === 'user') {
      const u = await db.selectFrom('users').select(['id', 'full_name']).where('id', '=', r.target_id).executeTakeFirst();
      return u ? { label: `Member · ${u.full_name}`, userId: u.id, listingId: null } : { label: 'Member', userId: null, listingId: null };
    }
    return { label: 'General', userId: null, listingId: null };
  }

  app.get<{ Querystring: { status?: string } }>('/api/admin/reports', async (req) => {
    requireAdmin(req);
    const status: ('open' | 'resolved' | 'dismissed')[] = req.query.status === 'closed' ? ['resolved', 'dismissed'] : ['open'];
    const rows = await db
      .selectFrom('reports as r')
      .leftJoin('users as u', 'u.id', 'r.reporter_id')
      .select(['r.id', 'r.target_type', 'r.target_id', 'r.reporter_id', 'r.reason', 'r.status', 'r.created_at', 'u.full_name as reporter_name', 'r.reporter_email'])
      .where('r.status', 'in', status)
      .orderBy('r.created_at', status[0] === 'open' ? 'asc' : 'desc')
      .limit(100)
      .execute();
    return {
      items: await Promise.all(
        rows.map(async (r) => ({
          id: r.id,
          targetType: r.target_type,
          target: (await reportTarget(r)).label,
          reason: r.reason,
          status: r.status,
          reporter: r.reporter_name ?? r.reporter_email ?? 'Anonymous',
          createdAt: r.created_at.toISOString(),
        })),
      ),
    };
  });

  app.get<{ Params: { id: string } }>('/api/admin/reports/:id', async (req) => {
    requireAdmin(req);
    if (!UUID.test(req.params.id)) throw notFound('That report');
    const r = await db
      .selectFrom('reports as r')
      .leftJoin('users as u', 'u.id', 'r.reporter_id')
      .selectAll('r')
      .select(['u.full_name as reporter_name', 'u.email as reporter_account_email'])
      .where('r.id', '=', req.params.id)
      .executeTakeFirst();
    if (!r) throw notFound('That report');
    const target = await reportTarget(r);
    let messages: { from: string; body: string; at: string }[] = [];
    if (r.target_type === 'conversation' && r.target_id) {
      // Reading a reported conversation is logged.
      await audit(db, req, { action: 'report.viewed_conversation', entityType: 'conversation', entityId: r.target_id, data: { reportId: r.id } });
      const rows = await db
        .selectFrom('messages as m')
        .innerJoin('users as u', 'u.id', 'm.sender_id')
        .select(['u.full_name', 'm.body', 'm.created_at'])
        .where('m.conversation_id', '=', r.target_id)
        .orderBy('m.created_at', 'desc')
        .limit(30)
        .execute();
      messages = rows.reverse().map((m) => ({ from: m.full_name, body: m.body, at: m.created_at.toISOString() }));
    }
    return {
      report: {
        id: r.id,
        targetType: r.target_type,
        target: target.label,
        targetListingId: target.listingId,
        targetUserId: target.userId,
        link: r.target_link,
        reason: r.reason,
        details: r.details,
        status: r.status,
        reporter: r.reporter_name ?? r.reporter_email ?? 'Anonymous',
        reporterEmail: r.reporter_account_email ?? r.reporter_email,
        createdAt: r.created_at.toISOString(),
        resolutionNote: r.resolution_note,
        messages,
      },
    };
  });

  app.post<{ Params: { id: string } }>('/api/admin/reports/:id/resolve', async (req) => {
    const admin = requireAdmin(req);
    if (!UUID.test(req.params.id)) throw notFound('That report');
    const input = parse(resolveSchema, req.body);
    const r = await db.selectFrom('reports').selectAll().where('id', '=', req.params.id).executeTakeFirst();
    if (!r) throw notFound('That report');
    if (r.status !== 'open') throw new ApiError('CONFLICT', 'This report is already closed.');
    const target = await reportTarget(r);

    if (input.action === 'pause_listing') {
      if (!target.listingId) throw new ApiError('CONFLICT', 'There’s no listing to pause for this report.');
      await db.updateTable('listings').set({ status: 'paused', updated_at: new Date() }).where('id', '=', target.listingId).where('status', '=', 'live').execute();
    }
    if (input.action === 'suspend_user') {
      if (!target.userId) throw new ApiError('CONFLICT', 'There’s no member to suspend for this report.');
      const u = await db.selectFrom('users').select(['roles']).where('id', '=', target.userId).executeTakeFirstOrThrow();
      if (u.roles.includes('admin') || target.userId === admin.id) throw new ApiError('FORBIDDEN', 'Staff accounts can’t be suspended here.');
      await db.updateTable('users').set({ status: 'suspended', updated_at: new Date() }).where('id', '=', target.userId).execute();
      await db.updateTable('listings').set({ status: 'paused' }).where('owner_id', '=', target.userId).where('status', '=', 'live').execute();
      await destroyAllSessions(db, target.userId);
    }
    await db
      .updateTable('reports')
      .set({ status: input.status, resolution_note: input.note, resolved_by: admin.id, resolved_at: new Date() })
      .where('id', '=', r.id)
      .execute();
    await audit(db, req, { action: `report.${input.status}`, entityType: 'report', entityId: r.id, data: { action: input.action, note: input.note } });
    return { ok: true };
  });

  /* ---------- Organizations ---------- */

  app.get('/api/admin/organizations', async (req) => {
    requireAdmin(req);
    const rows = await db
      .selectFrom('organizations as o')
      .leftJoin('users as u', 'u.organization_id', 'o.id')
      .select(['o.id', 'o.name', 'o.city', 'o.verification_status', 'o.created_at', 'u.full_name', 'u.email', 'u.email_verified_at'])
      .where('o.verification_status', '=', 'pending')
      .orderBy('o.created_at')
      .execute();
    return {
      items: rows.map((o) => ({
        id: o.id,
        name: o.name,
        city: o.city,
        status: o.verification_status,
        createdAt: o.created_at.toISOString(),
        contact: o.full_name ? { name: o.full_name, email: o.email, emailVerified: Boolean(o.email_verified_at) } : null,
      })),
    };
  });

  app.post<{ Params: { id: string } }>('/api/admin/organizations/:id/decision', async (req) => {
    const admin = requireAdmin(req);
    if (!UUID.test(req.params.id)) throw notFound('That organization');
    const input = parse(orgDecisionSchema, req.body);
    const org = await db.selectFrom('organizations').selectAll().where('id', '=', req.params.id).executeTakeFirst();
    if (!org) throw notFound('That organization');
    const status = input.decision === 'verify' ? 'verified' : 'rejected';
    await db
      .updateTable('organizations')
      .set({ verification_status: status, verified_by: admin.id, verified_at: new Date(), verification_note: input.note || null })
      .where('id', '=', org.id)
      .execute();
    const members = await db.selectFrom('users').select(['id', 'roles', 'email']).where('organization_id', '=', org.id).execute();
    for (const m of members) {
      if (status === 'verified' && !m.roles.includes('seller')) {
        await db.updateTable('users').set({ roles: [...m.roles, 'seller'] }).where('id', '=', m.id).execute();
      }
      await mailer.send({
        to: m.email,
        subject: status === 'verified' ? `${org.name} is verified on Pawhaven` : `About ${org.name}’s verification`,
        body:
          status === 'verified'
            ? 'Your organization is verified. You can now submit listings for review.'
            : `We couldn’t verify your organization: ${input.note}`,
        link: `${config.appOrigin}/my-listings`,
      });
    }
    await audit(db, req, { action: `organization.${input.decision}`, entityType: 'organization', entityId: org.id, data: { note: input.note ?? null } });
    return { status };
  });

  /* ---------- Members ---------- */

  app.get<{ Querystring: { q?: string } }>('/api/admin/users', async (req) => {
    requireAdmin(req);
    const q = String(req.query.q ?? '').trim().toLowerCase();
    let query = db
      .selectFrom('users')
      .select(['id', 'full_name', 'email', 'roles', 'status', 'account_type', 'created_at', 'email_verified_at'])
      .where('status', '!=', 'deleted')
      .where('is_sample', '=', false)
      .orderBy('created_at', 'desc')
      .limit(50);
    if (q) {
      const like = `%${q.replace(/[%_\\]/g, '\\$&')}%`;
      query = query.where((eb) => eb.or([eb(sql`lower(full_name)`, 'like', like), eb('email', 'like', like)]));
    }
    const rows = await query.execute();
    return {
      items: rows.map((u) => ({
        id: u.id,
        name: u.full_name,
        email: u.email,
        roles: u.roles,
        status: u.status,
        accountType: u.account_type,
        emailVerified: Boolean(u.email_verified_at),
        createdAt: u.created_at.toISOString(),
      })),
    };
  });

  for (const action of ['suspend', 'reinstate'] as const) {
    app.post<{ Params: { id: string } }>(`/api/admin/users/:id/${action}`, async (req) => {
      const admin = requireAdmin(req);
      if (!UUID.test(req.params.id)) throw notFound('That member');
      const { note } = parse(z.object({ note: z.string().trim().min(3, 'Add a short note.').max(500) }), req.body);
      const u = await db.selectFrom('users').select(['id', 'roles', 'status']).where('id', '=', req.params.id).executeTakeFirst();
      if (!u || u.status === 'deleted') throw notFound('That member');
      if (u.id === admin.id || u.roles.includes('admin')) throw new ApiError('FORBIDDEN', 'Staff accounts can’t be changed here.');
      await db
        .updateTable('users')
        .set({ status: action === 'suspend' ? 'suspended' : 'active', updated_at: new Date() })
        .where('id', '=', u.id)
        .execute();
      if (action === 'suspend') {
        await destroyAllSessions(db, u.id);
        await db.updateTable('listings').set({ status: 'paused' }).where('owner_id', '=', u.id).where('status', '=', 'live').execute();
      }
      await audit(db, req, { action: `user.${action}`, entityType: 'user', entityId: u.id, data: { note } });
      return { status: action === 'suspend' ? 'suspended' : 'active' };
    });
  }

  /* ---------- Audit trail ---------- */

  app.get('/api/admin/audit', async (req) => {
    requireAdmin(req);
    const rows = await db
      .selectFrom('audit_log as a')
      .leftJoin('users as u', 'u.id', 'a.actor_id')
      .select(['a.id', 'a.action', 'a.entity_type', 'a.entity_id', 'a.data', 'a.created_at', 'u.full_name'])
      .orderBy('a.created_at', 'desc')
      .limit(150)
      .execute();
    return {
      items: rows.map((r) => ({
        id: r.id,
        action: r.action,
        entityType: r.entity_type,
        entityId: r.entity_id,
        data: r.data,
        actor: r.full_name ?? 'System',
        at: r.created_at.toISOString(),
      })),
    };
  });
}
