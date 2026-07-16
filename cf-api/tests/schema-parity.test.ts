import { getTableColumns, getTableName } from 'drizzle-orm';
import { getTableConfig, type SQLiteTable } from 'drizzle-orm/sqlite-core';
import { describe, expect, it } from 'vitest';
import {
  appSettings,
  backupLog,
  bookings,
  customers,
  privateSettings,
  profiles,
  slots,
  taskPhotos,
  tasks
} from '../src/db/schema';

const productionColumns: Record<string, string[]> = {
  app_settings: ['key', 'value', 'updated_at'],
  backup_log: ['id', 'destination', 'filename', 'status', 'error_msg', 'size_bytes', 'created_at'],
  bookings: ['id', 'created_at', 'updated_at', 'customer_name', 'customer_phone', 'customer_address', 'booking_date', 'booking_time', 'amount', 'deposit_amount', 'payment_status', 'bayarcash_ref', 'bayarcash_transaction_id', 'status', 'notes', 'customer_id'],
  customers: ['id', 'phone', 'name', 'email', 'address', 'notes', 'tags', 'status', 'total_bookings', 'completed_bookings', 'total_spent', 'first_booking_date', 'last_booking_date', 'created_at', 'updated_at'],
  private_settings: ['key', 'value'],
  profiles: ['id', 'full_name', 'phone', 'role', 'is_active', 'email', 'address', 'avatar_url', 'service_area', 'password', 'created_at'],
  slots: ['id', 'date', 'time_slot', 'is_booked', 'booking_id'],
  task_photos: ['id', 'task_id', 'type', 'url', 'uploaded_by', 'created_at'],
  tasks: ['id', 'booking_id', 'assigned_to', 'status', 'started_at', 'finished_at', 'completed_at', 'created_at', 'updated_at']
};

const productionIndexes: Record<string, string[]> = {
  app_settings: [],
  backup_log: ['idx_backup_log_dest'],
  bookings: ['idx_bookings_customer_id', 'idx_bookings_date'],
  customers: ['idx_customers_last_booking', 'idx_customers_phone', 'idx_customers_status'],
  private_settings: [],
  profiles: ['idx_profiles_email_unique', 'idx_profiles_phone', 'idx_profiles_role'],
  slots: ['idx_slots_date', 'idx_slots_date_time_booked'],
  task_photos: ['idx_task_photos_task_id'],
  tasks: ['idx_tasks_assigned_to', 'idx_tasks_booking_id', 'idx_tasks_status']
};

const tables: SQLiteTable[] = [
  appSettings,
  backupLog,
  bookings,
  customers,
  privateSettings,
  profiles,
  slots,
  taskPhotos,
  tasks
];

describe('Drizzle schema mirrors production D1 introspection', () => {
  it('contains every production table and column in database order', () => {
    const actual = Object.fromEntries(tables.map((table) => [
      getTableName(table),
      Object.values(getTableColumns(table)).map((column) => column.name)
    ]));

    expect(actual).toEqual(productionColumns);
  });

  it('contains every named production index', () => {
    const actual = Object.fromEntries(tables.map((table) => [
      getTableName(table),
      getTableConfig(table).indexes.map((index) => index.config.name).sort()
    ]));

    expect(actual).toEqual(productionIndexes);
  });
});

