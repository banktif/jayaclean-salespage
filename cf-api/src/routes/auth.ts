import { and, eq, sql } from 'drizzle-orm';
import type { Env } from '../types';
import { signJWT, verifyPassword, hashPassword, err, ok } from '../utils/helpers';
import { requireAuth, requireAdmin } from '../utils/middleware';
import { createDb } from '../db/client';
import { profiles } from '../db/schema';

export async function handleAuth(req: Request, env: Env, path: string): Promise<Response> {
  const db = createDb(env);

  // POST /api/auth/login
  if (path === '/api/auth/login' && req.method === 'POST') {
    const { email, password, phone } = await req.json() as any;
    let user;

    if (email) {
      user = await db.select({
        id: profiles.id, full_name: profiles.fullName, phone: profiles.phone,
        role: profiles.role, is_active: profiles.isActive, email: profiles.email,
        address: profiles.address, avatar_url: profiles.avatarUrl,
        service_area: profiles.serviceArea, password: profiles.password,
        created_at: profiles.createdAt
      }).from(profiles).where(and(
        sql`lower(${profiles.email}) = lower(${String(email).trim()})`,
        eq(profiles.isActive, 1)
      )).get();
    } else if (phone) {
      const digits = phone.replace(/\D/g, '');
      user = await db.select({
        id: profiles.id, full_name: profiles.fullName, phone: profiles.phone,
        role: profiles.role, is_active: profiles.isActive, email: profiles.email,
        address: profiles.address, avatar_url: profiles.avatarUrl,
        service_area: profiles.serviceArea, password: profiles.password,
        created_at: profiles.createdAt
      }).from(profiles).where(and(eq(profiles.phone, digits), eq(profiles.isActive, 1))).get();
    }

    if (!user) return err('Invalid credentials', 401);

    // Password hashes cannot be exported from Supabase Auth. Migrated staff
    // accounts must be reset by an admin instead of allowing first-use claims.
    if (!user.password) {
      return err('Password reset required. Contact the administrator.', 403);
    }

    const valid = await verifyPassword(password, user.password);
    if (!valid) return err('Invalid credentials', 401);

    const token = await signJWT({ sub: user.id, role: user.role, name: user.full_name }, env.JWT_SECRET);

    return ok({
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        avatar_url: user.avatar_url,
        service_area: user.service_area
      }
    });
  }

  // GET /api/auth/me
  if (path === '/api/auth/me' && req.method === 'GET') {
    try {
      const payload = await requireAuth(req, env);
      const user = await db.select({
        id: profiles.id, full_name: profiles.fullName, phone: profiles.phone,
        email: profiles.email, role: profiles.role, is_active: profiles.isActive,
        avatar_url: profiles.avatarUrl, service_area: profiles.serviceArea,
        address: profiles.address, created_at: profiles.createdAt
      }).from(profiles).where(eq(profiles.id, payload.sub)).get();
      if (!user) return err('User not found', 404);
      return ok(user);
    } catch (e: any) {
      return err(e.msg || 'Unauthorized', e.status || 401);
    }
  }

  // POST /api/auth/change-password
  if (path === '/api/auth/change-password' && req.method === 'POST') {
    try {
      const payload = await requireAuth(req, env);
      const { current_password, new_password } = await req.json() as any;
      if (!new_password || (new_password as string).length < 8) return err('Password must be at least 8 characters');

      const user = await db.select({ password: profiles.password }).from(profiles)
        .where(eq(profiles.id, payload.sub)).get();
      if (!user || !(await verifyPassword(current_password || '', user.password))) {
        return err('Current password is incorrect', 403);
      }

      const hashed = await hashPassword(new_password);
      await db.update(profiles).set({ password: hashed }).where(eq(profiles.id, payload.sub));
      return ok({ message: 'Password changed' });
    } catch (e: any) {
      return err(e.msg || 'Error', e.status || 400);
    }
  }

  // POST /api/auth/reset-password (admin only)
  if (path === '/api/auth/reset-password' && req.method === 'POST') {
    try {
      const payload = await requireAuth(req, env);
      requireAdmin(payload);
      const { user_id, new_password } = await req.json() as any;
      if (!new_password || (new_password as string).length < 8) return err('Password must be at least 8 characters');

      const hashed = await hashPassword(new_password);
      await db.update(profiles).set({ password: hashed }).where(eq(profiles.id, user_id));
      return ok({ message: 'Password reset' });
    } catch (e: any) {
      return err(e.msg || 'Error', e.status || 400);
    }
  }

  return err('Not found', 404);
}
