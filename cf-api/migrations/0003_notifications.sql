-- JAYABINA — Workflow notifications log
-- Stores all autonomous workflow events for the admin live feed.

CREATE TABLE IF NOT EXISTS notifications (
  id        TEXT PRIMARY KEY,
  type      TEXT NOT NULL DEFAULT 'info',  -- info, success, warning, danger
  message   TEXT NOT NULL DEFAULT '',
  task_id   TEXT,
  booking_id TEXT,
  staff_id  TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
