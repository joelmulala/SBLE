export function isAssignmentOverdue(assignment) {
  if (!assignment?.due_date) return false;
  return Date.now() >= new Date(assignment.due_date).getTime();
}

export function isLateSubmission(submission, assignment) {
  if (!submission?.submitted_at || !assignment?.due_date) return false;
  return new Date(submission.submitted_at).getTime() > new Date(assignment.due_date).getTime();
}

export function formatDueDate(value) {
  if (!value) return 'No due date';
  return new Date(value).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function getLecturerSubmissionStatus(entry, assignment) {
  if (entry.grading_status === 'published') {
    return { key: 'graded', label: 'Graded', variant: 'success' };
  }
  if (entry.grading_status === 'graded' || entry.grade != null) {
    return { key: 'pending_release', label: 'Graded (draft)', variant: 'warning' };
  }
  if (isLateSubmission(entry, assignment)) {
    return { key: 'late', label: 'Late', variant: 'danger' };
  }
  return { key: 'pending', label: 'Pending', variant: 'info' };
}

export function computeAssignmentStats(submissions = []) {
  let graded = 0;
  let pending = 0;
  submissions.forEach((s) => {
    if (s.grading_status === 'published' || s.grading_status === 'graded' || s.grade != null) {
      graded += 1;
    } else {
      pending += 1;
    }
  });
  return {
    total: submissions.length,
    graded,
    pending,
    progress: submissions.length ? Math.round((graded / submissions.length) * 100) : 0
  };
}

export function canPreviewFile(fileName) {
  if (!fileName) return false;
  const lower = fileName.toLowerCase();
  return /\.(pdf|png|jpe?g|gif|webp)$/i.test(lower);
}
