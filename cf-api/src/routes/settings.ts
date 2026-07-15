import type { Env } from '../types';
import { err, ok, nowISO } from '../utils/helpers';
import { requireAuth, requireAdmin } from '../utils/middleware';

export async function handleSettings(req: Request, env: Env, path: string): Promise<Response> {
  const url = new URL(req.url);

  // GET /api/settings (all auth users)
  if (path === '/api/settings' && req.method === 'GET') {
    try {
      await requireAuth(req, env);
      const rows = await env.DB.prepare('SELECT key, value, updated_at FROM app_settings ORDER BY key ASC').all();
      return ok(rows.results);
    } catch (e: any) {
      return err(e.msg || 'Error', e.status || 400);
    }
  }

  // GET /api/settings/public (anon: limited config)
  if (path === '/api/settings/public' && req.method === 'GET') {
    const rows = await env.DB.prepare(`SELECT key, value FROM app_settings WHERE key IN ('slots','max_slots_per_day','price_total','price_deposit','price_balance','business_name','coverage_area')`).all();
    const config: Record<string, string> = {};
    for (const r of rows.results as any[]) config[r.key] = r.value;
    return ok(config);
  }

  // PUT /api/settings - bulk update (admin only)
  if (path === '/api/settings' && req.method === 'PUT') {
    try {
      const payload = await requireAuth(req, env);
      requireAdmin(payload);
      const { settings } = await req.json() as { settings: Array<{key: string; value: string}> };
      if (!settings || !settings.length) return err('No settings provided');

      const now = nowISO();
      for (const s of settings) {
        await env.DB.prepare('INSERT INTO app_settings (key, value, updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?')
          .bind(s.key, s.value, now, s.value, now).run();
      }
      return ok({ updated: settings.length });
    } catch (e: any) {
      return err(e.msg || 'Error', e.status || 400);
    }
  }

  // GET /api/settings/private (admin only)
  if (path === '/api/settings/private' && req.method === 'GET') {
    try {
      const payload = await requireAuth(req, env);
      requireAdmin(payload);
      const rows = await env.DB.prepare('SELECT key, value FROM private_settings').all();
      return ok(rows.results);
    } catch (e: any) {
      return err(e.msg || 'Error', e.status || 400);
    }
  }

  // PUT /api/settings/private (admin only)
  if (path === '/api/settings/private' && req.method === 'PUT') {
    try {
      const payload = await requireAuth(req, env);
      requireAdmin(payload);
      const { settings } = await req.json() as { settings: Array<{key: string; value: string}> };
      if (!settings || !settings.length) return err('No settings provided');

      for (const s of settings) {
        await env.DB.prepare('INSERT OR REPLACE INTO private_settings (key, value) VALUES (?,?)')
          .bind(s.key, s.value).run();
      }
      return ok({ updated: settings.length });
    } catch (e: any) {
      return err(e.msg || 'Error', e.status || 400);
    }
  }

  return err('Not found', 404);
}
