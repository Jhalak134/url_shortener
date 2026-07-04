-- Users Table for OAuth
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    google_id VARCHAR(255) UNIQUE,
    email VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255),
    profile_image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Links Table
CREATE SEQUENCE IF NOT EXISTS short_code_seq START 100000;

CREATE TABLE IF NOT EXISTS links (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    original_url TEXT NOT NULL,
    short_code VARCHAR(255) UNIQUE NOT NULL,
    clicks_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Clicks Table (Partitioned by Month)
CREATE TABLE IF NOT EXISTS clicks (
    id BIGSERIAL,
    link_id INTEGER REFERENCES links(id) ON DELETE CASCADE,
    ip_address VARCHAR(45),
    user_agent TEXT,
    referer TEXT,
    country VARCHAR(2),
    region VARCHAR(255),
    city VARCHAR(255),
    device_type VARCHAR(50),
    browser VARCHAR(50),
    os VARCHAR(50),
    clicked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id, clicked_at)
) PARTITION BY RANGE (clicked_at);

-- Create initial partitions for the next few months
-- Note: A cron job or trigger is usually needed to create future partitions.
CREATE TABLE IF NOT EXISTS clicks_y2026m07 PARTITION OF clicks FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE IF NOT EXISTS clicks_y2026m08 PARTITION OF clicks FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE IF NOT EXISTS clicks_y2026m09 PARTITION OF clicks FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE IF NOT EXISTS clicks_y2026m10 PARTITION OF clicks FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE IF NOT EXISTS clicks_y2026m11 PARTITION OF clicks FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE IF NOT EXISTS clicks_y2026m12 PARTITION OF clicks FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_links_short_code ON links(short_code);
CREATE INDEX IF NOT EXISTS idx_links_user_id ON links(user_id);
CREATE INDEX IF NOT EXISTS idx_clicks_link_id ON clicks(link_id);
