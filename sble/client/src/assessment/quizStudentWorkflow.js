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

/** Single primary status label for student quiz list cards. */
export function getStudentQuizPrimaryStatus(quiz, availability) {
  const state = getStudentQuizUiState(quiz, availability);
  const score = quiz?.myAttempt?.score;

  switch (state.phase) {
    case QuizStudentPhase.SUBMITTED:
      return {
        label: Number.isFinite(Number(score)) ? 'Graded' : 'Submitted',
        variant: Number.isFinite(Number(score)) ? 'active' : 'info'
      };
    case QuizStudentPhase.IN_PROGRESS:
      return { label: 'In progress', variant: 'info' };
    case QuizStudentPhase.AVAILABLE:
      return { label: 'Available now', variant: 'active' };
    case QuizStudentPhase.SCHEDULED:
      return { label: 'Upcoming', variant: 'inactive' };
    case QuizStudentPhase.CLOSED:
      return { label: 'Closed', variant: 'inactive' };
    case QuizStudentPhase.CHECKING:
      return { label: 'Checking…', variant: 'neutral' };
    case QuizStudentPhase.UNAVAILABLE:
      return { label: 'Unavailable', variant: 'inactive' };
    case QuizStudentPhase.DRAFT_UNPUBLISHED:
      return { label: 'Unavailable', variant: 'inactive' };
    default:
      return { label: state.label, variant: 'neutral' };
  }
}

function formatOpensRelative(startTime) {
  const ms = startTime - Date.now();
  if (ms <= 0) return null;
  const hours = Math.floor(ms / 3600000);
  const days = Math.floor(ms / 86400000);
  if (hours < 1) return 'Opens soon';
  if (hours < 24) return `Opens in ${hours}h`;
  if (days === 1) return 'Opens tomorrow';
  if (days < 7) return `Opens in ${days} days`;
  return `Opens ${new Date(startTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

function formatClosesRelative(endTime) {
  const ms = endTime - Date.now();
  if (ms <= 0) return 'Window closed';
  const hours = Math.floor(ms / 3600000);
  const days = Math.floor(ms / 86400000);
  if (hours < 1) return 'Closes in under 1h';
  if (hours < 24) return `Closes in ${hours}h`;
  if (days === 1) return 'Closes tomorrow';
  if (days < 7) return `Closes in ${days} days`;
  return `Closes ${new Date(endTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

/** Compact meta strip for student quiz cards. */
export function getStudentQuizMetaStrip(quiz, availability) {
  const parts = [];
  const mins = Number(quiz?.time_limit_minutes);
  if (Number.isFinite(mins) && mins > 0) {
    parts.push({ text: `${mins} min`, emphasis: true });
  }

  const qCount = availability?.questionCount;
  if (Number.isFinite(qCount) && qCount > 0) {
    parts.push({ text: `${qCount} question${qCount === 1 ? '' : 's'}`, emphasis: false });
  }

  const now = Date.now();
  const startTime = quiz?.start_time ? new Date(quiz.start_time).getTime() : null;
  const endTime = quiz?.end_time ? new Date(quiz.end_time).getTime() : null;

  if (startTime && now < startTime) {
    const opens = formatOpensRelative(startTime);
    if (opens) parts.push({ text: opens, emphasis: false });
  } else if (endTime && now < endTime) {
    const closes = formatClosesRelative(endTime);
    if (closes) parts.push({ text: closes, emphasis: false });
  } else if (endTime && now >= endTime) {
    parts.push({ text: 'Window closed', emphasis: false });
  }

  const attempt = quiz?.myAttempt;
  if (attempt?.submitted_at) {
    parts.push({
      text: Number.isFinite(Number(attempt.score))
        ? `Score ${Number(attempt.score)}% · attempt submitted`
        : 'Attempt submitted',
      emphasis: false
    });
  } else if (attempt?.id) {
    parts.push({ text: 'Attempt in progress', emphasis: false });
  } else if (quiz?.is_published) {
    parts.push({ text: 'One attempt', emphasis: false });
  }

  return parts;
}

/** Primary CTA for student quiz list — presentation only; uses existing openQuiz handler. */
export function getStudentQuizPrimaryAction(quiz, availability) {
  const state = getStudentQuizUiState(quiz, availability);
  if (state.phase === QuizStudentPhase.SUBMITTED) {
    return {
      label: Number.isFinite(Number(quiz?.myAttempt?.score)) ? 'View results' : 'View attempt',
      disabled: false,
      variant: 'primary'
    };
  }
  if (state.phase === QuizStudentPhase.IN_PROGRESS) {
    return { label: 'Continue attempt', disabled: !state.canStart, variant: 'primary' };
  }
  if (state.phase === QuizStudentPhase.AVAILABLE) {
    return { label: 'Start quiz', disabled: !state.canStart, variant: 'primary' };
  }
  return {
    label: state.buttonLabel,
    disabled: !state.canStart,
    variant: state.phase === QuizStudentPhase.CLOSED || state.phase === QuizStudentPhase.SCHEDULED
      ? 'ghost'
      : 'primary'
  };
}

/** Course-wide student summary from loaded quizzes + availability map. */
export function computeStudentQuizSummary(quizzes = [], availabilityById = {}) {
  let available = 0;
  let upcoming = 0;
  let submitted = 0;
  let graded = 0;

  quizzes.forEach((quiz) => {
    const state = getStudentQuizUiState(quiz, availabilityById[quiz.id]);
    switch (state.phase) {
      case QuizStudentPhase.AVAILABLE:
      case QuizStudentPhase.IN_PROGRESS:
        available += 1;
        break;
      case QuizStudentPhase.SCHEDULED:
      case QuizStudentPhase.CHECKING:
        upcoming += 1;
        break;
      case QuizStudentPhase.SUBMITTED:
        if (Number.isFinite(Number(quiz?.myAttempt?.score))) graded += 1;
        else submitted += 1;
        break;
      default:
        break;
    }
  });

  return { available, upcoming, submitted, graded };
}
