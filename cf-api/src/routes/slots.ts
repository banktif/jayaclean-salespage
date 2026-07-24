import { and, count, eq } from 'drizzle-orm';
import type { Env } from '../types';
import { err, ok } from '../utils/helpers';
import { createDb, type AppDb } from '../db/client';
import { appSettings, slots as slotsTable } from '../db/schema';

export async function handleSlots(req: Request, env: Env, path: string): Promise<Response> {
  const url = new URL(req.url);
  const db = createDb(env);

  // GET /api/slots/available?date=&zone=
  if (path === '/api/slots/available' && req.method === 'GET') {
    const date = url.searchParams.get('date');
    if (!date) return err('Missing date parameter');

    const zoneId = url.searchParams.get('zone') || '';
    const slotsStr = await getSetting(db, 'booking_time_slots') || await getSetting(db, 'slots') || '9am,11am,2pm,4pm';
    const slotList = slotsStr.split(',').map(s => s.trim());

    const maxSlotsPerDay = parseInt(await getSetting(db, 'max_slots_per_day') || '200', 10);
    const slotCapsStr = await getSetting(db, 'slot_caps') || '{}';
    const slotCaps = parseSlotCaps(slotCapsStr);

    const bookedResult = await db.select({ time_slot: slotsTable.timeSlot }).from(slotsTable)
      .where(and(eq(slotsTable.date, date), eq(slotsTable.isBooked, 1)));

    const [bookedCount] = await db.select({ cnt: count() }).from(slotsTable)
      .where(and(eq(slotsTable.date, date), eq(slotsTable.isBooked, 1)));

    const totalBooked = bookedCount?.cnt || 0;
    const dayAvailable = totalBooked < maxSlotsPerDay;

    const slotBookingCounts: Record<string, number> = {};
    for (const r of bookedResult) {
      const ts = r.time_slot;
      slotBookingCounts[ts] = (slotBookingCounts[ts] || 0) + 1;
    }

    const result = slotList.map(s => {
      const perSlotCap = slotCaps[s] || 25;
      const slotBooked = slotBookingCounts[s] || 0;
      const slotAvailable = slotBooked < perSlotCap && dayAvailable;
      return { time_slot: s, available: slotAvailable, remaining: Math.max(0, perSlotCap - slotBooked) };
    });

    return ok(result);
  }

  // GET /api/slots/check?date=
  if (path === '/api/slots/check' && req.method === 'GET') {
    const date = url.searchParams.get('date');
    if (!date) return err('Missing date parameter');

    const maxSlotsPerDay = parseInt(await getSetting(db, 'max_slots_per_day') || '200', 10);
    const [bookedCount] = await db.select({ cnt: count() }).from(slotsTable)
      .where(and(eq(slotsTable.date, date), eq(slotsTable.isBooked, 1)));
    const available = (bookedCount?.cnt || 0) < maxSlotsPerDay;

    return ok({ available });
  }

  // GET /api/slots/zones
  if (path === '/api/slots/zones' && req.method === 'GET') {
    const { zones } = await import('../db/schema');
    const zoneList = await db.select({ id: zones.id, name: zones.name, displayOrder: zones.displayOrder })
      .from(zones)
      .where(eq(zones.isActive, 1))
      .orderBy(zones.displayOrder).all();
    return ok(zoneList);
  }

  return err('Not found', 404);
}

async function getSetting(db: AppDb, key: string): Promise<string> {
  const row = await db.select({ value: appSettings.value }).from(appSettings)
    .where(eq(appSettings.key, key)).get();
  return row?.value || '';
}

function parseSlotCaps(raw: string): Record<string, number> {
  try { return JSON.parse(raw); } catch { return {}; }
}
