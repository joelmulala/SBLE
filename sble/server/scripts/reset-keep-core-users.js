/* eslint-disable no-console */
/**
 * Remove all academic/test data and extra users.
 * Keeps only: admin, Joel Mulala, Hart.
 *
 * Usage: node scripts/reset-keep-core-users.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { sequelize } = require('../src/models');

const KEEP_USER_IDS = [
  'a0000001-0000-0000-0000-000000000001', // admin
  '2f558d9b-edce-4c99-8869-8724650d536c', // Joel Mulala (lecturer)
  'df7010c1-9e30-49fe-bf95-e5e1527fbb06' // Hart (student)
];

const q = (sql, replacements = {}) => sequelize.query(sql, { replacements });

const run = async () => {
  await sequelize.authenticate();

  const [keepers] = await q(
    `SELECT id, email, full_name, role FROM users WHERE id IN (:ids) ORDER BY full_name`,
    { ids: KEEP_USER_IDS }
  );

  if (keepers.length !== KEEP_USER_IDS.length) {
    const found = new Set(keepers.map((u) => u.id));
    const missing = KEEP_USER_IDS.filter((id) => !found.has(id));
    throw new Error(`Missing required user(s): ${missing.join(', ')}`);
  }

  console.log('[reset] Keeping users:');
  keepers.forEach((u) => console.log(`  - ${u.full_name} <${u.email}> (${u.role})`));

  const truncateSteps = [
    'live_class_attendance',
    'live_class_sessions',
    'quiz_attempts',
    'quiz_questions',
    'quizzes',
    'submissions',
    'assignments',
    'materials',
    'exams',
    'announcements',
    'discussions',
    'calendar_custom_events',
    'course_module_items',
    'course_modules',
    'rooms',
    'enrollments',
    'courses',
    'audit_logs'
  ];

  for (const table of truncateSteps) {
    try {
      await q(`DELETE FROM ${table}`);
      console.log(`[reset] cleared ${table}`);
    } catch (err) {
      if (/does not exist/i.test(err.message)) {
        console.log(`[reset] skip ${table} (table missing)`);
        continue;
      }
      throw err;
    }
  }

  const [removed] = await q(
    `DELETE FROM users WHERE id NOT IN (:ids) RETURNING id, email, full_name`,
    { ids: KEEP_USER_IDS }
  );

  console.log(`[reset] removed ${removed.length} user(s)`);

  await q(
    `SELECT setval(pg_get_serial_sequence('courses', 'id'), COALESCE((SELECT MAX(id) FROM courses), 1), true)`
  );
  await q(
    `SELECT setval(pg_get_serial_sequence('quizzes', 'id'), COALESCE((SELECT MAX(id) FROM quizzes), 1), true)`
  );

  const [remaining] = await q('SELECT id, email, full_name, role FROM users ORDER BY full_name');
  console.log('[reset] Remaining users:', remaining.length);
  remaining.forEach((u) => console.log(`  - ${u.full_name} <${u.email}> (${u.role})`));

  await sequelize.close();
  console.log('[reset] Done.');
};

run().catch((err) => {
  console.error('[reset] Failed:', err.message);
  process.exit(1);
});
