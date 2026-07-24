import { and, asc, count, eq, sql } from 'drizzle-orm';
import { createDb, type AppDb } from '../db/client';
import { appSettings as appSettingsTbl, bookings, profiles, tasks, staffZones, zones } from '../db/schema';
import { nowISO } from '../utils/helpers';

export type DistributionMode = 'samarata' | 'priority' | 'area';

async function getSetting(db: AppDb, key: string): Promise<string> {
  const row = await db.select({ value: appSettingsTbl.value }).from(appSettingsTbl)
    .where(eq(appSettingsTbl.key, key)).get();
  return row?.value || '';
}

export async function resetDailyCounts(db: AppDb): Promise<void> {
  await db.update(profiles).set({ jobCountToday: 0 }).where(eq(profiles.role, 'staff'));
}

function parseSlotCaps(raw: string): Record<string, number> {
  try { return JSON.parse(raw); } catch { return {}; }
}

async function getActiveStaffForMode(db: AppDb, mode: DistributionMode, zoneId?: string, taskId?: string) {
  const baseCondition = and(
    eq(profiles.role, 'staff'),
    eq(profiles.isActive, 1)
  );

  if (mode === 'area' && zoneId) {
    const zoneStaff = await db.select({ staffId: staffZones.staffId })
      .from(staffZones)
      .where(eq(staffZones.zoneId, zoneId)).all();

    const staffIds = zoneStaff.map(z => z.staffId);
    if (staffIds.length > 0) {
      return { condition: and(baseCondition, sql`${profiles.id} IN (${sql.join(staffIds.map(id => sql`${id}`), sql`,`)})`), hasZoneMatch: true };
    }

    const zone = await db.select({ adjacentZones: zones.adjacentZones })
      .from(zones).where(eq(zones.id, zoneId!)).get();

    if (zone?.adjacentZones) {
      try {
        const adjIds: string[] = JSON.parse(zone.adjacentZones as string);
        if (adjIds.length > 0) {
          const adjStaff = await db.select({ staffId: staffZones.staffId })
            .from(staffZones)
            .where(sql`${staffZones.zoneId} IN (${sql.join(adjIds.map(id => sql`${id}`), sql`,`)})`).all();
          const adjStaffIds = adjStaff.map(z => z.staffId);
          if (adjStaffIds.length > 0) {
            return {
              condition: and(baseCondition, sql`${profiles.id} IN (${sql.join(adjStaffIds.map(id => sql`${id}`), sql`,`)})`),
              hasZoneMatch: true,
              isAdjacent: true
            };
          }
        }
      } catch {}
    }

    return { condition: baseCondition, hasZoneMatch: false };
  }

  return { condition: baseCondition, hasZoneMatch: true };
}

async function pickStaffSamarata(db: AppDb, filterCondition: any): Promise<string | null> {
  const staffList = await db.select({
    id: profiles.id,
    jobCount: profiles.jobCountToday,
    maxJobs: profiles.maxJobsPerDay
  }).from(profiles)
    .where(and(
      filterCondition,
      sql`(${profiles.jobCountToday} < ${profiles.maxJobsPerDay})`
    ))
    .orderBy(asc(profiles.jobCountToday), asc(profiles.lastAssignedAt)).all();

  if (staffList.length === 0) return null;

  const minJobs = staffList[0].jobCount ?? 0;

  if (minJobs >= 2) {
    return staffList[0].id;
  }

  const below2 = staffList.filter(s => (s.jobCount ?? 0) < 2);
  if (below2.length > 0) return below2[0].id;

  return staffList[0].id;
}

async function pickStaffPriority(db: AppDb, filterCondition: any, taskId: string): Promise<string | null> {
  const staffList = await db.select({
    id: profiles.id,
    jobCount: profiles.jobCountToday,
    maxJobs: profiles.maxJobsPerDay,
    priority: profiles.priority
  }).from(profiles)
    .where(and(
      filterCondition,
      sql`(${profiles.jobCountToday} < ${profiles.maxJobsPerDay})`
    ))
    .orderBy(asc(profiles.priority)).all();

  if (staffList.length === 0) return null;

  for (const staff of staffList) {
    const count = staff.jobCount ?? 0;
    if (count >= 2) return staff.id;
  }

  for (const staff of staffList) {
    const count = staff.jobCount ?? 0;
    if (count >= 0) return staff.id;
  }

  return null;
}

async function pickStaffArea(db: AppDb, filterCondition: any): Promise<string | null> {
  const staffList = await db.select({
    id: profiles.id,
    jobCount: profiles.jobCountToday,
    maxJobs: profiles.maxJobsPerDay
  }).from(profiles)
    .where(and(
      filterCondition,
      sql`(${profiles.jobCountToday} < ${profiles.maxJobsPerDay})`
    ))
    .orderBy(asc(profiles.jobCountToday), asc(profiles.lastAssignedAt)).all();

  if (staffList.length === 0) return null;
  return staffList[0].id;
}

export async function distributeTask(
  db: AppDb,
  taskId: string,
  zoneId?: string
): Promise<{ assigned: boolean; staffId?: string; mode: DistributionMode }> {
  const mode = (await getSetting(db, 'distribution_mode') || 'samarata') as DistributionMode;

  const task = await db.select({
    id: tasks.id,
    assignedTo: tasks.assignedTo,
    bookingId: tasks.bookingId
  }).from(tasks).where(eq(tasks.id, taskId)).get();

  if (!task || task.assignedTo) return { assigned: false, mode };

  const dailyMax = parseInt(await getSetting(db, 'max_slots_per_day') || '200', 10);
  const todayBooked = await db.select({ cnt: count() }).from(tasks)
    .where(and(
      sql`${tasks.assignedTo} IS NOT NULL`,
      sql`date(${tasks.createdAt}) = date('now')`
    )).get();

  if ((todayBooked?.cnt ?? 0) >= dailyMax) return { assigned: false, mode };

  let staffId: string | null = null;
  let usedMode = mode;

  if (mode === 'area' && zoneId) {
    const { condition, hasZoneMatch, isAdjacent } = await getActiveStaffForMode(db, 'area', zoneId);
    if (hasZoneMatch) {
      staffId = await pickStaffArea(db, condition);
      if (staffId) usedMode = 'area';
    }
    if (!staffId) {
      const { condition: fb } = await getActiveStaffForMode(db, 'samarata');
      staffId = await pickStaffPriority(db, fb, taskId);
      if (staffId) usedMode = 'samarata';
    }
  }

  if (!staffId && mode === 'priority') {
    const { condition } = await getActiveStaffForMode(db, 'priority');
    staffId = await pickStaffPriority(db, condition, taskId);
    usedMode = 'priority';
  }

  if (!staffId) {
    const { condition } = await getActiveStaffForMode(db, 'samarata');
    staffId = await pickStaffSamarata(db, condition);
    usedMode = 'samarata';
  }

  if (!staffId) return { assigned: false, mode };

  await db.update(tasks).set({
    assignedTo: staffId,
    status: 'assigned',
    workflowStep: 1,
    updatedAt: nowISO()
  }).where(eq(tasks.id, taskId));

  await db.update(profiles).set({
    jobCountToday: sql`${profiles.jobCountToday} + 1`,
    lastAssignedAt: nowISO()
  }).where(eq(profiles.id, staffId));

  return { assigned: true, staffId, mode: usedMode };
}

export async function handleTaskReject(db: AppDb, taskId: string): Promise<boolean> {
  const task = await db.select({
    id: tasks.id,
    staffRejected: tasks.staffRejected,
    workflowStep: tasks.workflowStep
  }).from(tasks).where(eq(tasks.id, taskId)).get();

  if (!task) return false;

  const maxRejects = parseInt(await getSetting(db, 'max_staff_rejects') || '3', 10);
  const newRejectCount = (task.staffRejected ?? 0) + 1;

  if (newRejectCount >= maxRejects) {
    await db.update(tasks).set({
      assignedTo: null,
      status: 'unassigned',
      workflowStep: 0,
      staffRejected: newRejectCount,
      staffAcceptedAt: null,
      updatedAt: nowISO()
    }).where(eq(tasks.id, taskId));
    return false;
  }

  await db.update(tasks).set({
    assignedTo: null,
    status: 'unassigned',
    workflowStep: 0,
    staffRejected: newRejectCount,
    updatedAt: nowISO()
  }).where(eq(tasks.id, taskId));

  const retry = await getSetting(db, 'auto_assign_retry_on_reject') || 'true';
  if (retry === 'true') {
    const booking = await db.select({ customerAddress: bookings.customerAddress })
      .from(tasks).innerJoin(bookings, eq(bookings.id, tasks.bookingId))
      .where(eq(tasks.id, taskId)).get();

    let zoneId: string | undefined;
    if (booking?.customerAddress) {
      const z = await db.select({ id: zones.id })
        .from(zones)
        .where(sql`lower(${zones.name}) LIKE '%' || lower(${booking.customerAddress}) || '%'`)
        .limit(1).get();
      if (z?.id) zoneId = z.id;
    }

    await distributeTask(db, taskId, zoneId);
  }

  return true;
}

export async function bulkDistributeUnassigned(db: AppDb): Promise<{ assigned: number }> {
  const unassigned = await db.select({
    id: tasks.id,
    bookingId: tasks.bookingId
  }).from(tasks)
    .where(and(sql`${tasks.assignedTo} IS NULL`, eq(tasks.status, 'unassigned'))).all();

  let assigned = 0;
  for (const t of unassigned) {
    const b = await db.select({ address: bookings.customerAddress })
      .from(bookings).where(eq(bookings.id, t.bookingId)).get();

    let zoneId: string | undefined;
    if (b?.address) {
      try {
        const z = await db.select({ id: zones.id })
          .from(zones)
          .where(sql`lower(${zones.name}) LIKE '%' || lower(${b.address}) || '%'`)
          .limit(1).get();
        if (z?.id) zoneId = z.id;
      } catch {}
    }

    const result = await distributeTask(db, t.id, zoneId);
    if (result.assigned) assigned++;
  }

  return { assigned };
}
