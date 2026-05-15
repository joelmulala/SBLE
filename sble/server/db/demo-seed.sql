-- SBLE demo accounts for thesis / evaluator walkthrough
-- Runs after seed.sql (admin). Uses TEMP_* passwords from .env / .env.example.

BEGIN;

INSERT INTO users (id, email, full_name, role, institution, staff_email, is_active) VALUES
('b0000001-0000-0000-0000-000000000001', 'lecturer.demo@sble.local', 'Dr. Ama Mensah', 'lecturer', 'SBLE University', 'lecturer.demo@sble.local', TRUE),
('c0000001-0000-0000-0000-000000000001', 'student.demo@sble.local', 'Kwame Asante', 'student', NULL, NULL, TRUE)
ON CONFLICT (email) DO NOTHING;

UPDATE users SET
  institution = COALESCE(institution, 'SBLE University'),
  staff_email = COALESCE(staff_email, email)
WHERE email = 'lecturer.demo@sble.local';

UPDATE users SET
  student_id = COALESCE(student_id, 'DEMO001'),
  program = COALESCE(program, 'BSc Information Technology'),
  year_of_study = COALESCE(year_of_study, 2),
  semester = COALESCE(semester, 1),
  mode = COALESCE(mode, 'Full-time')
WHERE email = 'student.demo@sble.local';

INSERT INTO courses (title, description, lecturer_id, is_active)
SELECT
  'Introduction to Cybersecurity',
  'Foundations of information security, risk management, and secure software practices for blended delivery.',
  'b0000001-0000-0000-0000-000000000001',
  TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM courses WHERE title = 'Introduction to Cybersecurity'
);

INSERT INTO enrollments (course_id, student_id)
SELECT c.id, 'c0000001-0000-0000-0000-000000000001'
FROM courses c
WHERE c.title = 'Introduction to Cybersecurity'
  AND c.lecturer_id = 'b0000001-0000-0000-0000-000000000001'
ON CONFLICT (course_id, student_id) DO NOTHING;

INSERT INTO course_modules (course_id, title, description, sort_order, is_published)
SELECT c.id, 'Week 1 — Security fundamentals', 'Threat models, CIA triad, and institutional policy.', 1, TRUE
FROM courses c
WHERE c.title = 'Introduction to Cybersecurity'
  AND NOT EXISTS (
    SELECT 1 FROM course_modules m
    WHERE m.course_id = c.id AND m.title = 'Week 1 — Security fundamentals'
  );

INSERT INTO announcements (course_id, author_id, title, body, is_pinned, is_hidden, publish_at)
SELECT
  c.id,
  'b0000001-0000-0000-0000-000000000001',
  'Welcome to SBLE',
  'This course uses the Secure Blended Learning Environment. Check the course home for modules, assignments, and live class links.',
  TRUE,
  FALSE,
  CURRENT_TIMESTAMP
FROM courses c
WHERE c.title = 'Introduction to Cybersecurity'
  AND NOT EXISTS (
    SELECT 1 FROM announcements a
    WHERE a.course_id = c.id AND a.title = 'Welcome to SBLE'
  );

COMMIT;
