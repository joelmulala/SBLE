-- SBLE Seed Data (admin-only development seed)
-- Keeps one administrator account for initial access.
-- Students and lecturers are intentionally not preloaded.
-- Create new non-admin users through the system registration flow or Keycloak provisioning.
-- Admin temporary login uses the TEMP_ADMIN_PASSWORD value from server/.env when AUTH_DISABLED=true.
-- Run: psql -U postgres -d sble -f seed.sql

BEGIN;

TRUNCATE TABLE
  audit_logs,
  rooms,
  exams,
  quiz_attempts,
  quiz_questions,
  quizzes,
  submissions,
  assignments,
  materials,
  enrollments,
  courses,
  users
RESTART IDENTITY CASCADE;

INSERT INTO users (id, email, full_name, role, is_active) VALUES
('a0000001-0000-0000-0000-000000000001', 'admin1@sble.local', 'SBLE Administrator', 'admin', TRUE);

SELECT setval(pg_get_serial_sequence('courses', 'id'), COALESCE((SELECT MAX(id) FROM courses), 1), true);
SELECT setval(pg_get_serial_sequence('quizzes', 'id'), COALESCE((SELECT MAX(id) FROM quizzes), 1), true);

COMMIT;
