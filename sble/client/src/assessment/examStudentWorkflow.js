export const ExamStudentPhase = {
  NOT_RELEASED: 'not_released',
  UPCOMING: 'upcoming',
  ACTIVE: 'active',
  SUBMITTED: 'submitted',
  ENDED: 'ended',
  LOCKED: 'locked'
};

export function getStudentExamUiState(exam) {
  if (!exam.is_released) {
    return {
      phase: ExamStudentPhase.NOT_RELEASED,
      label: 'Not released',
      badgeVariant: 'neutral',
      canDownload: false,
      buttonLabel: 'Unavailable'
    };
  }

  const status = exam.window_status || 'open';
  const accessed = Boolean(exam.myAccess?.accessed_at);

  if (accessed) {
    return {
      phase: ExamStudentPhase.SUBMITTED,
      label: 'Exam paper accessed',
      badgeVariant: 'success',
      canDownload: status === 'open',
      buttonLabel: status === 'open' ? 'Download again' : 'Completed'
    };
  }

  if (status === 'upcoming') {
    return {
      phase: ExamStudentPhase.UPCOMING,
      label: exam.start_time ? `Opens ${new Date(exam.start_time).toLocaleString()}` : 'Scheduled',
      badgeVariant: 'warning',
      canDownload: false,
      buttonLabel: 'Not yet open'
    };
  }

  if (status === 'ended') {
    return {
      phase: ExamStudentPhase.ENDED,
      label: 'Exam window closed',
      badgeVariant: 'danger',
      canDownload: false,
      buttonLabel: 'Closed'
    };
  }

  return {
    phase: ExamStudentPhase.ACTIVE,
    label: 'Available now',
    badgeVariant: 'info',
    canDownload: true,
    buttonLabel: 'Download exam paper'
  };
}

export function computeExamParticipation(accessList = [], enrolledCount = 0) {
  const completed = accessList.length;
  const total = enrolledCount || completed;
  const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { completed, total, rate };
}
