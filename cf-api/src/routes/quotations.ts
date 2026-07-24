import { and, eq, like, or, sql } from 'drizzle-orm';
import type { Env } from '../types';
import { err, ok, uuid, nowISO } from '../utils/helpers';
import { requireAuth } from '../utils/middleware';
import { createDb, type AppDb } from '../db/client';
import { appSettings as appSettingsTbl, bookings, customers, quotations } from '../db/schema';

export async function handleQuotations(req: Request, env: Env, path: string): Promise<Response> {
  const url = new URL(req.url);
  const db = createDb(env);

  // GET /api/quotations - list
  if (path === '/api/quotations' && req.method === 'GET') {
    try {
      const payload = await requireAuth(req, env);
      if (payload.role !== 'admin') return err('Admin only', 403);

      const status = url.searchParams.get('status');
      const query = url.searchParams.get('q') || '';
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);
      const offset = parseInt(url.searchParams.get('offset') || '0');

      let conditions = [];
      if (status) conditions.push(eq(quotations.status, status));
      if (query) {
        conditions.push(or(
          like(quotations.customerName, `%${query}%`),
          like(quotations.customerPhone, `%${query}%`)
        ) as any);
      }

      const rows = await db.select().from(quotations)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(sql`${quotations.createdAt} DESC`)
        .limit(limit).offset(offset).all();

      return ok(rows);
    } catch (e: any) {
      return err(e.msg || 'Error', e.status || 400);
    }
  }

  // POST /api/quotations - create
  if (path === '/api/quotations' && req.method === 'POST') {
    try {
      const payload = await requireAuth(req, env);
      if (payload.role !== 'admin') return err('Admin only', 403);

      const body = await req.json() as any;
      const { customer_name, customer_phone, customer_address, service_type, amount, details, zone_id } = body;

      if (!customer_name || !customer_phone || !customer_address || !service_type || !amount) {
        return err('Missing required fields');
      }

      const qid = uuid();
      const prefix = await getSetting(db, 'quotation_prefix') || 'QT';
      const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const count = await db.select({ cnt: sql`count(*)` }).from(quotations)
        .where(sql`date(${quotations.createdAt}) = date('now')`).get() as any;
      const seq = String((count?.cnt ?? 0) + 1).padStart(3, '0');
      const number = `${prefix}-${today}-${seq}`;

      await db.insert(quotations).values({
        id: qid,
        customerName: customer_name,
        customerPhone: customer_phone,
        customerAddress: customer_address,
        serviceType: service_type,
        amount,
        details: details ? JSON.stringify(details) : '',
        zoneId: zone_id || null,
        status: 'draft',
        validUntil: body.valid_until || null,
        notes: body.notes || '',
        createdAt: nowISO(),
        updatedAt: nowISO()
      });

      const q = await db.select().from(quotations).where(eq(quotations.id, qid)).get();
      return ok(q);
    } catch (e: any) {
      return err(e.msg || 'Error', e.status || 400);
    }
  }

  // GET/PATCH /api/quotations/:id
  const idMatch = path.match(/^\/api\/quotations\/([a-f0-9-]+)$/);
  if (idMatch) {
    const qid = idMatch[1];

    if (req.method === 'GET') {
      try {
        const payload = await requireAuth(req, env);
        if (payload.role !== 'admin') return err('Admin only', 403);
        const q = await db.select().from(quotations).where(eq(quotations.id, qid)).get();
        return q ? ok(q) : err('Not found', 404);
      } catch (e: any) { return err(e.msg || 'Error', e.status || 400); }
    }

    if (req.method === 'PATCH') {
      try {
        const payload = await requireAuth(req, env);
        if (payload.role !== 'admin') return err('Admin only', 403);

        const body = await req.json() as any;
        const current = await db.select().from(quotations).where(eq(quotations.id, qid)).get();
        if (!current) return err('Not found', 404);

        const updates: Record<string, any> = { updatedAt: nowISO() };

        if (body.status !== undefined) {
          if (!['draft', 'sent', 'accepted', 'rejected', 'expired'].includes(body.status)) {
            return err('Invalid status');
          }
          updates.status = body.status;

          if (body.status === 'accepted' && !current.convertedBookingId) {
            const bId = uuid();
            const priceTotal = parseFloat(await getSetting(db, 'price_total') || '300');
            const priceDeposit = parseFloat(await getSetting(db, 'price_deposit') || '150');
            await db.insert(bookings).values({
              id: bId,
              customerName: current.customerName,
              customerPhone: current.customerPhone,
              customerAddress: current.customerAddress,
              bookingDate: new Date().toISOString().split('T')[0],
              bookingTime: '9am',
              amount: current.amount || priceTotal,
              depositAmount: priceDeposit,
              status: 'pending_payment',
              customerId: current.customerId,
              createdAt: nowISO(),
              updatedAt: nowISO()
            });
            updates.convertedBookingId = bId;
          }
        }
        if (body.notes !== undefined) updates.notes = body.notes;
        if (body.amount !== undefined) updates.amount = body.amount;
        if (body.valid_until !== undefined) updates.validUntil = body.valid_until;

        await db.update(quotations).set(updates).where(eq(quotations.id, qid));

        const q = await db.select().from(quotations).where(eq(quotations.id, qid)).get();
        return ok(q);
      } catch (e: any) { return err(e.msg || 'Error', e.status || 400); }
    }
  }

  return err('Not found', 404);
}

async function getSetting(db: AppDb, key: string): Promise<string> {
  const row = await db.select({ value: appSettingsTbl.value }).from(appSettingsTbl)
    .where(eq(appSettingsTbl.key, key)).get();
  return row?.value || '';
}
