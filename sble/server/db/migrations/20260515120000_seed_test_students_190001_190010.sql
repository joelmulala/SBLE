-- Seed 10 test students (student_id 190001–190010). Idempotent; safe to re-run.
-- Login password: TEMP_STUDENT_PASSWORD in server/.env (default student123)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO users (
  id,
  email,
  full_name,
  role,
  student_id,
  program,
  year_of_study,
  semester,
  mode,
  is_active
)
SELECT
  gen_random_uuid()::text,
  'student' || n::text || '@sble.local',
  'Test Student ' || n::text,
  'student'::user_role,
  n::text,
  'BSc Information Technology',
  1,
  1,
  'Full-time',
  TRUE
FROM generate_series(190001, 190010) AS n
ON CONFLICT (student_id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  role = 'student',
  program = COALESCE(users.program, EXCLUDED.program),
  year_of_study = COALESCE(users.year_of_study, EXCLUDED.year_of_study),
  semester = COALESCE(users.semester, EXCLUDED.semester),
  mode = COALESCE(users.mode, EXCLUDED.mode),
  is_active = TRUE;
