-- JAYABINA Autonomous System Phase 1 — Foundation Schema
-- 2026-07-24: zones, staff_zones, workflow columns, quotations, invoices, receipts, wa_conversations,
-- analytics_events, partners, subscriptions + default settings

PRAGMA foreign_keys = ON;

-- ============================================================
-- profiles: add distribution columns
-- ============================================================
ALTER TABLE profiles ADD COLUMN priority INTEGER DEFAULT 999;
ALTER TABLE profiles ADD COLUMN max_jobs_per_day INTEGER DEFAULT 4;
ALTER TABLE profiles ADD COLUMN min_jobs_per_day INTEGER DEFAULT 2;
ALTER TABLE profiles ADD COLUMN job_count_today INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN last_assigned_at TEXT;

-- ============================================================
-- tasks: add workflow columns
-- ============================================================
ALTER TABLE tasks ADD COLUMN workflow_step INTEGER DEFAULT 0;
ALTER TABLE tasks ADD COLUMN staff_accepted_at TEXT;
ALTER TABLE tasks ADD COLUMN staff_confirmed_at TEXT;
ALTER TABLE tasks ADD COLUMN heading_at TEXT;
ALTER TABLE tasks ADD COLUMN arrived_at TEXT;
ALTER TABLE tasks ADD COLUMN staff_rejected INTEGER DEFAULT 0;
ALTER TABLE tasks ADD COLUMN before_photos_count INTEGER DEFAULT 0;
ALTER TABLE tasks ADD COLUMN after_photos_count INTEGER DEFAULT 0;
ALTER TABLE tasks ADD COLUMN payment_requested_at TEXT;
ALTER TABLE tasks ADD COLUMN customer_paid_on_site INTEGER DEFAULT 0;

-- ============================================================
-- zones: geographic service zones
-- ============================================================
CREATE TABLE IF NOT EXISTS zones (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  adjacent_zones TEXT DEFAULT '[]',  -- JSON array of adjacent zone IDs
  display_order INTEGER DEFAULT 0,
  is_active     INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO zones (id, name, adjacent_zones, display_order) VALUES
  ('kl-utara',    'KL - Utara',    '["kl-pusat","gombak"]', 1),
  ('kl-pusat',    'KL - Pusat',    '["kl-utara","kl-selatan","pj","cheras"]', 2),
  ('kl-selatan',  'KL - Selatan',  '["kl-pusat","cheras","kajang"]', 3),
  ('pj',          'Petaling Jaya', '["kl-pusat","shah-alam","subang","puchong"]', 4),
  ('shah-alam',   'Shah Alam',     '["pj","klang","subang"]', 5),
  ('subang',      'Subang Jaya',   '["pj","shah-alam","puchong"]', 6),
  ('kajang',      'Kajang / Bangi','["kl-selatan","cheras"]', 7),
  ('cheras',      'Cheras / Ampang','["kl-pusat","kl-selatan","kajang"]', 8),
  ('gombak',      'Gombak / Batu Caves','["kl-utara","kl-pusat"]', 9),
  ('puchong',     'Puchong',       '["pj","subang","kl-selatan"]', 10),
  ('klang',       'Klang',         '["shah-alam","pj"]', 11),
  ('lain',        'Lain-lain',     '[]', 12);

-- ============================================================
-- staff_zones: many-to-many staff ↔ zones
-- ============================================================
CREATE TABLE IF NOT EXISTS staff_zones (
  staff_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  zone_id  TEXT NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
  PRIMARY KEY (staff_id, zone_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_zones_zone ON staff_zones(zone_id);

-- ============================================================
-- wa_conversations: WhatsApp chatbot conversation state
-- ============================================================
CREATE TABLE IF NOT EXISTS wa_conversations (
  id          TEXT PRIMARY KEY,
  wa_phone    TEXT NOT NULL,
  state       TEXT NOT NULL,       -- 'awaiting_area','awaiting_date','awaiting_slot','awaiting_name',etc
  context     TEXT DEFAULT '{}',   -- JSON: accumulated conversation data
  booking_id  TEXT REFERENCES bookings(id) ON DELETE SET NULL,
  status      TEXT DEFAULT 'active' CHECK(status IN ('active','completed','abandoned')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_wa_conv_phone ON wa_conversations(wa_phone, status);

-- ============================================================
-- analytics_events: event tracking for funnel & reporting
-- ============================================================
CREATE TABLE IF NOT EXISTS analytics_events (
  id          TEXT PRIMARY KEY,
  event_type  TEXT NOT NULL,       -- 'page_view','form_start','form_submit','payment_initiated','payment_completed','job_started','job_completed','review_submitted',etc
  booking_id  TEXT REFERENCES bookings(id) ON DELETE SET NULL,
  customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  metadata    TEXT DEFAULT '{}',   -- JSON blob for extra data
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_analytics_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_booking ON analytics_events(booking_id);
CREATE INDEX IF NOT EXISTS idx_analytics_created ON analytics_events(created_at);

-- ============================================================
-- quotations: sebut harga / quotation system
-- ============================================================
CREATE TABLE IF NOT EXISTS quotations (
  id            TEXT PRIMARY KEY,
  customer_id   TEXT REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL DEFAULT '',
  customer_phone TEXT NOT NULL DEFAULT '',
  customer_address TEXT NOT NULL DEFAULT '',
  service_type  TEXT NOT NULL,     -- 'cuci_tangki','tukar_atap','cat_rumah'
  amount        REAL NOT NULL DEFAULT 0,
  details       TEXT DEFAULT '',   -- JSON: service details, scope of work
  zone_id       TEXT REFERENCES zones(id) ON DELETE SET NULL,
  status        TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','sent','accepted','rejected','expired')),
  valid_until   TEXT,              -- quotation expiry date
  converted_booking_id TEXT REFERENCES bookings(id) ON DELETE SET NULL,
  notes         TEXT DEFAULT '',
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_quotations_customer ON quotations(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotations_status ON quotations(status);

-- ============================================================
-- invoices: invoice / invois system
-- ============================================================
CREATE TABLE IF NOT EXISTS invoices (
  id            TEXT PRIMARY KEY,
  booking_id    TEXT UNIQUE REFERENCES bookings(id) ON DELETE SET NULL,
  quotation_id  TEXT REFERENCES quotations(id) ON DELETE SET NULL,
  number        TEXT NOT NULL UNIQUE,   -- INV-YYYYMMDD-XXX
  customer_name TEXT NOT NULL DEFAULT '',
  customer_phone TEXT NOT NULL DEFAULT '',
  customer_address TEXT NOT NULL DEFAULT '',
  items         TEXT NOT NULL DEFAULT '[]',  -- JSON array of line items
  subtotal      REAL NOT NULL DEFAULT 0,
  deposit_paid  REAL DEFAULT 0,
  balance_due   REAL NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','cancelled')),
  pdf_url       TEXT,
  wa_sent_at    TEXT,
  email_sent_at TEXT,
  paid_at       TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_invoices_booking ON invoices(booking_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

-- ============================================================
-- receipts: resit / receipt system
-- ============================================================
CREATE TABLE IF NOT EXISTS receipts (
  id              TEXT PRIMARY KEY,
  booking_id      TEXT REFERENCES bookings(id) ON DELETE SET NULL,
  invoice_id      TEXT REFERENCES invoices(id) ON DELETE SET NULL,
  number          TEXT NOT NULL UNIQUE,  -- RCP-YYYYMMDD-XXX
  payment_type    TEXT NOT NULL CHECK(payment_type IN ('deposit','balance','full')),
  amount          REAL NOT NULL DEFAULT 0,
  payment_method  TEXT DEFAULT '',        -- 'duitnow','fpx','cash','transfer'
  transaction_ref TEXT DEFAULT '',         -- Bayarcash transaction ID
  customer_name   TEXT NOT NULL DEFAULT '',
  customer_phone  TEXT NOT NULL DEFAULT '',
  pdf_url         TEXT,
  wa_sent_at      TEXT,
  email_sent_at   TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_receipts_booking ON receipts(booking_id);
CREATE INDEX IF NOT EXISTS idx_receipts_payment_type ON receipts(payment_type);

-- ============================================================
-- partners: agent / partner API access
-- ============================================================
CREATE TABLE IF NOT EXISTS partners (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  contact_phone   TEXT DEFAULT '',
  contact_email   TEXT DEFAULT '',
  api_key         TEXT NOT NULL UNIQUE,
  webhook_url     TEXT DEFAULT '',
  commission_rate REAL DEFAULT 0,     -- percentage
  is_active       INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
  rate_limit_per_hour INTEGER DEFAULT 10,
  total_bookings  INTEGER DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_partners_api_key ON partners(api_key);

-- ============================================================
-- subscriptions: recurring booking / langganan
-- ============================================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id               TEXT PRIMARY KEY,
  customer_id      TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  service_type     TEXT NOT NULL,       -- 'cuci_tangki','tukar_atap','cat_rumah'
  zone_id          TEXT REFERENCES zones(id) ON DELETE SET NULL,
  interval_days    INTEGER NOT NULL DEFAULT 180,  -- 6 bulan
  next_booking_date TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','paused','cancelled')),
  last_booking_id  TEXT REFERENCES bookings(id) ON DELETE SET NULL,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_subs_customer ON subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_subs_next_date ON subscriptions(next_booking_date, status);

-- ============================================================
-- rate_limits: rate limiting / abuse protection
-- ============================================================
CREATE TABLE IF NOT EXISTS rate_limits (
  id         TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,     -- IP address or phone number
  endpoint   TEXT NOT NULL,     -- api path
  count      INTEGER NOT NULL DEFAULT 1,
  window_start TEXT NOT NULL,   -- hour window start ISO
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup ON rate_limits(identifier, endpoint, window_start);

-- ============================================================
-- app_settings: new default keys for autonomous system
-- ============================================================
INSERT OR IGNORE INTO app_settings (key, value) VALUES
  ('distribution_mode', 'samarata'),
  ('default_max_jobs_per_staff', '4'),
  ('default_min_jobs_per_staff', '2'),
  ('slot_caps', '{"8am":20,"9am":20,"10am":25,"11am":25,"12pm":20,"1pm":20,"2pm":25,"3pm":25,"4pm":15,"5pm":5}'),
  ('booking_time_slots', '8am,9am,10am,11am,12pm,1pm,2pm,3pm,4pm,5pm'),
  ('max_slots_per_day', '200'),
  ('auto_assign_retry_on_reject', 'true'),
  ('max_staff_rejects', '3'),
  ('ai_verify_enabled', 'false'),
  ('ai_verify_confidence_threshold', '80'),
  ('wa_bot_enabled', 'false'),
  ('email_enabled', 'false'),
  ('invoice_prefix', 'INV'),
  ('receipt_prefix', 'RCP'),
  ('quotation_prefix', 'QT');
