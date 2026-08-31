CREATE TABLE IF NOT EXISTS events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  name TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  serial_number TEXT,
  model_name TEXT,
  model_identifier TEXT,
  macos_version TEXT,
  macos_build TEXT,
  setup_manager_version TEXT,
  started_at TEXT,
  finished_at TEXT,
  duration_seconds INTEGER,
  computer_name TEXT,
  user_id TEXT,
  department TEXT,
  download_throughput INTEGER,
  upload_throughput INTEGER,
  failed_action_count INTEGER NOT NULL DEFAULT 0,
  total_action_count INTEGER NOT NULL DEFAULT 0,
  has_failed_actions INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_events_serial ON events(serial_number);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_macos ON events(macos_version);
CREATE INDEX IF NOT EXISTS idx_events_model ON events(model_name);
CREATE INDEX IF NOT EXISTS idx_events_failed ON events(has_failed_actions);
