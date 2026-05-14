-- Assessment engine (PostgreSQL). Run: psql -U ... -d sble -f extend_assessment_engine.sql

ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS status VARCHAR(24) NOT NULL DEFAULT 'in_progress';

ALTER TABLE submissions ADD COLUMN IF NOT EXISTS results_published_at TIMESTAMP;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS grading_status VARCHAR(24) NOT NULL DEFAULT 'pending';

UPDATE submissions
SET grading_status = 'published',
    results_published_at = COALESCE(results_published_at, last_updated_time, submitted_at)
WHERE grade IS NOT NULL AND grading_status = 'pending';

UPDATE quiz_attempts qa
SET
  expires_at = qa.started_at + (GREATEST(COALESCE(q.time_limit_minutes, 30), 1) * INTERVAL '1 minute'),
  status = CASE WHEN qa.submitted_at IS NOT NULL THEN 'submitted' ELSE qa.status END
FROM quizzes q
WHERE q.id = qa.quiz_id
  AND qa.expires_at IS NULL
  AND qa.started_at IS NOT NULL;
