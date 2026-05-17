-- Password authentication columns (safe to re-run)
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token_hash VARCHAR(64);
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_users_password_reset_token_hash
  ON users (password_reset_token_hash)
  WHERE password_reset_token_hash IS NOT NULL;
