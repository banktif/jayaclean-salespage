import { and, eq, like, or, sql } from 'drizzle-orm';
import type { Env } from '../types';
import { err, ok, nowISO } from '../utils/helpers';
import { requireAuth } from '../utils/middleware';
import { createDb, type AppDb } from '../db/client';
import { appSettings as appSettingsTbl, receipts } from '../db/schema';

export async function handleReceipts(req: Request, env: Env, path: string): Promise<Response> {
  const url = new URL(req.url);
  const db = createDb(env);

  // GET /api/receipts - list
  if (path === '/api/receipts' && req.method === 'GET') {
    try {
      const payload = await requireAuth(req, env);
      if (payload.role !== 'admin') return err('Admin only', 403);

      const paymentType = url.searchParams.get('payment_type');
      const query = url.searchParams.get('q') || '';
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);
      const offset = parseInt(url.searchParams.get('offset') || '0');

      let conditions = [];
      if (paymentType) conditions.push(eq(receipts.paymentType, paymentType));
      if (query) {
        conditions.push(or(
          like(receipts.customerName, `%${query}%`),
          like(receipts.customerPhone, `%${query}%`),
          like(receipts.number, `%${query}%`)
        ) as any);
      }

      const rows = await db.select().from(receipts)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(sql`${receipts.createdAt} DESC`)
        .limit(limit).offset(offset).all();

      return ok(rows);
    } catch (e: any) { return err(e.msg || 'Error', e.status || 400); }
  }

  // GET /api/receipts/:id
  const idMatch = path.match(/^\/api\/receipts\/([a-f0-9-]+)$/);
  if (idMatch && req.method === 'GET') {
    try {
      const payload = await requireAuth(req, env);
      if (payload.role !== 'admin') return err('Admin only', 403);
      const r = await db.select().from(receipts).where(eq(receipts.id, idMatch[1])).get();
      return r ? ok(r) : err('Not found', 404);
    } catch (e: any) { return err(e.msg || 'Error', e.status || 400); }
  }

  // PATCH /api/receipts/:id
  if (idMatch && req.method === 'PATCH') {
    try {
      const payload = await requireAuth(req, env);
      if (payload.role !== 'admin') return err('Admin only', 403);

      const body = await req.json() as any;
      const current = await db.select().from(receipts).where(eq(receipts.id, idMatch[1])).get();
      if (!current) return err('Not found', 404);

      const updates: Record<string, any> = {};
      if (body.wa_sent_at !== undefined) updates.waSentAt = body.wa_sent_at;
      if (body.email_sent_at !== undefined) updates.emailSentAt = body.email_sent_at;

      if (Object.keys(updates).length > 0) {
        await db.update(receipts).set(updates).where(eq(receipts.id, idMatch[1]));
      }

      const r = await db.select().from(receipts).where(eq(receipts.id, idMatch[1])).get();
      return ok(r);
    } catch (e: any) { return err(e.msg || 'Error', e.status || 400); }
  }

  return err('Not found', 404);
}
