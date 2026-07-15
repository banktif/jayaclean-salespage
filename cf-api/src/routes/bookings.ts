import type { Env } from '../types';
import { json, err, ok, uuid, nowISO, normPhone, todayStr } from '../utils/helpers';
import { requireAuth, requireAdmin, getSetting } from '../utils/middleware';

export async function handleBookings(req: Request, env: Env, path: string): Promise<Response> {
  const url = new URL(req.url);

  // GET /api/bookings - list bookings (auth + anon)
  if (path === '/api/bookings' && req.method === 'GET') {
    try {
      const customerPhone = url.searchParams.get('customer_phone');
      let payload: any = null;
      try { payload = await requireAuth(req, env); } catch {}

      // Anon access: only allowed with customer_phone filter
      if (!payload && !customerPhone) return err('Auth required', 401);

      const dateFilter = url.searchParams.get('date');
      const statusFilter = url.searchParams.get('status');
      const customerId = url.searchParams.get('customer_id');
      const idsParam = url.searchParams.get('ids');
      const orderCol = url.searchParams.get('order') || 'booking_date';
      const orderDir = url.searchParams.get('dir') || 'asc';

      let q = 'SELECT * FROM bookings';
      const conds: string[] = [];
      const params: any[] = [];

      if (payload && payload.role === 'staff') {
        conds.push(`id IN (SELECT booking_id FROM tasks WHERE assigned_to = '${payload.sub}')`);
      }

      // Anon: must have customer_phone filter
      if (!payload && customerPhone) {
        conds.push('customer_phone = ?');
        params.push(normPhone(customerPhone));
      }

      if (payload) {
        if (customerPhone) { conds.push('customer_phone = ?'); params.push(normPhone(customerPhone)); }
        if (dateFilter) { conds.push('booking_date = ?'); params.push(dateFilter); }
        if (statusFilter) { conds.push('status = ?'); params.push(statusFilter); }
        if (customerId) { conds.push('customer_id = ?'); params.push(customerId); }
        if (idsParam) {
          const idList = idsParam.split(',').map((s: string) => s.trim()).filter(Boolean);
          if (idList.length) {
            conds.push(`id IN (${idList.map(() => '?').join(',')})`);
            params.push(...idList);
          }
        }
      }

      if (conds.length) q += ' WHERE ' + conds.join(' AND ');

      const safeCols = ['booking_date', 'created_at', 'booking_time', 'customer_name', 'status', 'payment_status'];
      const col = safeCols.includes(orderCol) ? orderCol : 'booking_date';
      const dir = orderDir === 'desc' ? 'DESC' : 'ASC';
      q += ` ORDER BY ${col} ${dir}`;

      const stmt = env.DB.prepare(q);
      for (const p of params) stmt.bind(p);
      const result = await stmt.all();
      return ok(result.results);
    } catch (e: any) {
      return err(e.msg || 'Error', e.status || 400);
    }
  }

  // GET /api/bookings/public - anon read single booking
  if (path === '/api/bookings/public' && req.method === 'GET') {
    const id = url.searchParams.get('id');
    if (!id) return err('Missing id');
    const row = await env.DB.prepare('SELECT * FROM bookings WHERE id = ?').bind(id).first();
    return row ? ok(row) : err('Not found', 404);
  }

  // POST /api/bookings - public booking creation
  if (path === '/api/bookings' && req.method === 'POST') {
    const body = await req.json() as any;
    const { customer_name, customer_phone, customer_address, booking_date, booking_time } = body;

    if (!customer_name || !customer_phone || !customer_address || !booking_date || !booking_time) {
      return err('Missing required fields: customer_name, customer_phone, customer_address, booking_date, booking_time');
    }

    const maxSlots = parseInt(await getSetting(env.DB, 'max_slots_per_day') || '4');
    const existing = await env.DB.prepare('SELECT COUNT(*) as cnt FROM slots WHERE date = ? AND is_booked = 1')
      .bind(booking_date).first<{cnt: number}>();
    if (existing && existing.cnt >= maxSlots) return err('No slots available for this date', 409);

    const priceTotal = parseFloat(await getSetting(env.DB, 'price_total') || '300');
    const priceDeposit = parseFloat(await getSetting(env.DB, 'price_deposit') || '150');

    const bookingId = uuid();
    const slotId = uuid();
    const now = nowISO();

    const phoneDigits = normPhone(customer_phone);

    // Find or create customer
    let cust = await env.DB.prepare('SELECT id FROM customers WHERE phone = ?').bind(phoneDigits).first<{id: string}>();
    if (!cust) {
      const custId = uuid();
      await env.DB.prepare(`INSERT INTO customers (id, phone, name, address) VALUES (?, ?, ?, ?)`)
        .bind(custId, phoneDigits, customer_name, customer_address).run();
      cust = { id: custId };
    } else {
      await env.DB.prepare('UPDATE customers SET name = CASE WHEN ? != \'\' THEN ? ELSE name END, address = CASE WHEN ? != \'\' THEN ? ELSE address END WHERE id = ?')
        .bind(customer_name, customer_name, customer_address, customer_address, cust.id).run();
    }

    await env.DB.prepare(`INSERT INTO bookings (id, customer_name, customer_phone, customer_address, booking_date, booking_time, amount, deposit_amount, customer_id, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(bookingId, customer_name, phoneDigits, customer_address, booking_date, booking_time, priceTotal, priceDeposit, cust.id, now, now).run();

    await env.DB.prepare('INSERT INTO slots (id, date, time_slot, is_booked, booking_id) VALUES (?,?,?,1,?)')
      .bind(slotId, booking_date, booking_time, bookingId).run();

    // Update customer stats
    await refreshCustomerStats(env.DB, cust.id);

    const booking = await env.DB.prepare('SELECT * FROM bookings WHERE id = ?').bind(bookingId).first();
    return ok(booking);
  }

  // PATCH /api/bookings/:id - update booking
  const patchMatch = path.match(/^\/api\/bookings\/([a-f0-9-]+)$/);
  if (patchMatch && req.method === 'PATCH') {
    try {
      const payload = await requireAuth(req, env);
      const bookingId = patchMatch[1];
      const body = await req.json() as any;
      const now = nowISO();

      // Check access
      if (payload.role !== 'admin') {
        const hasAccess = await env.DB.prepare('SELECT 1 FROM tasks WHERE booking_id = ? AND assigned_to = ?')
          .bind(bookingId, payload.sub).first();
        if (!hasAccess) return err('Access denied', 403);
      }

      const sets: string[] = ['updated_at = ?'];
      const params: any[] = [now];

      if (body.status !== undefined) {
        sets.push('status = ?'); params.push(body.status);
        if (body.status === 'completed') {
          // Trigger: on completed, update customer stats
          const bk = await env.DB.prepare('SELECT customer_id FROM bookings WHERE id = ?').bind(bookingId).first<{customer_id: string | null}>();
          if (bk?.customer_id) await refreshCustomerStats(env.DB, bk.customer_id);
        }
        // Trigger: on confirmed, create task if none
        if (body.status === 'confirmed') {
          const existingTask = await env.DB.prepare('SELECT id FROM tasks WHERE booking_id = ?').bind(bookingId).first();
          if (!existingTask) {
            const taskId = uuid();
            await env.DB.prepare('INSERT INTO tasks (id, booking_id, status) VALUES (?, ?, ?)')
              .bind(taskId, bookingId, 'unassigned').run();

            // Auto-assign if enabled
            const autoEnabled = await getSetting(env.DB, 'auto_assign_enabled');
            if (autoEnabled === 'true') {
              await autoAssignTask(env.DB, taskId);
            }
          }
        }
      }

      if (body.payment_status !== undefined) { sets.push('payment_status = ?'); params.push(body.payment_status); }
      if (body.customer_name !== undefined) { sets.push('customer_name = ?'); params.push(body.customer_name); }
      if (body.customer_phone !== undefined) { sets.push('customer_phone = ?'); params.push(normPhone(body.customer_phone)); }
      if (body.customer_address !== undefined) { sets.push('customer_address = ?'); params.push(body.customer_address); }
      if (body.notes !== undefined) { sets.push('notes = ?'); params.push(body.notes); }
      if (body.booking_date !== undefined) { sets.push('booking_date = ?'); params.push(body.booking_date); }
      if (body.booking_time !== undefined) { sets.push('booking_time = ?'); params.push(body.booking_time); }

      params.push(bookingId);
      await env.DB.prepare(`UPDATE bookings SET ${sets.join(', ')} WHERE id = ?`).bind(...params).run();

      const updated = await env.DB.prepare('SELECT * FROM bookings WHERE id = ?').bind(bookingId).first();
      return ok(updated);
    } catch (e: any) {
      return err(e.msg || 'Error', e.status || 400);
    }
  }

  return err('Not found', 404);
}

// POST /api/bookings/create-bayarcash-intent
export async function handleCreateIntent(req: Request, env: Env): Promise<Response> {
  const { booking_id } = await req.json() as any;
  if (!booking_id) return err('Missing booking_id');

  const booking = await env.DB.prepare('SELECT * FROM bookings WHERE id = ?').bind(booking_id).first<{id: string; deposit_amount: number; bayarcash_ref: string | null; payment_status: string}>();
  if (!booking) return err('Booking not found', 404);
  if (!booking.deposit_amount || booking.deposit_amount <= 0) return err('Invalid deposit amount');

  // Generate short order ref
  const orderRef = await generateOrderRef(env.DB, 'JB');

  await env.DB.prepare('UPDATE bookings SET bayarcash_ref = ? WHERE id = ?').bind(orderRef, booking_id).run();

  const siteUrl = env.SITE_URL || 'https://cuci.jayabina.com';
  const body = {
    order_number: orderRef,
    amount: Math.round(booking.deposit_amount * 100), // cents
    name: 'Deposit JAYACLEAN',
    phone: '60139373275',
    return_url: `${siteUrl}/success.html?order=${booking_id}`,
    callback_url: `${urlForReq(req)}/api/payments/bayarcash-callback`,
    payment_channel: env.BAYARCASH_PAYMENT_CHANNEL || '5'
  };

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${env.BAYARCASH_PAT}`,
    'Content-Type': 'application/json'
  };

  if (env.BAYARCASH_API_SECRET) {
    const checksum = await generateChecksum(body, env.BAYARCASH_API_SECRET);
    headers['X-Checksum'] = checksum;
  }

  const resp = await fetch('https://api.console.bayar.cash/v3/payment-intents', {
    method: 'POST', headers, body: JSON.stringify(body)
  });
  const data = await resp.json() as any;
  if (!resp.ok) return err(data.message || 'Bayarcash error', resp.status);
  return ok({ url: data.url, id: data.id });
}

export async function handleBayarcashCallback(req: Request, env: Env): Promise<Response> {
  const contentType = req.headers.get('content-type') || '';
  let body: Record<string, any> = {};

  if (contentType.includes('application/json')) {
    body = await req.json() as any;
  } else {
    const text = await req.text();
    for (const [k, v] of new URLSearchParams(text)) body[k] = v;
  }

  // Verify checksum if configured
  if (env.BAYARCASH_API_SECRET && body.checksum) {
    const computed = await generateChecksum(body, env.BAYARCASH_API_SECRET);
    if (computed !== body.checksum) return err('Invalid checksum', 403);
  }

  const orderRef = body.order_number as string;
  const status = parseInt(body.status as string);
  const transactionId = body.transaction_id as string;

  const booking = await env.DB.prepare('SELECT * FROM bookings WHERE bayarcash_ref = ? AND payment_status = ?')
    .bind(orderRef, 'pending').first<{id: string}>();
  if (!booking) return err('Booking not found', 404);

  if (status === 3) { // paid
    const autoConfirm = await getSetting(env.DB, 'auto_confirm_payment');
    const bookingStatus = autoConfirm !== 'false' ? 'confirmed' : 'pending_payment';

    await env.DB.prepare('UPDATE bookings SET payment_status = ?, bayarcash_transaction_id = ?, status = ?, updated_at = ? WHERE id = ?')
      .bind('paid', transactionId, bookingStatus, nowISO(), booking.id).run();

    // Trigger task creation if confirmed
    if (bookingStatus === 'confirmed') {
      const existingTask = await env.DB.prepare('SELECT id FROM tasks WHERE booking_id = ?').bind(booking.id).first();
      if (!existingTask) {
        const taskId = uuid();
        await env.DB.prepare('INSERT INTO tasks (id, booking_id, status) VALUES (?, ?, ?)')
          .bind(taskId, booking.id, 'unassigned').run();

        const autoEnabled = await getSetting(env.DB, 'auto_assign_enabled');
        if (autoEnabled === 'true') {
          await autoAssignTask(env.DB, taskId);
        }
      }
    }
  } else if (status === 2 || status === 4) {
    await env.DB.prepare('UPDATE bookings SET payment_status = ?, bayarcash_transaction_id = ?, updated_at = ? WHERE id = ?')
      .bind('failed', transactionId, nowISO(), booking.id).run();
  }

  return ok({ received: true });
}

// Helpers

async function generateOrderRef(db: D1Database, prefix: string): Promise<string> {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return (prefix + ts + rand).substring(0, 30);
}

async function generateChecksum(data: Record<string, any>, secret: string): Promise<string> {
  const keys = Object.keys(data).sort();
  const str = keys.map(k => `${k}:${data[k]}`).join('|');
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(str));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function urlForReq(req: Request): string {
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

async function refreshCustomerStats(db: D1Database, customerId: string): Promise<void> {
  const stats = await db.prepare(`
    SELECT
      COUNT(*) as total_bookings,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_bookings,
      SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as total_spent,
      MIN(booking_date) as first_booking_date,
      MAX(booking_date) as last_booking_date
    FROM bookings WHERE customer_id = ?
  `).bind(customerId).first<{total_bookings: number; completed_bookings: number; total_spent: number; first_booking_date: string; last_booking_date: string}>();

  if (stats) {
    await db.prepare(`UPDATE customers SET
      total_bookings = ?, completed_bookings = ?, total_spent = ?,
      first_booking_date = ?, last_booking_date = ?, updated_at = ?
      WHERE id = ?`)
      .bind(stats.total_bookings, stats.completed_bookings, stats.total_spent || 0,
        stats.first_booking_date, stats.last_booking_date, nowISO(), customerId).run();
  }
}

async function autoAssignTask(db: D1Database, taskId: string): Promise<void> {
  const rule = await getSetting(db, 'auto_assign_rule') || 'round_robin';
  const task = await db.prepare('SELECT * FROM tasks WHERE id = ? AND assigned_to IS NULL').bind(taskId).first();
  if (!task) return;

  let staff: { id: string } | null = null;

  if (rule === 'least_loaded') {
    const rows = await db.prepare(`
      SELECT p.id FROM profiles p
      WHERE p.role = 'staff' AND p.is_active = 1
      ORDER BY (SELECT COUNT(*) FROM tasks t WHERE t.assigned_to = p.id AND t.status IN ('assigned','in_progress','awaiting_review')) ASC
      LIMIT 1
    `).all();
    staff = rows.results[0] as any;
  } else {
    // round_robin: staff assigned least recently (or never)
    const rows = await db.prepare(`
      SELECT p.id FROM profiles p
      WHERE p.role = 'staff' AND p.is_active = 1
      ORDER BY COALESCE((SELECT MAX(t.created_at) FROM tasks t WHERE t.assigned_to = p.id), '1970-01-01') ASC
      LIMIT 1
    `).all();
    staff = rows.results[0] as any;
  }

  if (staff) {
    await db.prepare('UPDATE tasks SET assigned_to = ?, status = ?, updated_at = ? WHERE id = ?')
      .bind(staff.id, 'assigned', nowISO(), taskId).run();
  }
}

export async function handleDistributeUnassigned(req: Request, env: Env): Promise<Response> {
  try {
    const payload = await requireAuth(req, env);
    if (payload.role !== 'admin') return err('Admin only', 403);

    const tasks = await env.DB.prepare('SELECT id FROM tasks WHERE assigned_to IS NULL AND status = ?').bind('unassigned').all();
    let count = 0;
    for (const t of tasks.results) {
      await autoAssignTask(env.DB, (t as any).id);
      count++;
    }
    return ok({ assigned: count });
  } catch (e: any) {
    return err(e.msg || 'Error', e.status || 400);
  }
}
