/**
 * Student quiz workflow (list + availability probe from course quizzes page).
 * Attempt lifecycle fields come from API (myAttempt, is_published, window, availability).
 */
export const QuizStudentPhase = {
  SUBMITTED: 'submitted',
  DRAFT_UNPUBLISHED: 'draft_unpublished',
  CHECKING: 'checking',
  UNAVAILABLE: 'unavailable',
  SCHEDULED: 'scheduled',
  CLOSED: 'closed',
  IN_PROGRESS: 'in_progress',
  AVAILABLE: 'available'
};

export function formatSeconds(total) {
  const t = Math.max(0, Number(total) || 0);
  const m = Math.floor(t / 60);
  const sec = t % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

/**
 * @param {object} quiz
 * @param {{ canStart?: boolean, label?: string, questionCount?: number }|null|undefined} availability
 */
export function getStudentQuizUiState(quiz, availability) {
  const attempt = quiz?.myAttempt;

  if (attempt?.submitted_at) {
    return {
      phase: QuizStudentPhase.SUBMITTED,
      label: Number.isFinite(Number(attempt.score)) ? `Already attempted · score ${Number(attempt.score)}` : 'Already attempted',
      canStart: false,
      badgeVariant: 'success',
      buttonLabel: 'Attempt used'
    };
  }

  if (!quiz.is_published) {
    return {
      phase: QuizStudentPhase.DRAFT_UNPUBLISHED,
      label: 'Not published yet',
      canStart: false,
      badgeVariant: 'neutral',
      buttonLabel: 'Unavailable'
    };
  }

  if (!availability) {
    return {
      phase: QuizStudentPhase.CHECKING,
      label: 'Checking availability…',
      canStart: false,
      badgeVariant: 'neutral',
      buttonLabel: 'Checking…'
    };
  }

  if (availability.canStart === false) {
    return {
      phase: QuizStudentPhase.UNAVAILABLE,
      label: availability.label || 'Not available',
      canStart: false,
      badgeVariant: 'warning',
      buttonLabel: 'Unavailable'
    };
  }

  const now = Date.now();
  const startTime = quiz.start_time ? new Date(quiz.start_time).getTime() : null;
  const endTime = quiz.end_time ? new Date(quiz.end_time).getTime() : null;

  if (startTime && now < startTime) {
    return {
      phase: QuizStudentPhase.SCHEDULED,
      label: `Starts ${new Date(startTime).toLocaleString()}`,
      canStart: false,
      badgeVariant: 'warning',
      buttonLabel: 'Unavailable'
    };
  }

  if (endTime && now >= endTime) {
    return {
      phase: QuizStudentPhase.CLOSED,
      label: 'Quiz closed',
      canStart: false,
      badgeVariant: 'danger',
      buttonLabel: 'Unavailable'
    };
  }

  if (attempt?.id) {
    return {
      phase: QuizStudentPhase.IN_PROGRESS,
      label: 'Attempt in progress',
      canStart: true,
      badgeVariant: 'info',
      buttonLabel: 'Resume quiz'
    };
  }

  return {
    phase: QuizStudentPhase.AVAILABLE,
    label: 'Available',
    canStart: true,
    badgeVariant: 'success',
    buttonLabel: 'Start quiz'
  };
}

/** Student assignments hub — no per-quiz availability probe; uses window + attempt only. */
export function getQuizHubStudentSnapshot(quiz) {
  if (quiz?.myAttempt?.submitted_at) {
    return {
      phase: QuizStudentPhase.SUBMITTED,
      label: Number.isFinite(Number(quiz.myAttempt.score)) ? `Attempt used · score ${Number(quiz.myAttempt.score)}` : 'Attempt used',
      badgeVariant: 'success'
    };
  }

  const now = Date.now();
  const startTime = quiz?.start_time ? new Date(quiz.start_time).getTime() : null;
  const endTime = quiz?.end_time ? new Date(quiz.end_time).getTime() : null;

  if (startTime && now < startTime) {
    return { phase: QuizStudentPhase.SCHEDULED, label: `Opens ${new Date(startTime).toLocaleString()}`, badgeVariant: 'warning' };
  }
  if (endTime && now >= endTime) {
    return { phase: QuizStudentPhase.CLOSED, label: 'Closed', badgeVariant: 'danger' };
  }
  return { phase: QuizStudentPhase.AVAILABLE, label: 'Available', badgeVariant: 'info' };
}
