/* eslint-disable no-console */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { v4: uuidv4 } = require('uuid');
const { sequelize, User } = require('../src/models');

const DEFAULT_START = String(process.env.SEED_STUDENT_ID_START || '220001');
const DEFAULT_END = String(process.env.SEED_STUDENT_ID_END || '2200135');
const DEFAULT_PROGRAM = process.env.SEED_STUDENT_PROGRAM || 'BSc Information Technology';
const DEFAULT_YEAR = Number.parseInt(process.env.SEED_STUDENT_YEAR || '1', 10);
const DEFAULT_SEMESTER = Number.parseInt(process.env.SEED_STUDENT_SEMESTER || '1', 10);
const DEFAULT_MODE = process.env.SEED_STUDENT_MODE || 'Full-time';

const parseRange = (startRaw, endRaw) => {
  const start = Number.parseInt(startRaw, 10);
  const end = Number.parseInt(endRaw, 10);

  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    throw new Error('Student ID start/end must be numeric');
  }

  if (end < start) {
    throw new Error('End student ID must be greater than or equal to start student ID');
  }

  // Heuristic for requests like 220001 -> 2200135 where "0135" commonly means 135 students.
  const numericDelta = end - start;
  if (numericDelta > 5000) {
    const tail = Number.parseInt(String(endRaw).slice(-3), 10);
    if (Number.isFinite(tail) && tail > 0) {
      const normalizedEnd = start + tail - 1;
      console.log(`[seed] Large range detected (${startRaw}..${endRaw}). Interpreting suffix "${tail}" as total count -> normalized end ${normalizedEnd}.`);
      return { start, end: normalizedEnd, interpretedFromLargeRange: true };
    }

    throw new Error(`Refusing to seed very large range (${start}..${end}). Provide a smaller end value.`);
  }

  return { start, end, interpretedFromLargeRange: false };
};

const buildStudent = (studentIdNumber) => {
  const studentId = String(studentIdNumber);
  const email = `student${studentId}@sble.local`;

  return {
    id: uuidv4(),
    email,
    full_name: `Test Student ${studentId}`,
    role: 'student',
    student_id: studentId,
    program: DEFAULT_PROGRAM,
    year_of_study: DEFAULT_YEAR,
    semester: DEFAULT_SEMESTER,
    mode: DEFAULT_MODE,
    is_active: true
  };
};

const seed = async () => {
  const startArg = process.argv[2] || DEFAULT_START;
  const endArg = process.argv[3] || DEFAULT_END;

  const { start, end } = parseRange(startArg, endArg);
  const total = end - start + 1;

  console.log(`[seed] Seeding student IDs from ${start} to ${end} (${total} records).`);
  console.log('[seed] Student login password is controlled by TEMP_STUDENT_PASSWORD (expected: student123).');

  await sequelize.authenticate();

  let created = 0;
  let existing = 0;

  for (let studentIdNumber = start; studentIdNumber <= end; studentIdNumber += 1) {
    const payload = buildStudent(studentIdNumber);

    const [user, wasCreated] = await User.findOrCreate({
      where: {
        student_id: payload.student_id
      },
      defaults: payload
    });

    if (wasCreated) {
      created += 1;
      continue;
    }

    // Keep existing records usable and standardized for test runs.
    await user.update({
      email: payload.email,
      full_name: payload.full_name,
      role: 'student',
      program: user.program || payload.program,
      year_of_study: user.year_of_study || payload.year_of_study,
      semester: user.semester || payload.semester,
      mode: user.mode || payload.mode,
      is_active: true
    });

    existing += 1;
  }

  const totalStudents = await User.count({ where: { role: 'student' } });

  console.log(`[seed] Done. Created: ${created}, Updated existing: ${existing}, Total students now: ${totalStudents}`);
};

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(`[seed] Failed: ${err.message}`);
    process.exit(1);
  });
