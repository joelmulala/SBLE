const { GRADE_STATES, LETTER_SCALE } = require('./gradeAggregationConfig');

const toRounded = (value, precision = 2) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Number(numeric.toFixed(precision));
};

const submissionGradeReleased = (submission) => {
  if (!submission) return false;
  if (submission.grading_status === GRADE_STATES.EXCUSED) return true;
  if (submission.grading_status === 'published' || submission.results_published_at) return true;
  if (submission.grade != null && (submission.grading_status == null || submission.grading_status === '')) {
    return true;
  }
  return false;
};

const isQuizAttemptComplete = (attempt) => (
  Boolean(attempt?.submitted_at)
  || attempt?.status === 'submitted'
  || attempt?.status === 'expired'
);

function resolveAssignmentGradeState(submission, assignment) {
  if (!submission) {
    return { state: GRADE_STATES.MISSING, score: null, percent: null, visible: false, feedback: null };
  }

  if (submission.grading_status === GRADE_STATES.EXCUSED) {
    return {
      state: GRADE_STATES.EXCUSED,
      score: null,
      percent: null,
      visible: true,
      feedback: submission.feedback || null,
      display: 'Excused'
    };
  }

  const dueAt = assignment?.due_date ? new Date(assignment.due_date).getTime() : null;
  const submittedAt = submission.submitted_at || submission.last_updated_time;
  const submittedTs = submittedAt ? new Date(submittedAt).getTime() : null;
  const isLate = dueAt != null && submittedTs != null && submittedTs > dueAt;

  if (!submissionGradeReleased(submission)) {
    const hasGrade = submission.grade != null && submission.grading_status === 'graded';
    return {
      state: hasGrade ? GRADE_STATES.GRADED : GRADE_STATES.UNGRADED,
      score: null,
      percent: null,
      visible: false,
      feedback: null,
      isLate,
      display: hasGrade ? 'Graded (pending release)' : (isLate ? 'Submitted (late)' : 'Submitted')
    };
  }

  const score = toRounded(submission.grade);
  return {
    state: isLate ? GRADE_STATES.LATE : GRADE_STATES.GRADED,
    score,
    percent: score,
    visible: true,
    feedback: submission.feedback || null,
    isLate,
    display: score != null ? String(score) : '—'
  };
}

function resolveQuizGradeState(attempt, quiz) {
  if (!attempt) {
    return { state: GRADE_STATES.MISSING, score: null, percent: null, visible: false, display: '—' };
  }

  if (!isQuizAttemptComplete(attempt)) {
    return {
      state: GRADE_STATES.IN_PROGRESS,
      score: null,
      percent: null,
      visible: false,
      display: 'In progress'
    };
  }

  const totalMarks = Number(attempt.total_marks) || Number(quiz?.totalMarks) || 0;
  const rawScore = Number(attempt.score) || 0;
  const percent = totalMarks > 0 ? toRounded((rawScore / totalMarks) * 100) : toRounded(rawScore);

  return {
    state: GRADE_STATES.GRADED,
    score: toRounded(rawScore),
    percent,
    maxScore: totalMarks,
    visible: true,
    display: totalMarks > 0 ? `${toRounded(rawScore)}/${totalMarks}` : String(toRounded(rawScore))
  };
}

function resolveExamGradeState(exam, { downloaded = false } = {}) {
  if (!exam?.is_released) {
    return {
      state: GRADE_STATES.UNGRADED,
      score: null,
      percent: null,
      visible: false,
      display: 'Not released',
      placeholder: true
    };
  }

  return {
    state: downloaded ? GRADE_STATES.RELEASED : GRADE_STATES.RELEASED,
    score: null,
    percent: null,
    visible: true,
    display: 'Released',
    placeholder: true,
    note: 'Exam scoring not yet recorded in gradebook'
  };
}

function buildLatestSubmissionMap(submissions = []) {
  const map = new Map();
  submissions.forEach((row) => {
    const key = `${row.student_id}:${row.assignment_id}`;
    const previous = map.get(key);
    const currentTs = new Date(row.last_updated_time || row.submitted_at || 0).getTime();
    const previousTs = previous
      ? new Date(previous.last_updated_time || previous.submitted_at || 0).getTime()
      : -1;
    if (!previous || currentTs >= previousTs) {
      map.set(key, row);
    }
  });
  return map;
}

function buildLatestQuizAttemptMap(attempts = []) {
  const map = new Map();
  attempts.forEach((row) => {
    if (!isQuizAttemptComplete(row)) return;
    const key = `${row.student_id}:${row.quiz_id}`;
    const previous = map.get(key);
    const currentTs = new Date(row.submitted_at || row.started_at || 0).getTime();
    const previousTs = previous
      ? new Date(previous.submitted_at || previous.started_at || 0).getTime()
      : -1;
    if (!previous || currentTs >= previousTs) {
      map.set(key, row);
    }
  });
  return map;
}

function averagePercent(values = []) {
  const nums = values.filter((v) => v != null && Number.isFinite(Number(v))).map(Number);
  if (!nums.length) return null;
  return toRounded(nums.reduce((a, b) => a + b, 0) / nums.length);
}

/**
 * Weighted average across categories that have a computed average.
 * Only gradable categories with data contribute; weights re-normalize.
 */
function computeWeightedTotal(categoryScores = {}) {
  const entries = Object.entries(categoryScores).filter(([, v]) => v?.average != null && v?.weight > 0);
  if (!entries.length) {
    return { weightedAverage: null, activeWeight: 0, breakdown: categoryScores };
  }

  const activeWeight = entries.reduce((sum, [, v]) => sum + v.weight, 0);
  const weightedSum = entries.reduce((sum, [, v]) => sum + (v.average * v.weight), 0);
  const weightedAverage = activeWeight > 0 ? toRounded(weightedSum / activeWeight) : null;

  return { weightedAverage, activeWeight: toRounded(activeWeight, 4), breakdown: categoryScores };
}

function classifyLetterGrade(score) {
  const value = Number(score);
  if (!Number.isFinite(value)) return { letter: null, status: null };
  const band = LETTER_SCALE.find((b) => value >= b.min);
  return band ? { letter: band.letter, status: band.status } : { letter: 'F', status: 'failing' };
}

function computeCompletionRate({ requiredItems = 0, completedItems = 0 }) {
  if (requiredItems <= 0) return 1;
  return toRounded(completedItems / requiredItems, 4);
}

function countGradeStates(cells = []) {
  return cells.reduce((acc, cell) => {
    const key = cell?.state || GRADE_STATES.MISSING;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function getTrend(scoredEvents = []) {
  if (!Array.isArray(scoredEvents) || scoredEvents.length < 2) return 'stable';

  const sorted = [...scoredEvents]
    .filter((event) => Number.isFinite(event?.score) && event?.timestamp)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  if (sorted.length < 2) return 'stable';

  const windowed = sorted.slice(-3);
  const first = Number(windowed[0].score) || 0;
  const last = Number(windowed[windowed.length - 1].score) || 0;
  const delta = last - first;

  if (delta >= 5) return 'improving';
  if (delta <= -5) return 'declining';
  return 'stable';
}

module.exports = {
  GRADE_STATES,
  toRounded,
  submissionGradeReleased,
  isQuizAttemptComplete,
  resolveAssignmentGradeState,
  resolveQuizGradeState,
  resolveExamGradeState,
  buildLatestSubmissionMap,
  buildLatestQuizAttemptMap,
  averagePercent,
  computeWeightedTotal,
  classifyLetterGrade,
  computeCompletionRate,
  countGradeStates,
  getTrend
};
