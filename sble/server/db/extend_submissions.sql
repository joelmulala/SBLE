ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS last_updated_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

UPDATE submissions
SET last_updated_time = COALESCE(last_updated_time, submitted_at)
WHERE last_updated_time IS NULL;