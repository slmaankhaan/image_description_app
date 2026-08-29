CREATE TABLE IF NOT EXISTS images (
  id            TEXT PRIMARY KEY,
  filename      TEXT NOT NULL,
  storage_path  TEXT NOT NULL,
  mime_type     TEXT NOT NULL,
  size_bytes    INTEGER NOT NULL,
  description   TEXT,
  status        TEXT NOT NULL CHECK (status IN ('pending','ready','failed')),
  error_message TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_images_created_at ON images(created_at DESC);
