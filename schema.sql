-- CBR Laundry Service — D1 schema
-- Run this once in the Cloudflare D1 console (Workers & Pages → D1 → your DB → Console)
-- after creating the database and binding it to the Pages project as `DB`.

CREATE TABLE IF NOT EXISTS requests (
  id TEXT PRIMARY KEY,
  villa_number INTEGER NOT NULL,
  staff_name TEXT NOT NULL,
  notes TEXT,
  urgent INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Pending',      -- Pending | Done | Collected
  created_at TEXT NOT NULL,
  done_at TEXT,
  collected_by TEXT,
  collected_notes TEXT,
  collected_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_villa ON requests(villa_number);

-- A single device (endpoint) can hold a 'villa' subscription and a
-- 'manager' subscription at once (e.g. staff testing both roles on one
-- phone) — they must not overwrite each other, hence the composite key.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  role TEXT NOT NULL,          -- 'villa' | 'manager'
  request_id TEXT,             -- villa: the most recent request this device should hear about (nullable)
  created_at TEXT NOT NULL,
  UNIQUE(endpoint, role)
);

CREATE INDEX IF NOT EXISTS idx_push_role ON push_subscriptions(role);
CREATE INDEX IF NOT EXISTS idx_push_request ON push_subscriptions(request_id);
