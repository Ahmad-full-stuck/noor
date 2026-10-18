-- Noor Cloudflare secure vault — D1 migration
-- The app snapshot and uploaded file bytes are encrypted in the browser with a random data key.
-- The data key is wrapped with the user's password-derived key; plaintext is never stored in D1/R2.

CREATE TABLE IF NOT EXISTS noor_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  wrap_salt TEXT NOT NULL,
  wrapped_key TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS noor_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES noor_users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_noor_sessions_user ON noor_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_noor_sessions_expiry ON noor_sessions(expires_at);

CREATE TABLE IF NOT EXISTS noor_auth_limits (
  id TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL,
  window_start INTEGER NOT NULL,
  blocked_until INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS noor_snapshots (
  user_id TEXT PRIMARY KEY REFERENCES noor_users(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS noor_files (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES noor_users(id) ON DELETE CASCADE,
  object_key TEXT NOT NULL UNIQUE,
  iv TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_noor_files_user ON noor_files(user_id);
