import { getTableColumns, getTableName } from 'drizzle-orm';
import { getTableConfig, type SQLiteTable } from 'drizzle-orm/sqlite-core';
import { describe, expect, it } from 'vitest';
import {
  appSettings,
  backupLog,
  bookings,
  customers,
  invoices,
  privateSettings,
  profiles,
  quotations,
  receipts,
  slots,
  taskPhotos,
  tasks,
  zones
} from '../src/db/schema';

const productionColumns: Record<string, string[]> = {
  app_settings: ['key', 'value', 'updated_at'],
  backup_log: ['id', 'destination', 'filename', 'status', 'error_msg', 'size_bytes', 'created_at'],
  bookings: ['id', 'created_at', 'updated_at', 'customer_name', 'customer_phone', 'customer_address', 'booking_date', 'booking_time', 'amount', 'deposit_amount', 'payment_status', 'bayarcash_ref', 'bayarcash_transaction_id', 'status', 'notes', 'customer_id'],
  customers: ['id', 'phone', 'name', 'email', 'address', 'notes', 'tags', 'status', 'total_bookings', 'completed_bookings', 'total_spent', 'first_booking_date', 'last_booking_date', 'created_at', 'updated_at'],
  invoices: ['id', 'booking_id', 'quotation_id', 'number', 'customer_name', 'customer_phone', 'customer_address', 'items', 'subtotal', 'deposit_paid', 'balance_due', 'status', 'pdf_url', 'wa_sent_at', 'email_sent_at', 'paid_at', 'created_at', 'updated_at'],
  private_settings: ['key', 'value'],
  profiles: ['id', 'full_name', 'phone', 'role', 'is_active', 'email', 'address', 'avatar_url', 'service_area', 'priority', 'max_jobs_per_day', 'min_jobs_per_day', 'job_count_today', 'last_assigned_at', 'password', 'created_at'],
  quotations: ['id', 'customer_id', 'customer_name', 'customer_phone', 'customer_address', 'service_type', 'amount', 'details', 'zone_id', 'status', 'valid_until', 'converted_booking_id', 'notes', 'created_at', 'updated_at'],
  receipts: ['id', 'booking_id', 'invoice_id', 'number', 'payment_type', 'amount', 'payment_method', 'transaction_ref', 'customer_name', 'customer_phone', 'pdf_url', 'wa_sent_at', 'email_sent_at', 'created_at'],
  slots: ['id', 'date', 'time_slot', 'is_booked', 'booking_id'],
  task_photos: ['id', 'task_id', 'type', 'url', 'uploaded_by', 'created_at'],
  tasks: ['id', 'booking_id', 'assigned_to', 'status', 'started_at', 'finished_at', 'completed_at', 'workflow_step', 'staff_accepted_at', 'staff_confirmed_at', 'heading_at', 'arrived_at', 'staff_rejected', 'before_photos_count', 'after_photos_count', 'payment_requested_at', 'customer_paid_on_site', 'created_at', 'updated_at'],
  zones: ['id', 'name', 'adjacent_zones', 'display_order', 'is_active', 'created_at']
};

const productionIndexes: Record<string, string[]> = {
  app_settings: [],
  backup_log: ['idx_backup_log_dest'],
  bookings: ['idx_bookings_customer_id', 'idx_bookings_date'],
  customers: ['idx_customers_last_booking', 'idx_customers_phone', 'idx_customers_status'],
  invoices: ['idx_invoices_booking', 'idx_invoices_status'],
  private_settings: [],
  profiles: ['idx_profiles_email_unique', 'idx_profiles_phone', 'idx_profiles_priority', 'idx_profiles_role'],
  quotations: ['idx_quotations_customer', 'idx_quotations_status'],
  receipts: ['idx_receipts_booking', 'idx_receipts_payment_type'],
  slots: ['idx_slots_date'],
  task_photos: ['idx_task_photos_task_id'],
  tasks: ['idx_tasks_assigned_to', 'idx_tasks_booking_id', 'idx_tasks_status'],
  zones: []
};

const tables: SQLiteTable[] = [
  appSettings,
  backupLog,
  bookings,
  customers,
  invoices,
  privateSettings,
  profiles,
  quotations,
  receipts,
  slots,
  taskPhotos,
  tasks,
  zones
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

