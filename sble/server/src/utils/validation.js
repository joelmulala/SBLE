const path = require('path');

const ROLE_PRIORITY = ['admin', 'lecturer', 'student'];

const resolvePrimaryRole = (roles = []) => {
  const list = Array.isArray(roles) ? roles : [];
  for (const role of ROLE_PRIORITY) {
    if (list.includes(role)) return role;
  }
  return list[0] || null;
};

const requireNonemptyTitle = (title, fieldName = 'title') => {
  const text = String(title || '').trim();
  if (text.length < 2) {
    const err = new Error(`${fieldName} must be at least 2 characters`);
    err.status = 400;
    throw err;
  }
  if (text.length > 255) {
    const err = new Error(`${fieldName} must be at most 255 characters`);
    err.status = 400;
    throw err;
  }
  return text;
};

const clampGrade = (grade, { min = 0, max = 100 } = {}) => {
  if (grade === '' || grade === undefined || grade === null) return null;
  const num = Number(grade);
  if (!Number.isFinite(num)) {
    const err = new Error('Grade must be a number');
    err.status = 400;
    throw err;
  }
  if (num < min || num > max) {
    const err = new Error(`Grade must be between ${min} and ${max}`);
    err.status = 400;
    throw err;
  }
  return Math.round(num * 100) / 100;
};

const sanitizeFilename = (name, fallback = 'file') => {
  const base = path.basename(String(name || fallback));
  const cleaned = base.replace(/[^\w.\-()+ ]/g, '_').replace(/\.{2,}/g, '.').trim();
  return (cleaned || fallback).slice(0, 200);
};

const VALID_SUBMISSION_TYPES = ['typed', 'scanned', 'handwritten'];

const parseSubmissionType = (value, fallback = 'typed') => {
  const normalized = String(value || fallback).toLowerCase();
  if (!VALID_SUBMISSION_TYPES.includes(normalized)) {
    const err = new Error(`submission_type must be one of: ${VALID_SUBMISSION_TYPES.join(', ')}`);
    err.status = 400;
    throw err;
  }
  return normalized;
};

const filterAnswersForQuiz = (answers, questions = []) => {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    const err = new Error('answers must be an object');
    err.status = 400;
    throw err;
  }

  const allowed = new Set(questions.map((q) => String(q.id)));
  const filtered = {};

  Object.entries(answers).forEach(([key, value]) => {
    if (!allowed.has(String(key))) return;
    if (typeof value === 'string') {
      filtered[key] = value.trim().slice(0, 5000);
    } else if (value !== null && value !== undefined) {
      filtered[key] = value;
    }
  });

  return filtered;
};

const parseOptionalDueDate = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const err = new Error('due_date must be a valid date');
    err.status = 400;
    throw err;
  }
  return date;
};

const isProduction = () => process.env.NODE_ENV === 'production';

const isDevLoginAllowed = () => !isProduction() || process.env.ALLOW_DEV_LOGIN === 'true';

module.exports = {
  ROLE_PRIORITY,
  resolvePrimaryRole,
  requireNonemptyTitle,
  clampGrade,
  sanitizeFilename,
  parseSubmissionType,
  filterAnswersForQuiz,
  parseOptionalDueDate,
  isProduction,
  isDevLoginAllowed
};
