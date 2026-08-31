ALTER TABLE events ADD COLUMN is_archived INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_events_active ON events(timestamp DESC) WHERE is_archived = 0;
