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

/** Single primary status for student cards (no duplicate badge + grid). */
export function getStudentPrimaryStatus(assignment) {
  const submission = assignment?.mySubmission;
  const state = getAssignmentStudentUiState(assignment);
  const dueTime = assignment?.due_date ? new Date(assignment.due_date).getTime() : null;
  const isPastDue = dueTime ? Date.now() >= dueTime : false;
  const submittedLate = submission?.submitted_at && dueTime
    && new Date(submission.submitted_at).getTime() > dueTime;

  switch (state.phase) {
    case AssignmentStudentPhase.GRADED_PENDING_RELEASE:
      return { label: 'Awaiting feedback', variant: 'info' };
    case AssignmentStudentPhase.GRADED_VISIBLE:
      return { label: 'Graded', variant: 'active' };
    case AssignmentStudentPhase.SUBMITTED_RESUBMIT_ALLOWED:
    case AssignmentStudentPhase.SUBMITTED_LOCKED:
      return {
        label: submittedLate ? 'Submitted (late)' : 'Submitted',
        variant: submittedLate ? 'inactive' : 'info'
      };
    case AssignmentStudentPhase.CLOSED:
      return { label: 'Overdue', variant: 'inactive' };
    case AssignmentStudentPhase.OPEN:
      return { label: isPastDue ? 'Overdue' : 'Pending', variant: isPastDue ? 'inactive' : 'neutral' };
    default:
      return { label: state.label, variant: 'neutral' };
  }
}

function formatDueRelative(dueDate) {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  const now = Date.now();
  const ms = due.getTime() - now;
  if (ms < 0) {
    const days = Math.floor(Math.abs(ms) / 86400000);
    if (days === 0) return 'Past due today';
    if (days === 1) return 'Past due yesterday';
    return `Past due ${days} days ago`;
  }
  const days = Math.floor(ms / 86400000);
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  if (days < 7) return `Due in ${days} days`;
  return `Due ${due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

function formatSubmittedRelative(submittedAt) {
  const ms = Date.now() - new Date(submittedAt).getTime();
  const hours = Math.floor(ms / 3600000);
  if (hours < 1) return 'Submitted just now';
  if (hours < 24) return `Submitted ${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Submitted yesterday';
  if (days < 7) return `Submitted ${days}d ago`;
  return `Submitted ${new Date(submittedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

/** Compact lifecycle/meta strip segments for student assignment cards. */
export function getStudentLifecycleStrip(assignment) {
  const submission = assignment?.mySubmission;
  const parts = [];
  const duePart = formatDueRelative(assignment?.due_date);
  if (duePart) parts.push(duePart);

  if (submission?.grade != null && submission.grading_display !== 'graded_pending_release') {
    parts.push(`Grade released · ${submission.grade}%`);
  } else if (submission?.grading_display === 'graded_pending_release') {
    parts.push('Awaiting grade release');
  } else if (submission?.submitted_at) {
    parts.push(formatSubmittedRelative(submission.submitted_at));
    if (submission.submitted_at && assignment?.due_date
      && new Date(submission.submitted_at).getTime() > new Date(assignment.due_date).getTime()) {
      parts.push('Late submission');
    }
  } else if (assignment?.due_date && Date.now() >= new Date(assignment.due_date).getTime()) {
    parts.push('Not submitted');
  }

  return parts;
}

/** Course-wide student summary from assignment rows (no extra API). */
export function computeStudentAssignmentSummary(assignments = []) {
  let pending = 0;
  let submitted = 0;
  let graded = 0;
  let overdue = 0;

  assignments.forEach((assignment) => {
    const state = getAssignmentStudentUiState(assignment);
    switch (state.phase) {
      case AssignmentStudentPhase.OPEN:
        pending += 1;
        break;
      case AssignmentStudentPhase.CLOSED:
        overdue += 1;
        break;
      case AssignmentStudentPhase.GRADED_VISIBLE:
      case AssignmentStudentPhase.GRADED_PENDING_RELEASE:
        graded += 1;
        break;
      case AssignmentStudentPhase.SUBMITTED_RESUBMIT_ALLOWED:
      case AssignmentStudentPhase.SUBMITTED_LOCKED:
        submitted += 1;
        break;
      default:
        break;
    }
  });

  return { pending, submitted, graded, overdue };
}
