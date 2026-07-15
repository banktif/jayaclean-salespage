import type { Env } from './types';
import { json, err, ok } from './utils/helpers';
import { handleCors, requireAuth } from './utils/middleware';
import { handleAuth } from './routes/auth';
import { handleBookings, handleCreateIntent, handleBayarcashCallback, handleDistributeUnassigned } from './routes/bookings';
import { handleTasks, handleTaskPhotos } from './routes/tasks';
import { handleProfiles } from './routes/profiles';
import { handleSettings } from './routes/settings';
import { handleCustomers } from './routes/customers';
import { handleSlots } from './routes/slots';
import { handleWhatsapp } from './routes/whatsapp';
import { handleBackup } from './routes/backup';

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const cors = handleCors(req);
    if (cors) return cors;

    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    // Routes
    try {
      // Auth
      if (path.startsWith('/api/auth')) return await handleAuth(req, env, path);
      if (path.startsWith('/api/settings')) return await handleSettings(req, env, path);

      // Public endpoints
      if (path === '/api/bookings/public') return await handleBookings(req, env, path);
      if (path === '/api/slots/available' || path === '/api/slots/check') return await handleSlots(req, env, path);
      if (path === '/api/settings/public') return await handleSettings(req, env, path);

      // Bookings
      if (path.startsWith('/api/bookings')) return await handleBookings(req, env, path);

      // Payment
      if (path === '/api/payments/create-intent') return await handleCreateIntent(req, env);
      if (path === '/api/payments/create-balance-intent') return await handleCreateBalanceIntent(req, env);
      if (path === '/api/payments/bayarcash-callback') return await handleBayarcashCallback(req, env);

      // Tasks
      if (path.startsWith('/api/tasks/distribute')) return await handleDistributeUnassigned(req, env);
      if (path.startsWith('/api/tasks')) return await handleTasks(req, env, path);
      if (path.startsWith('/api/task-photos')) return await handleTaskPhotos(req, env, path);

      // Profiles
      if (path.startsWith('/api/profiles')) return await handleProfiles(req, env, path);

      // Customers
      if (path.startsWith('/api/customers')) return await handleCustomers(req, env, path);

      // WhatsApp
      if (path.startsWith('/api/whatsapp')) return await handleWhatsapp(req, env, path);

      // Backup
      if (path.startsWith('/api/backup')) return await handleBackup(req, env, path);

      return err('Not found', 404);
    } catch (e: any) {
      console.error('Unhandled error:', e);
      return err(e.message || 'Internal server error', 500);
    }
  },

  // Cron trigger (runs hourly via wrangler.toml cron)
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    // Auto backup
    if (env.BACKUP_R2 && env.BACKUP_SECRET) {
      const handlers = await import('./routes/backup');
      const fakeReq = new Request('https://internal/api/backup/db', {
        method: 'POST',
        headers: { 'x-backup-key': env.BACKUP_SECRET, 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: false })
      });
      ctx.waitUntil(handlers.handleBackup(fakeReq, env, '/api/backup/db'));
    }

    // Prune old backups (48hr limit)
    if (env.BACKUP_R2) {
      ctx.waitUntil((async () => {
        const objects = await env.BACKUP_R2.list({ prefix: 'db/', limit: 200 });
        const now = Date.now();
        const keepMs = 48 * 3600 * 1000;
        for (const obj of objects.objects) {
          if (now - obj.uploaded.getTime() > keepMs) {
            try { await env.BACKUP_R2.delete(obj.key); } catch {}
          }
        }
      })());
    }
  }
};

async function handleCreateBalanceIntent(req: Request, env: Env): Promise<Response> {
  const { booking_id } = await req.json() as any;
  if (!booking_id) return err('Missing booking_id');

  const booking = await env.DB.prepare('SELECT * FROM bookings WHERE id = ?').bind(booking_id).first<{id: string; deposit_amount: number; amount: number}>();
  if (!booking) return err('Booking not found', 404);

  const balanceAmount = booking.amount - booking.deposit_amount;
  if (balanceAmount <= 0) return err('No balance due');

  const orderRef = `BB${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2,6).toUpperCase()}`.substring(0, 30);

  const siteUrl = env.SITE_URL || 'https://cuci.jayabina.com';
  const body = {
    order_number: orderRef,
    amount: Math.round(balanceAmount * 100),
    name: 'Balance JAYACLEAN',
    phone: '60139373275',
    return_url: `${siteUrl}/success.html?order=${booking_id}&type=balance`,
    callback_url: '',
    payment_channel: env.BAYARCASH_PAYMENT_CHANNEL || '5'
  };

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${env.BAYARCASH_PAT}`,
    'Content-Type': 'application/json'
  };

  const resp = await fetch('https://api.console.bayar.cash/v3/payment-intents', {
    method: 'POST', headers, body: JSON.stringify(body)
  });
  const data = await resp.json() as any;
  if (!resp.ok) return err(data.message || 'Bayarcash error', resp.status);
  return ok({ url: data.url, id: data.id });
}
