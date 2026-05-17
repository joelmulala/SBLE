/**
 * Client-side quiz integrity checks (mirrors server rules for instant lecturer feedback).
 */
export function validateQuizQuestionsForPublishClient(questions = []) {
  const errors = [];
  if (!Array.isArray(questions) || questions.length === 0) {
    errors.push('Add at least one question before publishing.');
    return { valid: false, errors };
  }

  const norm = (v) => String(v ?? '').trim().toLowerCase();

  questions.forEach((q, idx) => {
    const n = idx + 1;
    const text = String(q.question_text ?? '').trim();
    if (!text) errors.push(`Question ${n}: prompt text is required.`);

    const marks = Number(q.marks);
    if (!Number.isFinite(marks) || marks < 1 || marks > 1000) {
      errors.push(`Question ${n}: points must be a whole number from 1 to 1000.`);
    }

    const type = q.question_type;
    const correct = String(q.correct_answer ?? '').trim();

    if (type === 'mcq') {
      const opts = (Array.isArray(q.options) ? q.options : [])
        .map((o) => String(o ?? '').trim())
        .filter(Boolean);
      if (opts.length < 2) errors.push(`Question ${n}: multiple-choice requires at least two non-blank options.`);
      const lowered = opts.map(norm);
      if (lowered.length >= 2 && new Set(lowered).size !== lowered.length) {
        errors.push(`Question ${n}: MCQ options must be unique.`);
      }
      if (!correct) errors.push(`Question ${n}: designate the correct MCQ answer.`);
      else if (!opts.some((o) => norm(o) === norm(correct))) {
        errors.push(`Question ${n}: correct answer must match one option exactly.`);
      }
    } else if (type === 'true_false') {
      if (!['true', 'false'].includes(norm(correct))) {
        errors.push(`Question ${n}: use "True" or "False" as the correct answer.`);
      }
    } else if (type === 'short_answer') {
      if (!correct) errors.push(`Question ${n}: enter the expected short answer.`);
    } else {
      errors.push(`Question ${n}: unsupported question type — choose MCQ, True/False, or Short answer.`);
    }
  });

  const totalMarks = questions.reduce((sum, q) => sum + (Number(q.marks) || 0), 0);
  if (totalMarks < 1) {
    errors.push('Total quiz points must be at least 1.');
  }

  return { valid: errors.length === 0, errors };
}

export function buildPublishReadiness(questions = [], form = null) {
  const check = validateQuizQuestionsForPublishClient(questions);
  const errors = [...check.errors];
  if (form && !String(form.title || '').trim()) {
    errors.unshift('Quiz title is required before publishing.');
  }
  if (form) {
    const mins = totalDurationMinutesFromForm(form);
    if (mins < 1) errors.push('Set a quiz duration of at least 1 minute.');
  }
  return { valid: errors.length === 0, errors, totalMarks: questions.reduce((s, q) => s + (Number(q.marks) || 0), 0) };
}

export function totalDurationMinutesFromForm(form = {}) {
  const h = Math.max(0, Number.parseInt(form.duration_hours ?? 0, 10) || 0);
  const m = Math.max(0, Number.parseInt(form.duration_minutes ?? 0, 10) || 0);
  const total = h * 60 + m;
  if (total >= 1) return Math.min(total, 24 * 60 * 14);
  const fallback = Number.parseInt(form.time_limit_minutes ?? 30, 10);
  if (!Number.isFinite(fallback) || fallback < 1) return 30;
  return Math.min(fallback, 24 * 60 * 14);
}
