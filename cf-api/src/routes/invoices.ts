import { and, eq, like, or, sql } from 'drizzle-orm';
import type { Env } from '../types';
import { err, ok, uuid, nowISO, json as jsonResponse } from '../utils/helpers';
import { requireAuth } from '../utils/middleware';
import { createDb, type AppDb } from '../db/client';
import { appSettings as appSettingsTbl, bookings, invoices, receipts } from '../db/schema';

export async function handleInvoices(req: Request, env: Env, path: string): Promise<Response> {
  const url = new URL(req.url);
  const db = createDb(env);

  // GET /api/invoices - list
  if (path === '/api/invoices' && req.method === 'GET') {
    try {
      const payload = await requireAuth(req, env);
      if (payload.role !== 'admin') return err('Admin only', 403);

      const status = url.searchParams.get('status');
      const query = url.searchParams.get('q') || '';
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);
      const offset = parseInt(url.searchParams.get('offset') || '0');

      let conditions = [];
      if (status) conditions.push(eq(invoices.status, status));
      if (query) {
        conditions.push(or(
          like(invoices.customerName, `%${query}%`),
          like(invoices.customerPhone, `%${query}%`),
          like(invoices.number, `%${query}%`)
        ) as any);
      }

      const rows = await db.select().from(invoices)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(sql`${invoices.createdAt} DESC`)
        .limit(limit).offset(offset).all();

      return ok(rows);
    } catch (e: any) { return err(e.msg || 'Error', e.status || 400); }
  }

  // POST /api/invoices/generate - auto-generate from booking
  if (path === '/api/invoices/generate' && req.method === 'POST') {
    try {
      const payload = await requireAuth(req, env);
      if (payload.role !== 'admin') return err('Admin only', 403);

      const { booking_id } = await req.json() as any;
      if (!booking_id) return err('Missing booking_id');

      return await generateInvoice(db, booking_id);
    } catch (e: any) { return err(e.msg || 'Error', e.status || 400); }
  }

  // GET /api/invoices/:id
  const idMatch = path.match(/^\/api\/invoices\/([a-f0-9-]+)$/);
  if (idMatch && req.method === 'GET') {
    try {
      const payload = await requireAuth(req, env);
      if (payload.role !== 'admin') return err('Admin only', 403);
      const inv = await db.select().from(invoices).where(eq(invoices.id, idMatch[1])).get();
      return inv ? ok(inv) : err('Not found', 404);
    } catch (e: any) { return err(e.msg || 'Error', e.status || 400); }
  }

  // PATCH /api/invoices/:id
  if (idMatch && req.method === 'PATCH') {
    try {
      const payload = await requireAuth(req, env);
      if (payload.role !== 'admin') return err('Admin only', 403);

      const body = await req.json() as any;
      const current = await db.select().from(invoices).where(eq(invoices.id, idMatch[1])).get();
      if (!current) return err('Not found', 404);

      const updates: Record<string, any> = { updatedAt: nowISO() };
      if (body.status !== undefined) {
        if (!['pending', 'paid', 'cancelled'].includes(body.status)) return err('Invalid status');
        updates.status = body.status;
        if (body.status === 'paid') updates.paidAt = nowISO();
      }
      if (body.wa_sent_at !== undefined) updates.waSentAt = body.wa_sent_at;
      if (body.email_sent_at !== undefined) updates.emailSentAt = body.email_sent_at;

      await db.update(invoices).set(updates).where(eq(invoices.id, idMatch[1]));
      const inv = await db.select().from(invoices).where(eq(invoices.id, idMatch[1])).get();
      return ok(inv);
    } catch (e: any) { return err(e.msg || 'Error', e.status || 400); }
  }

  return err('Not found', 404);
}

// Generate invoice for a completed booking
export async function generateInvoice(db: AppDb, bookingId: string) {
  const existing = await db.select({ id: invoices.id }).from(invoices)
    .where(eq(invoices.bookingId, bookingId)).get();
  if (existing) return ok({ invoice_id: existing.id, message: 'Invoice already exists' });

  const booking = await db.select({
    id: bookings.id,
    customerName: bookings.customerName,
    customerPhone: bookings.customerPhone,
    customerAddress: bookings.customerAddress,
    amount: bookings.amount,
    depositAmount: bookings.depositAmount,
    createdAt: bookings.createdAt
  }).from(bookings).where(eq(bookings.id, bookingId)).get();

  if (!booking) return err('Booking not found', 404);

  const prefix = await getSetting(db, 'invoice_prefix') || 'INV';
  const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const countRow = await db.select({ cnt: sql`count(*)` }).from(invoices)
    .where(sql`date(${invoices.createdAt}) = date('now')`).get() as any;
  const seq = String((countRow?.cnt ?? 0) + 1).padStart(3, '0');
  const number = `${prefix}-${today}-${seq}`;

  const items = JSON.stringify([
    { description: 'Servis Cuci Tangki Air', amount: booking.amount },
    { description: 'Deposit (Telah Dibayar)', amount: -(booking.depositAmount || 0) }
  ]);

  const balance = (booking.amount || 0) - (booking.depositAmount || 0);

  const iid = uuid();
  await db.insert(invoices).values({
    id: iid,
    bookingId: bookingId,
    number,
    customerName: booking.customerName,
    customerPhone: booking.customerPhone,
    customerAddress: booking.customerAddress,
    items,
    subtotal: booking.amount,
    depositPaid: booking.depositAmount || 0,
    balanceDue: balance > 0 ? balance : 0,
    status: 'pending',
    createdAt: nowISO(),
    updatedAt: nowISO()
  });

  // Auto-generate receipt for deposit if already paid
  const paymentStatus = await db.select({ ps: bookings.paymentStatus })
    .from(bookings).where(eq(bookings.id, bookingId)).get();
  if (paymentStatus?.ps === 'paid') {
    await generateReceipt(db, bookingId, iid, 'deposit', booking.depositAmount || 0);
  }

  const inv = await db.select().from(invoices).where(eq(invoices.id, iid)).get();
  return ok(inv);
}

// Generate receipt for payment
export async function generateReceipt(
  db: AppDb,
  bookingId: string,
  invoiceId: string,
  paymentType: 'deposit' | 'balance' | 'full',
  amount: number
) {
  const booking = await db.select({
    customerName: bookings.customerName,
    customerPhone: bookings.customerPhone
  }).from(bookings).where(eq(bookings.id, bookingId)).get();
  if (!booking) return;

  const prefix = await getSetting(db, 'receipt_prefix') || 'RCP';
  const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const countRow = await db.select({ cnt: sql`count(*)` }).from(receipts)
    .where(sql`date(${receipts.createdAt}) = date('now')`).get() as any;
  const seq = String((countRow?.cnt ?? 0) + 1).padStart(3, '0');
  const number = `${prefix}-${today}-${seq}`;

  await db.insert(receipts).values({
    id: uuid(),
    bookingId,
    invoiceId,
    number,
    paymentType,
    amount,
    customerName: booking.customerName,
    customerPhone: booking.customerPhone,
    createdAt: nowISO()
  });
}

async function getSetting(db: AppDb, key: string): Promise<string> {
  const row = await db.select({ value: appSettingsTbl.value }).from(appSettingsTbl)
    .where(eq(appSettingsTbl.key, key)).get();
  return row?.value || '';
}
