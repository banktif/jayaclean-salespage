import type { Env } from '../types';
import { err, ok, uuid, nowISO } from '../utils/helpers';
import { requireAuth, requireAdmin, getPrivateSetting, getSetting } from '../utils/middleware';

export async function handleBackup(req: Request, env: Env, path: string): Promise<Response> {
  const url = new URL(req.url);

  // POST /api/backup/db
  if (path === '/api/backup/db' && req.method === 'POST') {
    try {
      await checkBackupAuth(req, env);
      const body = await req.json().catch(() => ({})) as any;
      const force = body.force === true;

      const now = nowISO();
      const tables = ['profiles', 'app_settings', 'bookings', 'slots', 'tasks', 'task_photos', 'customers'];
      const dump: Record<string, any[]> = {};

      for (const table of tables) {
        let offset = 0;
        const rows: any[] = [];
        while (true) {
          const batch = await env.DB.prepare(`SELECT * FROM ${table} LIMIT 1000 OFFSET ?`).bind(offset).all();
          rows.push(...batch.results as any[]);
          if (batch.results.length < 1000) break;
          offset += 1000;
        }
        dump[table] = rows;
      }

      const json = JSON.stringify({ _meta: { project: 'jayaclean', timestamp: now }, ...dump });
      const compressed = await gzip(json);
      const filename = `db-backup-${now.replace(/[:.]/g, '-')}.json.gz`;

      // Upload to R2 if configured
      const r2Key = `db/${filename}`;
      if (env.BACKUP_R2) {
        try {
          await env.BACKUP_R2.put(r2Key, compressed, {
            httpMetadata: { contentType: 'application/gzip' }
          });
          await recordBackupLog(env.DB, 'r2', filename, 'ok', compressed.byteLength);
          await updateBackupStatus(env.DB, 'r2', now, 'ok');
        } catch (e: any) {
          await recordBackupLog(env.DB, 'r2', filename, 'error', e.message);
          await updateBackupStatus(env.DB, 'r2', now, e.message);
        }
      }

      // Prune old backups in R2 (keep 48)
      await pruneBackups(env, 'r2', 48);

      await env.DB.prepare(`INSERT INTO app_settings (key, value, updated_at) VALUES ('backup_last_db_at', ?, ?) ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?`)
        .bind(now, now, now, now).run();
      await env.DB.prepare(`INSERT INTO app_settings (key, value, updated_at) VALUES ('backup_last_db_status', ?, ?) ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?`)
        .bind('ok', now, 'ok', now).run();

      return ok({ filename, tables: tables.length, timestamp: now });
    } catch (e: any) {
      return err(e.msg || 'Backup failed', e.status || 500);
    }
  }

  // GET /api/backup/list
  if (path === '/api/backup/list' && req.method === 'GET') {
    try {
      await checkBackupAuth(req, env);
      if (!env.BACKUP_R2) return ok([]);

      const objects = await env.BACKUP_R2.list({ prefix: 'db/', limit: 60 });
      const files = [];
      for (const obj of objects.objects) {
        files.push({
          key: obj.key,
          size: obj.size,
          uploaded: obj.uploaded.toISOString()
        });
      }
      return ok(files);
    } catch (e: any) {
      return err(e.msg || 'List failed', e.status || 500);
    }
  }

  // GET /api/backup/status
  if (path === '/api/backup/status' && req.method === 'GET') {
    try {
      await requireAuth(req, env);
      const statusKeys = ['backup_last_db_at', 'backup_last_db_status', 'backup_last_drive_at', 'backup_last_drive_status',
        'backup_last_r2_at', 'backup_last_r2_status', 'backup_last_code_at', 'backup_last_code_status',
        'backup_freq_drive', 'backup_freq_r2'];
      const rows = await env.DB.prepare(`SELECT key, value FROM app_settings WHERE key IN (${statusKeys.map(() => '?').join(',')})`)
        .bind(...statusKeys).all();
      const status: Record<string, string> = {};
      for (const r of rows.results as any[]) status[r.key] = r.value;

      const r2Configured = !!(await getPrivateSetting(env.DB, 'r2_account_id'));
      const driveConfigured = !!(await getPrivateSetting(env.DB, 'gdrive_client_email'));

      return ok({ ...status, r2_configured: r2Configured, drive_configured: driveConfigured });
    } catch (e: any) {
      return err(e.msg || 'Error', e.status || 400);
    }
  }

  return err('Not found', 404);
}

// --- helpers ---

async function checkBackupAuth(req: Request, env: Env): Promise<void> {
  const backupKey = req.headers.get('x-backup-key');
  if (backupKey && backupKey === env.BACKUP_SECRET) return;
  const payload = await requireAuth(req, env);
  requireAdmin(payload);
}

async function recordBackupLog(db: D1Database, destination: string, filename: string, status: string, sizeBytes?: number): Promise<void> {
  await db.prepare('INSERT INTO backup_log (id, destination, filename, status, size_bytes) VALUES (?,?,?,?,?)')
    .bind(uuid(), destination, filename, status, sizeBytes || 0).run();
}

async function updateBackupStatus(db: D1Database, dest: string, ts: string, status: string): Promise<void> {
  const now = nowISO();
  const atKey = `backup_last_${dest}_at`;
  const stKey = `backup_last_${dest}_status`;
  for (const key of [atKey, stKey]) {
    const val = key === atKey ? ts : status;
    await db.prepare(`INSERT INTO app_settings (key, value, updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=?, updated_at=?`)
      .bind(key, val, now, val, now).run();
  }
}

async function pruneBackups(env: Env, prefix: string, keep: number): Promise<void> {
  if (!env.BACKUP_R2) return;
  const objects = await env.BACKUP_R2.list({ prefix: `db/`, limit: 200 });
  const sorted = objects.objects.sort((a, b) => a.uploaded.getTime() - b.uploaded.getTime());
  if (sorted.length <= keep) return;
  const toDelete = sorted.slice(0, sorted.length - keep);
  for (const obj of toDelete) {
    try { await env.BACKUP_R2.delete(obj.key); } catch {}
  }
}

async function gzip(data: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const bytes = enc.encode(data);
  const stream = new CompressionStream('gzip');
  const writer = stream.writable.getWriter();
  writer.write(bytes);
  writer.close();
  const chunks: Uint8Array[] = [];
  const reader = stream.readable.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    result.set(c, offset);
    offset += c.length;
  }
  return result;
}
