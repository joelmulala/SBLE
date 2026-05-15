/* eslint-disable no-console */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { sequelize } = require('../src/models');

const prefixes = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['SMOKE_', 'System Verification'];

const q = (sql, replacements = {}) => sequelize.query(sql, { replacements });

const run = async () => {
  await sequelize.authenticate();

  const [courses] = await q(`
    SELECT id, title FROM courses
    WHERE ${prefixes.map((_, i) => `title ILIKE :p${i}`).join(' OR ')}
  `, Object.fromEntries(prefixes.map((p, i) => [`p${i}`, `${p}%`])));

  if (!courses.length) {
    console.log('[cleanup] No matching courses.');
    await sequelize.close();
    return;
  }

  const ids = courses.map((c) => c.id);
  console.log('[cleanup] Removing', courses.length, 'course(s)...');

  const steps = [
    ['quiz_attempts', 'DELETE FROM quiz_attempts WHERE quiz_id IN (SELECT id FROM quizzes WHERE course_id IN (:ids))'],
    ['quiz_questions', 'DELETE FROM quiz_questions WHERE quiz_id IN (SELECT id FROM quizzes WHERE course_id IN (:ids))'],
    ['quizzes', 'DELETE FROM quizzes WHERE course_id IN (:ids)'],
    ['submissions', 'DELETE FROM submissions WHERE assignment_id IN (SELECT id FROM assignments WHERE course_id IN (:ids))'],
    ['assignments', 'DELETE FROM assignments WHERE course_id IN (:ids)'],
    ['materials', 'DELETE FROM materials WHERE course_id IN (:ids)'],
    ['exams', 'DELETE FROM exams WHERE course_id IN (:ids)'],
    ['announcements', 'DELETE FROM announcements WHERE course_id IN (:ids)'],
    ['discussions', 'DELETE FROM discussions WHERE course_id IN (:ids)'],
    ['calendar_custom_events', 'DELETE FROM calendar_custom_events WHERE course_id IN (:ids)'],
    ['live_class_attendance', 'DELETE FROM live_class_attendance WHERE session_id IN (SELECT id FROM live_class_sessions WHERE room_id IN (SELECT id FROM rooms WHERE course_id IN (:ids)))'],
    ['live_class_sessions', 'DELETE FROM live_class_sessions WHERE room_id IN (SELECT id FROM rooms WHERE course_id IN (:ids))'],
    ['rooms', 'DELETE FROM rooms WHERE course_id IN (:ids)'],
    ['course_module_items', 'DELETE FROM course_module_items WHERE module_id IN (SELECT id FROM course_modules WHERE course_id IN (:ids))'],
    ['course_modules', 'DELETE FROM course_modules WHERE course_id IN (:ids)'],
    ['enrollments', 'DELETE FROM enrollments WHERE course_id IN (:ids)'],
    ['courses', 'DELETE FROM courses WHERE id IN (:ids)']
  ];

  for (const [label, sql] of steps) {
    try {
      await q(sql, { ids });
    } catch (err) {
      if (label.startsWith('live_class') && /does not exist/i.test(err.message)) {
        console.log(`[cleanup] skip ${label} (table missing)`);
        continue;
      }
      throw err;
    }
  }

  console.log('[cleanup] Done.');
  await sequelize.close();
};

run().catch((err) => {
  console.error('[cleanup] Failed:', err.message);
  process.exit(1);
});
