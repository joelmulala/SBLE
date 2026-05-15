/**
 * Shared assessment availability windows for routes and calendar aggregation.
 */
const { getQuizWindow } = require('../assessment/quizAssessmentService');

const parseOptionalDate = (value, fieldName) => {
  if (value === undefined || value === null || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    const err = new Error(`${fieldName} must be a valid date/time`);
    err.status = 400;
    throw err;
  }
  return date;
};

const resolveDurationMinutes = (value, fallback = 120) => {
  const parsed = Number.parseInt(value ?? fallback, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    const err = new Error('duration_minutes must be a positive integer');
    err.status = 400;
    throw err;
  }
  return parsed;
};

const getExamWindow = (exam, overrides = {}, { defaultStartNow = false } = {}) => {
  const startTime = parseOptionalDate(
    overrides.start_time ?? overrides.scheduled_at ?? exam?.scheduled_at ?? (defaultStartNow ? new Date() : null),
    'start_time'
  );
  const requestedEndTime = parseOptionalDate(overrides.end_time ?? null, 'end_time');
  const explicitDuration = overrides.duration_minutes;

  if (requestedEndTime && !startTime) {
    const err = new Error('start_time is required when end_time is provided');
    err.status = 400;
    throw err;
  }

  let durationMinutes = resolveDurationMinutes(explicitDuration ?? exam?.duration_minutes ?? 120, 120);

  if (startTime && requestedEndTime) {
    if (requestedEndTime.getTime() <= startTime.getTime()) {
      const err = new Error('end_time must be later than start_time');
      err.status = 400;
      throw err;
    }
    if (explicitDuration === undefined || explicitDuration === null || explicitDuration === '') {
      durationMinutes = Math.max(1, Math.ceil((requestedEndTime.getTime() - startTime.getTime()) / 60000));
    }
  }

  const endTime = requestedEndTime || (startTime ? new Date(startTime.getTime() + durationMinutes * 60000) : null);
  return { startTime, endTime, durationMinutes };
};

module.exports = {
  getQuizWindow,
  getExamWindow
};
