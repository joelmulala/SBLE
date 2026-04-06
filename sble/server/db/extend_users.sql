ALTER TABLE users
  ADD COLUMN IF NOT EXISTS student_id VARCHAR(50),
  ADD COLUMN IF NOT EXISTS program VARCHAR(255),
  ADD COLUMN IF NOT EXISTS year_of_study INTEGER,
  ADD COLUMN IF NOT EXISTS semester INTEGER,
  ADD COLUMN IF NOT EXISTS mode VARCHAR(20),
  ADD COLUMN IF NOT EXISTS institution VARCHAR(255),
  ADD COLUMN IF NOT EXISTS staff_email VARCHAR(255);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_student_id_key'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_student_id_key UNIQUE (student_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_staff_email_key'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_staff_email_key UNIQUE (staff_email);
  END IF;
END $$;
