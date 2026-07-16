import { and, desc, eq, like, or, sql, type SQL } from 'drizzle-orm';
import type { Env } from '../types';
import { err, ok, nowISO } from '../utils/helpers';
import { requireAuth, requireAdmin } from '../utils/middleware';
import { createDb } from '../db/client';
import { customers } from '../db/schema';

const customerFields = {
  id: customers.id,
  phone: customers.phone,
  name: customers.name,
  email: customers.email,
  address: customers.address,
  notes: customers.notes,
  tags: customers.tags,
  status: customers.status,
  total_bookings: customers.totalBookings,
  completed_bookings: customers.completedBookings,
  total_spent: customers.totalSpent,
  first_booking_date: customers.firstBookingDate,
  last_booking_date: customers.lastBookingDate,
  created_at: customers.createdAt,
  updated_at: customers.updatedAt
};

export async function handleCustomers(req: Request, env: Env, path: string): Promise<Response> {
  const url = new URL(req.url);
  const db = createDb(env);

  // GET /api/customers
  if (path === '/api/customers' && req.method === 'GET') {
    try {
      const payload = await requireAuth(req, env);
      requireAdmin(payload);

      const search = url.searchParams.get('search') || '';
      const status = url.searchParams.get('status') || '';
      const page = Math.max(1, parseInt(url.searchParams.get('page') || '1') || 1);
      const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20') || 20));
      const offset = (page - 1) * limit;
      const requestedOrder = url.searchParams.get('order') || 'last_booking_date';
      const safeOrder = ['last_booking_date', 'total_bookings', 'total_spent', 'name', 'created_at'];
      const order = safeOrder.includes(requestedOrder) ? requestedOrder : 'last_booking_date';
      const direction = url.searchParams.get('dir') === 'asc' ? 'ASC' : 'DESC';

      const conditions: SQL[] = [];

      if (search) {
        conditions.push(or(like(customers.name, `%${search}%`), like(customers.phone, `%${search}%`))!);
      }
      if (status) conditions.push(eq(customers.status, status as any));

      const orderColumns = {
        last_booking_date: customers.lastBookingDate,
        total_bookings: customers.totalBookings,
        total_spent: customers.totalSpent,
        name: customers.name,
        created_at: customers.createdAt
      } as const;
      const orderColumn = orderColumns[order as keyof typeof orderColumns];
      const orderDirection = direction === 'ASC' ? sql`ASC` : sql`DESC`;

      const rows = await db.select({
        ...customerFields,
        total_count: sql<number>`COUNT(*) OVER()`
      }).from(customers)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(sql`${orderColumn} ${orderDirection} NULLS LAST`, desc(customers.createdAt))
        .limit(limit).offset(offset);
      const total = rows[0]?.total_count || 0;
      return ok({ data: rows.map(normalizeCustomer), total, page, limit });
    } catch (e: any) {
      return err(e.msg || 'Error', e.status || 400);
    }
  }

  // GET /api/customers/:id
  const getMatch = path.match(/^\/api\/customers\/([a-f0-9-]+)$/);
  if (getMatch && req.method === 'GET') {
    try {
      const payload = await requireAuth(req, env);
      requireAdmin(payload);
      const customer = await db.select(customerFields).from(customers)
        .where(eq(customers.id, getMatch[1])).get();
      return customer ? ok(normalizeCustomer(customer)) : err('Not found', 404);
    } catch (e: any) {
      return err(e.msg || 'Error', e.status || 400);
    }
  }

  // PATCH /api/customers/:id
  if (getMatch && req.method === 'PATCH') {
    try {
      const payload = await requireAuth(req, env);
      requireAdmin(payload);
      const body = await req.json() as any;
      const customerId = getMatch[1];
      const existing = await db.select({ id: customers.id }).from(customers)
        .where(eq(customers.id, customerId)).get();
      if (!existing) return err('Customer not found', 404);
      if (body.status !== undefined && !['active', 'inactive', 'vip', 'blacklist'].includes(body.status)) return err('Invalid customer status');
      if (body.tags !== undefined && !Array.isArray(body.tags)) return err('Customer tags must be an array');

      const updates: Partial<typeof customers.$inferInsert> = { updatedAt: nowISO() };

      if (body.name !== undefined) updates.name = body.name;
      if (body.email !== undefined) updates.email = body.email;
      if (body.address !== undefined) updates.address = body.address;
      if (body.notes !== undefined) updates.notes = body.notes;
      if (body.tags !== undefined) updates.tags = JSON.stringify(body.tags);
      if (body.status !== undefined) updates.status = body.status;

      await db.update(customers).set(updates).where(eq(customers.id, customerId));
      const updated = await db.select(customerFields).from(customers)
        .where(eq(customers.id, customerId)).get();
      return ok(normalizeCustomer(updated));
    } catch (e: any) {
      return err(e.msg || 'Error', e.status || 400);
    }
  }

  // DELETE /api/customers/:id
  if (getMatch && req.method === 'DELETE') {
    try {
      const payload = await requireAuth(req, env);
      requireAdmin(payload);
      await db.delete(customers).where(eq(customers.id, getMatch[1]));
      return ok({ deleted: true });
    } catch (e: any) {
      return err(e.msg || 'Error', e.status || 400);
    }
  }

  return err('Not found', 404);
}

function normalizeCustomer(row: any): any {
  if (!row) return row;
  let tags: string[] = [];
  if (Array.isArray(row.tags)) tags = row.tags.map(String);
  else if (typeof row.tags === 'string' && row.tags) {
    try { const parsed = JSON.parse(row.tags); if (Array.isArray(parsed)) tags = parsed.map(String); } catch {}
  }
  return { ...row, tags };
}
