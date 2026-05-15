-- Course communication layer extensions
-- Run: psql -U postgres -d sble -f extend_communications.sql

BEGIN;

ALTER TABLE announcements ADD COLUMN IF NOT EXISTS link_url VARCHAR(500);
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS attachment_name VARCHAR(255);
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS attachment_path VARCHAR(500);
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS publish_at TIMESTAMP;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE;

ALTER TABLE discussions ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES discussions(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_discussions_parent_id ON discussions(parent_id);
CREATE INDEX IF NOT EXISTS idx_announcements_publish_at ON announcements(publish_at);

COMMIT;
