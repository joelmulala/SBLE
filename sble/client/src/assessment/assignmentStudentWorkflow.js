/**
 * Student-side assignment workflow phases (derived from API; no separate assignment draft/publish yet).
 * Use `phase` for logic; `label` / `badgeVariant` for UI.
 */
export const AssignmentStudentPhase = {
  GRADED_PENDING_RELEASE: 'graded_pending_release',
  GRADED_VISIBLE: 'graded_visible',
  SUBMITTED_RESUBMIT_ALLOWED: 'submitted_resubmit_allowed',
  SUBMITTED_LOCKED: 'submitted_locked',
  CLOSED: 'closed',
  OPEN: 'open'
};

/**
 * @param {object} assignment row including optional mySubmission
 * @returns {{
 *   phase: string,
 *   label: string,
 *   badgeVariant: 'neutral'|'info'|'success'|'warning'|'danger',
 *   canUpload: boolean,
 *   canDelete: boolean,
 *   uploadLabel: string
 * }}
 */
export function getAssignmentStudentUiState(assignment) {
  const submission = assignment?.mySubmission;
  const dueTime = assignment?.due_date ? new Date(assignment.due_date).getTime() : null;
  const isPastDue = dueTime ? Date.now() >= dueTime : false;

  if (submission?.id && submission.grading_display === 'graded_pending_release') {
    return {
      phase: AssignmentStudentPhase.GRADED_PENDING_RELEASE,
      label: 'Submitted — results not released yet',
      badgeVariant: 'warning',
      canUpload: false,
      canDelete: false,
      uploadLabel: 'Locked'
    };
  }

  if (submission?.grade !== null && submission?.grade !== undefined) {
    return {
      phase: AssignmentStudentPhase.GRADED_VISIBLE,
      label: `Graded: ${submission.grade}`,
      badgeVariant: 'success',
      canUpload: false,
      canDelete: false,
      uploadLabel: 'Submitted'
    };
  }

  if (submission?.id) {
    const submittedLate = dueTime && submission.submitted_at
      && new Date(submission.submitted_at).getTime() > dueTime;
    return {
      phase: isPastDue ? AssignmentStudentPhase.SUBMITTED_LOCKED : AssignmentStudentPhase.SUBMITTED_RESUBMIT_ALLOWED,
      label: submittedLate ? 'Submitted (late) — awaiting grading' : 'Waiting for grading',
      badgeVariant: submittedLate ? 'warning' : 'info',
      canUpload: !isPastDue,
      canDelete: !isPastDue,
      uploadLabel: isPastDue ? 'Upload closed' : 'Resubmit'
    };
  }

  if (isPastDue) {
    return {
      phase: AssignmentStudentPhase.CLOSED,
      label: 'Submission closed',
      badgeVariant: 'danger',
      canUpload: false,
      canDelete: false,
      uploadLabel: 'Upload closed'
    };
  }

  return {
    phase: AssignmentStudentPhase.OPEN,
    label: 'Ready to submit',
    badgeVariant: 'neutral',
    canUpload: true,
    canDelete: false,
    uploadLabel: 'Upload submission'
  };
}
