/**
 * Quiz scheduling window (availability) + per-attempt expiry + auto-grading.
 * Used by quiz routes and the quiz timer job.
 */

const { QuizAttempt } = require('../../models');
const { parseDbDate } = require('../../utils/datetime');

const parseOptionalDate = (value, fieldName) => {
  if (value === undefined || value === null || value === '') return null;
  return parseDbDate(value, fieldName);
};

const resolveDurationMinutes = (value, fallback = 30) => {
  const parsed = Number.parseInt(value ?? fallback, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    const err = new Error('duration_minutes must be a positive integer');
    err.status = 400;
    throw err;
  }
  return parsed;
};

const getQuizWindow = (quiz, overrides = {}) => {
  const startTime = parseOptionalDate(
    overrides.start_time ?? overrides.scheduled_at ?? quiz?.created_at ?? null,
    'start_time'
  );
  const requestedEndTime = parseOptionalDate(overrides.end_time ?? null, 'end_time');
  const explicitDuration = overrides.duration_minutes ?? overrides.time_limit_minutes;

  if (requestedEndTime && !startTime) {
    const err = new Error('start_time is required when end_time is provided');
    err.status = 400;
    throw err;
  }

  let durationMinutes = resolveDurationMinutes(
    explicitDuration ?? quiz?.time_limit_minutes ?? 30,
    30
  );

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

const ensureQuizWindowOpen = (quiz) => {
  const { startTime, endTime } = getQuizWindow(quiz);
  const now = Date.now();

  if (startTime && now < startTime.getTime()) {
    const err = new Error('Quiz has not started yet');
    err.status = 403;
    throw err;
  }

  if (endTime && now >= endTime.getTime()) {
    const err = new Error('Quiz is no longer available');
    err.status = 403;
    throw err;
  }
};

const normalizeAnswerValue = (value) => String(value ?? '').trim().toLowerCase();

const gradeQuizAttempt = (quiz, answers = {}) => {
  let score = 0;
  let totalMarks = 0;
  const correctAnswers = [];
  const feedback = [];

  quiz.QuizQuestions?.forEach((question, index) => {
    const marks = Number(question.marks) || 1;
    const submittedAnswer = answers?.[question.id] ?? '';
    const submittedValue = typeof submittedAnswer === 'string' ? submittedAnswer.trim() : submittedAnswer;
    const correctAnswer = question.correct_answer ?? '';
    const isCorrect = normalizeAnswerValue(submittedValue) !== ''
      && normalizeAnswerValue(submittedValue) === normalizeAnswerValue(correctAnswer);

    totalMarks += marks;
    if (isCorrect) {
      score += marks;
    }

    correctAnswers.push({
      question_id: question.id,
      question_text: question.question_text,
      submitted_answer: submittedValue,
      correct_answer: correctAnswer,
      is_correct: isCorrect,
      marks_awarded: isCorrect ? marks : 0,
      marks_possible: marks
    });

    feedback.push({
      question_id: question.id,
      question_number: index + 1,
      status: isCorrect ? 'correct' : 'incorrect',
      message: isCorrect
        ? `Question ${index + 1}: Correct`
        : `Question ${index + 1}: Incorrect. Correct answer: ${correctAnswer || 'Not provided'}`
    });
  });

  return { score, totalMarks, correctAnswers, feedback };
};

const getAttemptExpiry = (attempt, quiz) => {
  const started = new Date(attempt.started_at || Date.now());
  const { durationMinutes, endTime } = getQuizWindow(quiz);
  const durationExpiry = new Date(started.getTime() + durationMinutes * 60000);

  let candidate = durationExpiry;
  if (endTime && endTime.getTime() > started.getTime()) {
    candidate = new Date(Math.min(durationExpiry.getTime(), endTime.getTime()));
  }

  if (attempt?.expires_at) {
    const stored = new Date(attempt.expires_at);
    if (stored.getTime() > started.getTime()) {
      return new Date(Math.min(candidate.getTime(), stored.getTime()));
    }
  }

  return candidate;
};

const computeExpiresAtForAttempt = (quiz, startedAt) => {
  const start = startedAt instanceof Date ? startedAt : new Date(startedAt);
  const { durationMinutes } = getQuizWindow(quiz);
  const durationExpiry = new Date(start.getTime() + durationMinutes * 60000);
  const { endTime } = getQuizWindow(quiz);

  if (endTime && endTime.getTime() > start.getTime()) {
    return new Date(Math.min(durationExpiry.getTime(), endTime.getTime()));
  }

  return durationExpiry;
};

const isAttemptTimeExpired = (attempt, quiz) => Date.now() >= getAttemptExpiry(attempt, quiz).getTime();

const finalizeAttempt = async (attempt, quiz, answers = attempt.answers || {}) => {
  if (attempt.submitted_at) {
    const grading = gradeQuizAttempt(quiz, attempt.answers || answers);
    return { grading, status: attempt.status || 'submitted', alreadyFinalized: true };
  }

  const grading = gradeQuizAttempt(quiz, answers);
  const expiredByClock = isAttemptTimeExpired(attempt, quiz);
  const status = expiredByClock ? 'expired' : 'submitted';
  const submittedAt = new Date();
  const expiresAt = attempt.expires_at || computeExpiresAtForAttempt(quiz, attempt.started_at);

  const [updatedCount] = await QuizAttempt.update({
    answers,
    score: grading.score,
    submitted_at: submittedAt,
    status,
    expires_at: expiresAt
  }, {
    where: { id: attempt.id, submitted_at: null }
  });

  if (updatedCount === 0) {
    await attempt.reload();
    const existingGrading = gradeQuizAttempt(quiz, attempt.answers || answers);
    return {
      grading: existingGrading,
      status: attempt.status || 'submitted',
      alreadyFinalized: true
    };
  }

  await attempt.reload();
  return { grading, status };
};

module.exports = {
  getQuizWindow,
  ensureQuizWindowOpen,
  gradeQuizAttempt,
  getAttemptExpiry,
  computeExpiresAtForAttempt,
  isAttemptTimeExpired,
  finalizeAttempt
};
