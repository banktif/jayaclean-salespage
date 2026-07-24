import type { Env } from '../types';
import type { AppDb } from '../db/client';
import { createDb } from '../db/client';
import { sql, eq } from 'drizzle-orm';
import { bookings, profiles, tasks } from '../db/schema';
import { dequeuePending, markEventDone, markEventRetry, cleanupStaleEvents } from './events';
import { sendEmailDirect } from '../routes/email';
import { enqueue } from './events';

export async function processNotifications(env: Env): Promise<{ processed: number; sent: number }> {
  const db = createDb(env);
  let processed = 0, sent = 0;

  try {
    const events = await dequeuePending(db, 20);
    for (const event of events) {
      try {
        const ok = await handleEvent(env, db, event);
        if (ok) {
          sent++;
        }
        await markEventDone(db, event.payload._event_id || '');
      } catch (e) {
        const retries = (event.retries || 0) + 1;
        await markEventRetry(db, event.payload._event_id || '', retries);
        console.error(`Event ${event.type} failed (retry ${retries}):`, e);
      }
      processed++;
    }
  } catch (e) { console.error('Notification processor error:', e); }

  return { processed, sent };
}

async function handleEvent(env: Env, db: AppDb, event: { type: string; payload: any }): Promise<boolean> {
  const p = event.payload || {};
  const bookingId = p.booking_id;
  const taskId = p.task_id;

  switch (event.type) {
    case 'booking.created':
      return await notifyBookingCreated(env, db, bookingId, p);
    case 'payment.received':
      return await notifyPaymentReceived(env, db, bookingId);
    case 'task.assigned':
      return await notifyTaskAssigned(env, db, taskId, p.staff_id);
    case 'staff.accepted':
      return await notifyStaffAccepted(env, db, bookingId);
    case 'job.started':
      return await notifyJobStarted(env, db, bookingId);
    case 'payment.requested':
      return await notifyPaymentRequested(env, db, bookingId);
    case 'job.completed':
      return await notifyJobCompleted(env, db, bookingId);
    default:
      return false;
  }
}

async function getBooking(db: AppDb, id: string): Promise<any> {
  return db.select({
    id: bookings.id, customer_name: bookings.customerName,
    customer_phone: bookings.customerPhone, customer_address: bookings.customerAddress,
    booking_date: bookings.bookingDate, booking_time: bookings.bookingTime,
    deposit_amount: bookings.depositAmount, amount: bookings.amount,
    status: bookings.status
  }).from(bookings).where(eq(bookings.id, id)).get();
}

async function getStaff(db: AppDb, id: string): Promise<any> {
  return db.select({ id: profiles.id, full_name: profiles.fullName, phone: profiles.phone })
    .from(profiles).where(eq(profiles.id, id)).get();
}

async function sendWA(env: Env, to: string, text: string): Promise<boolean> {
  try {
    if (!env.WA_PHONE_NUMBER_ID || !env.WA_ACCESS_TOKEN) return false;
    let digits = String(to).replace(/\D/g, '');
    if (digits.startsWith('0')) digits = '6' + digits;

    const r = await fetch(`https://graph.facebook.com/v22.0/${env.WA_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${env.WA_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: digits, type: 'text', text: { body: text } })
    });
    return r.ok;
  } catch { return false; }
}

async function notifyBookingCreated(env: Env, db: AppDb, bookingId: string, p: any): Promise<boolean> {
  const b = await getBooking(db, bookingId);
  if (!b) return false;

  const deposit = b.deposit_amount || 150;
  const msg = `Salam ${b.customer_name}, terima kasih kerana memilih JAYABINA!\n\nTempahan: Cuci Tangki Air\nTarikh: ${b.booking_date}\nMasa: ${b.booking_time}\nAlamat: ${b.customer_address}\nDeposit: RM${deposit}\n\nSila bayar deposit untuk sahkan: https://www.jayabina.com/servis-cuci-tangki-air/`;
  await sendWA(env, b.customer_phone, msg);

  return true;
}

async function notifyPaymentReceived(env: Env, db: AppDb, bookingId: string): Promise<boolean> {
  const b = await getBooking(db, bookingId);
  if (!b) return false;

  const msg = `✅ Bayaran diterima!\n\nTempahan anda untuk ${b.booking_date}, ${b.booking_time} telah disahkan. Staff kami akan datang pada tarikh tersebut.\n\nSebarang pertanyaan: www.jayabina.com`;
  await sendWA(env, b.customer_phone, msg);
  return true;
}

async function notifyTaskAssigned(env: Env, db: AppDb, taskId: string, staffId: string): Promise<boolean> {
  const task = await db.select({ booking_id: tasks.bookingId })
    .from(tasks).where(eq(tasks.id, taskId)).get();
  if (!task) return false;

  const b = await getBooking(db, task.booking_id);
  const s = await getStaff(db, staffId);
  if (!b || !s) return false;

  const msg = `JAYABINA - Job Baru\n\nPelanggan: ${b.customer_name}\nAlamat: ${b.customer_address}\nTarikh: ${b.booking_date}, ${b.booking_time}\nDeposit: RM${b.deposit_amount || 150}\n\nSila log masuk untuk Accept/Reject: https://staff.jayabina.com`;
  await sendWA(env, s.phone, msg);
  return true;
}

async function notifyStaffAccepted(env: Env, db: AppDb, bookingId: string): Promise<boolean> {
  const b = await getBooking(db, bookingId);
  if (!b) return false;

  const msg = `Staff telah menerima tempahan anda.\n\nTarikh: ${b.booking_date}, ${b.booking_time}\nAlamat: ${b.customer_address}\n\nKami akan kunjungi anda tidak lama lagi!`;
  await sendWA(env, b.customer_phone, msg);
  return true;
}

async function notifyJobStarted(env: Env, db: AppDb, bookingId: string): Promise<boolean> {
  const b = await getBooking(db, bookingId);
  if (!b) return false;

  const msg = `Kerja cuci tangki air di ${b.customer_address} sedang dijalankan. Staff kami sedang bertugas sekarang.`;
  await sendWA(env, b.customer_phone, msg);
  return true;
}

async function notifyPaymentRequested(env: Env, db: AppDb, bookingId: string): Promise<boolean> {
  const b = await getBooking(db, bookingId);
  if (!b) return false;

  const balance = (b.amount || 300) - (b.deposit_amount || 150);
  const siteUrl = 'https://www.jayabina.com';
  const msg = `Kerja cuci tangki di ${b.customer_address} telah selesai.\n\nBaki bayaran: RM${balance}\n\nSila jelaskan baki: ${siteUrl}/success.html?order=${bookingId}&type=balance`;
  await sendWA(env, b.customer_phone, msg);
  return true;
}

async function notifyJobCompleted(env: Env, db: AppDb, bookingId: string): Promise<boolean> {
  const b = await getBooking(db, bookingId);
  if (!b) return false;

  const msg = `Terima kasih kerana memilih JAYABINA!\n\nServis cuci tangki air di ${b.customer_address} telah selesai sepenuhnya.\n\nKongsi pengalaman anda: https://g.page/r/jayabina/review\n\nTempah lagi dalam 6 bulan — kami akan ingatkan!`;
  await sendWA(env, b.customer_phone, msg);
  return true;
}

// Send time-based reminders (called from cron)
export async function sendScheduledReminders(env: Env): Promise<{ reminders: number; briefings: number }> {
  const db = createDb(env);
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  let reminders = 0, briefings = 0;

  try {
    // 24h before: Send Confirm button to staff for tomorrow's jobs
    const tomorrowJobs = await db.all(sql`
      SELECT t.id as task_id, t.assigned_to, b.customer_name, b.booking_date, b.booking_time, b.customer_address, p.phone as staff_phone
      FROM tasks t
      JOIN bookings b ON b.id = t.booking_id
      JOIN profiles p ON p.id = t.assigned_to
      WHERE t.workflow_step = 1 AND b.booking_date = ${tomorrow} AND t.status = 'assigned'
    `) as any[];

    for (const j of (tomorrowJobs || [])) {
      await sendWA(env, j.staff_phone,
        `Peringatan: Job esok!\n\nPelanggan: ${j.customer_name}\nAlamat: ${j.customer_address}\nMasa: ${j.booking_time}\n\nSila log masuk ke staff.jayabina.com untuk Confirm.`);
      reminders++;
    }

    // Morning: Send Heading button to staff for today's jobs
    const todayJobs = await db.all(sql`
      SELECT t.id as task_id, t.assigned_to, b.customer_name, b.booking_date, b.booking_time, b.customer_address, p.phone as staff_phone
      FROM tasks t
      JOIN bookings b ON b.id = t.booking_id
      JOIN profiles p ON p.id = t.assigned_to
      WHERE t.workflow_step = 2 AND b.booking_date = ${today} AND t.status = 'assigned'
    `) as any[];

    for (const j of (todayJobs || [])) {
      await sendWA(env, j.staff_phone,
        `Selamat pagi!\n\nJob hari ini: ${j.customer_name}\nAlamat: ${j.customer_address}\nMasa: ${j.booking_time}\n\nSila log masuk ke staff.jayabina.com dan klik "Heading to Site".`);
      briefings++;
    }

    // Send 2h before reminder to customers
    const todayJobsCust = await db.all(sql`
      SELECT b.customer_phone, b.customer_name, b.booking_time, b.customer_address
      FROM bookings b
      JOIN tasks t ON t.booking_id = b.id
      WHERE b.booking_date = ${today} AND b.status = 'confirmed'
    `) as any[];

    for (const j of (todayJobsCust || [])) {
      await sendWA(env, j.customer_phone,
        `Salam ${j.customer_name}, staff JAYABINA akan sampai di ${j.customer_address} pada ${j.booking_time} hari ini. Sila pastikan akses tersedia. Terima kasih!`);
    }

    // Cleanup stale events
    await cleanupStaleEvents(db);
  } catch (e) { console.error('Scheduled reminders error:', e); }

  return { reminders, briefings };
}
