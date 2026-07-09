-- =============================================================================
-- URL Shortener — Database Schema
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- SEQUENCE: short_code_seq
--
-- Used by the primary short-code generation strategy (hash.service.js).
-- Each new link calls nextval('short_code_seq'), then encodes the returned
-- integer into Base62. This guarantees collision-free, O(1) code generation
-- without any uniqueness check — the sequence is monotonically increasing and
-- never reuses values.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS short_code_seq
  START WITH 100000   -- skip low values so all codes are at least 3-4 chars
  INCREMENT BY 1
  NO MAXVALUE
  CACHE 1;


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: users
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                BIGSERIAL PRIMARY KEY,
  google_id         VARCHAR(255) UNIQUE,          -- OAuth subject identifier
  email             VARCHAR(255) UNIQUE NOT NULL,
  display_name      VARCHAR(255),                 -- "name" from Google profile
  profile_image_url TEXT,                         -- "avatar_url" from Google profile
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_email     ON users(email);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: links
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS links (
  id            BIGSERIAL PRIMARY KEY,
  user_id       BIGINT REFERENCES users(id) ON DELETE SET NULL,
  short_code    VARCHAR(12) NOT NULL UNIQUE,   -- Base62-encoded sequence value
  original_url  TEXT NOT NULL,
  is_custom     BOOLEAN NOT NULL DEFAULT FALSE, -- TRUE when user supplied alias
  expires_at    TIMESTAMPTZ,                    -- NULL means no expiry
  qr_code_path  TEXT,                           -- base64 data URL or file path
  clicks_count  BIGINT NOT NULL DEFAULT 0,      -- authoritative count (updated async)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Hot-path lookup: redirect handler always queries by short_code
CREATE INDEX IF NOT EXISTS idx_links_short_code ON links(short_code);

-- Dashboard query: get all links for a user, newest first
CREATE INDEX IF NOT EXISTS idx_links_user_id_created ON links(user_id, created_at DESC);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: clicks  (RANGE-PARTITIONED by month on clicked_at)
--
-- WHY PARTITION?
--   At scale this table grows unboundedly — a popular link can generate
--   millions of rows per month. Without partitioning:
--     • Vacuuming the whole table becomes expensive and blocks I/O.
--     • Analytical GROUP BY queries (per-day, per-country) must scan all rows.
--     • Dropping old data requires a slow DELETE + re-vacuum cycle.
--
--   With monthly RANGE partitioning on clicked_at:
--     • Postgres prunes irrelevant partitions at planning time — a query for
--       "last 30 days" only touches 1-2 partitions instead of the full table.
--     • Dropping an old month is an instant metadata operation: DROP TABLE
--       clicks_y2024m01 — no DELETE, no vacuum.
--     • Each partition can be individually vacuumed, indexed, and moved to
--       cheaper tablespace (tiered storage) as it ages.
--     • INSERT performance stays constant regardless of total table size because
--       Postgres routes each row to the correct child partition in O(log p).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clicks (
  id          BIGSERIAL,
  link_id     BIGINT NOT NULL REFERENCES links(id) ON DELETE CASCADE,
  ip_address  VARCHAR(45),                    -- IPv4 or IPv6 raw (not stored as hash for simplicity)
  ip_hash     VARCHAR(64),                    -- SHA256 hash for privacy-safe deduplication
  user_agent  TEXT,
  referer     TEXT,
  country     CHAR(2),                        -- ISO 3166-1 alpha-2 (e.g. "US", "IN")
  region      VARCHAR(100),
  city        VARCHAR(100),
  device_type VARCHAR(50),                    -- "desktop" | "mobile" | "tablet"
  browser     VARCHAR(100),
  os          VARCHAR(100),
  clicked_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (clicked_at);

-- ── Monthly partitions (pre-create current year; add via cron for future months)
CREATE TABLE IF NOT EXISTS clicks_y2025m01 PARTITION OF clicks
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE IF NOT EXISTS clicks_y2025m02 PARTITION OF clicks
  FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
CREATE TABLE IF NOT EXISTS clicks_y2025m03 PARTITION OF clicks
  FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');
CREATE TABLE IF NOT EXISTS clicks_y2025m04 PARTITION OF clicks
  FOR VALUES FROM ('2025-04-01') TO ('2025-05-01');
CREATE TABLE IF NOT EXISTS clicks_y2025m05 PARTITION OF clicks
  FOR VALUES FROM ('2025-05-01') TO ('2025-06-01');
CREATE TABLE IF NOT EXISTS clicks_y2025m06 PARTITION OF clicks
  FOR VALUES FROM ('2025-06-01') TO ('2025-07-01');
CREATE TABLE IF NOT EXISTS clicks_y2025m07 PARTITION OF clicks
  FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');
CREATE TABLE IF NOT EXISTS clicks_y2025m08 PARTITION OF clicks
  FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');
CREATE TABLE IF NOT EXISTS clicks_y2025m09 PARTITION OF clicks
  FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');
CREATE TABLE IF NOT EXISTS clicks_y2025m10 PARTITION OF clicks
  FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');
CREATE TABLE IF NOT EXISTS clicks_y2025m11 PARTITION OF clicks
  FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');
CREATE TABLE IF NOT EXISTS clicks_y2025m12 PARTITION OF clicks
  FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

CREATE TABLE IF NOT EXISTS clicks_y2026m01 PARTITION OF clicks
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE IF NOT EXISTS clicks_y2026m02 PARTITION OF clicks
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE IF NOT EXISTS clicks_y2026m03 PARTITION OF clicks
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE IF NOT EXISTS clicks_y2026m04 PARTITION OF clicks
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE IF NOT EXISTS clicks_y2026m05 PARTITION OF clicks
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE IF NOT EXISTS clicks_y2026m06 PARTITION OF clicks
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE IF NOT EXISTS clicks_y2026m07 PARTITION OF clicks
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE IF NOT EXISTS clicks_y2026m08 PARTITION OF clicks
  FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE IF NOT EXISTS clicks_y2026m09 PARTITION OF clicks
  FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE IF NOT EXISTS clicks_y2026m10 PARTITION OF clicks
  FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE IF NOT EXISTS clicks_y2026m11 PARTITION OF clicks
  FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE IF NOT EXISTS clicks_y2026m12 PARTITION OF clicks
  FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');

-- ── Indexes on clicks
-- Analytics queries filter and aggregate heavily on these three columns.
-- Each partition inherits the index definition automatically.
CREATE INDEX IF NOT EXISTS idx_clicks_link_id    ON clicks(link_id);
CREATE INDEX IF NOT EXISTS idx_clicks_clicked_at ON clicks(clicked_at);
-- Composite: covers the most common analytics query pattern (link + time range)
CREATE INDEX IF NOT EXISTS idx_clicks_link_time  ON clicks(link_id, clicked_at DESC);
