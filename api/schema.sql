-- Digital Doorway Marketing CRM (Cloudflare D1, binding DB).
-- Apply:  cd api && npx wrangler d1 execute digital-doorway-crm --remote --file schema.sql
-- Safe to re-run: every statement is IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS contacts (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  name             TEXT    NOT NULL DEFAULT '',
  business         TEXT    NOT NULL DEFAULT '',
  email            TEXT    NOT NULL DEFAULT '',   -- stored lowercase; unique when set
  phone            TEXT    NOT NULL DEFAULT '',
  industry         TEXT    NOT NULL DEFAULT '',
  website          TEXT    NOT NULL DEFAULT '',
  city             TEXT    NOT NULL DEFAULT '',
  stage            TEXT    NOT NULL DEFAULT 'new', -- a key from settings.stages
  value_cents      INTEGER NOT NULL DEFAULT 49900,
  source           TEXT    NOT NULL DEFAULT '',
  tags             TEXT    NOT NULL DEFAULT '',
  notes            TEXT    NOT NULL DEFAULT '',
  launched_on      TEXT,                           -- YYYY-MM-DD the site went live
  services_until   TEXT,                           -- YYYY-MM-DD the 24 included months end
  crm_free_until   TEXT,                           -- YYYY-MM-DD the free CRM year ends
  crm_plan         TEXT    NOT NULL DEFAULT '',    -- '' | free | paid | declined
  bundle_plan      TEXT    NOT NULL DEFAULT '',    -- '' | bundle | individual | declined
  archived         INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT    NOT NULL,
  updated_at       TEXT    NOT NULL,
  last_activity_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS contacts_email ON contacts(email) WHERE email <> '';
CREATE INDEX IF NOT EXISTS contacts_stage ON contacts(archived, stage);

CREATE TABLE IF NOT EXISTS activities (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  kind       TEXT    NOT NULL,                     -- note | call | email | meeting | form | payment | stage | task | system
  body       TEXT    NOT NULL DEFAULT '',
  meta       TEXT,                                 -- JSON
  created_by TEXT    NOT NULL DEFAULT '',
  created_at TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS activities_contact ON activities(contact_id, created_at);
CREATE INDEX IF NOT EXISTS activities_recent ON activities(created_at);

CREATE TABLE IF NOT EXISTS tasks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
  title      TEXT    NOT NULL,
  due_on     TEXT,                                 -- YYYY-MM-DD
  done       INTEGER NOT NULL DEFAULT 0,
  done_at    TEXT,
  created_by TEXT    NOT NULL DEFAULT '',
  created_at TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS tasks_open ON tasks(done, due_on);
CREATE INDEX IF NOT EXISTS tasks_contact ON tasks(contact_id);

CREATE TABLE IF NOT EXISTS payments (
  id             TEXT    PRIMARY KEY,              -- Square payment ID
  contact_id     INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
  amount_cents   INTEGER NOT NULL,
  currency       TEXT    NOT NULL DEFAULT 'USD',
  receipt_number TEXT,
  receipt_url    TEXT,
  order_id       TEXT,
  items          TEXT,
  paid_on        TEXT    NOT NULL,                 -- YYYY-MM-DD, Pacific
  created_at     TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS payments_contact ON payments(contact_id);
CREATE INDEX IF NOT EXISTS payments_paid_on ON payments(paid_on);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL                              -- JSON
);

-- One row per admin email: the current sign-in code (hashed) and a daily send counter.
CREATE TABLE IF NOT EXISTS login_codes (
  email      TEXT    PRIMARY KEY,
  code_hash  TEXT    NOT NULL,
  expires_at INTEGER NOT NULL,                     -- epoch ms
  attempts   INTEGER NOT NULL DEFAULT 0,
  sent_at    INTEGER NOT NULL,                     -- epoch ms
  day        TEXT    NOT NULL,
  day_count  INTEGER NOT NULL DEFAULT 0
);
