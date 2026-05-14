/**
 * Publish-time integrity checks for institution-grade quizzes.
 */

const norm = (v) => String(v ?? '').trim().toLowerCase();

/**
 * @param {Array<import('sequelize').Model|object>} questions
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateQuizQuestionsForPublish(questions = []) {
  const errors = [];

  if (!Array.isArray(questions) || questions.length === 0) {
    errors.push('Add at least one question before publishing.');
    return { valid: false, errors };
  }

  questions.forEach((q, idx) => {
    const row = q?.dataValues ?? q;
    const n = idx + 1;
    const text = String(row.question_text ?? '').trim();
    if (!text) errors.push(`Question ${n}: prompt text is required.`);

    const marks = Number(row.marks);
    if (!Number.isFinite(marks) || marks < 1 || marks > 1000) {
      errors.push(`Question ${n}: points must be a whole number from 1 to 1000.`);
    }

    const type = row.question_type;
    const correct = String(row.correct_answer ?? '').trim();

    if (type === 'mcq') {
      const rawOpts = Array.isArray(row.options) ? row.options : [];
      const opts = rawOpts.map((o) => String(o ?? '').trim()).filter(Boolean);
      if (opts.length < 2) {
        errors.push(`Question ${n}: multiple-choice requires at least two non-blank options.`);
      }
      const lowered = opts.map(norm);
      const uniq = new Set(lowered);
      if (lowered.length >= 2 && uniq.size !== lowered.length) {
        errors.push(`Question ${n}: MCQ options must be unique (duplicate answers are not allowed).`);
      }
      if (!correct) {
        errors.push(`Question ${n}: select or enter the correct answer for this MCQ.`);
      } else if (!opts.some((o) => norm(o) === norm(correct))) {
        errors.push(`Question ${n}: correct answer must match one of the option texts exactly.`);
      }
    } else if (type === 'true_false') {
      if (!['true', 'false'].includes(norm(correct))) {
        errors.push(`Question ${n}: True/False requires correct answer "True" or "False".`);
      }
    } else if (type === 'short_answer') {
      if (!correct) {
        errors.push(`Question ${n}: short answer requires an expected answer for auto-grading.`);
      }
    } else {
      errors.push(`Question ${n}: unsupported question type.`);
    }
  });

  return { valid: errors.length === 0, errors };
}

/**
 * Preferred: duration_hours + duration_minutes. Falls back to time_limit_minutes.
 * @param {object} body
 * @returns {number} total minutes
 */
function totalDurationMinutesFromPayload(body = {}) {
  const hasParts = (body.duration_hours !== undefined && body.duration_hours !== '')
    || (body.duration_minutes !== undefined && body.duration_minutes !== '');

  if (!hasParts) {
    const m = Number.parseInt(body.time_limit_minutes ?? 30, 10);
    if (!Number.isFinite(m) || m < 1) {
      const err = new Error('Quiz duration must be at least 1 minute.');
      err.status = 400;
      throw err;
    }
    return Math.min(m, 24 * 60 * 14);
  }

  const h = Math.max(0, Math.min(336, Number.parseInt(body.duration_hours ?? 0, 10) || 0));
  const mins = Math.max(0, Math.min(59, Number.parseInt(body.duration_minutes ?? 0, 10) || 0));
  const total = h * 60 + mins;
  if (!Number.isFinite(total) || total < 1) {
    const err = new Error('Set duration using hours and/or minutes (minimum 1 minute total).');
    err.status = 400;
    throw err;
  }
  if (total > 24 * 60 * 14) {
    const err = new Error('Quiz duration cannot exceed 14 days.');
    err.status = 400;
    throw err;
  }
  return total;
}

module.exports = { validateQuizQuestionsForPublish, totalDurationMinutesFromPayload, norm };
