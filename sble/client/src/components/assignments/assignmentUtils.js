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
    return { key: 'graded', label: 'Graded', variant: 'active' };
  }
  if (entry.grading_status === 'graded' || entry.grade != null) {
    return { key: 'pending_release', label: 'Draft grade', variant: 'info' };
  }
  if (isLateSubmission(entry, assignment)) {
    return { key: 'late', label: 'Late', variant: 'inactive' };
  }
  return { key: 'pending', label: 'Pending review', variant: 'info' };
}

export function sortSubmissionsForReview(submissions = [], assignment) {
  const priority = { pending: 0, late: 1, pending_release: 2, graded: 3 };
  return [...submissions].sort((a, b) => {
    const pa = priority[getLecturerSubmissionStatus(a, assignment).key] ?? 9;
    const pb = priority[getLecturerSubmissionStatus(b, assignment).key] ?? 9;
    if (pa !== pb) return pa - pb;
    const ta = a.submitted_at ? new Date(a.submitted_at).getTime() : 0;
    const tb = b.submitted_at ? new Date(b.submitted_at).getTime() : 0;
    return tb - ta;
  });
}

export function filterSubmissionsByStatus(submissions = [], assignment, filter) {
  if (!filter || filter === 'all') return submissions;
  return submissions.filter((entry) => {
    const key = getLecturerSubmissionStatus(entry, assignment).key;
    if (filter === 'pending') return key === 'pending' || key === 'late';
    if (filter === 'graded') return key === 'graded' || key === 'pending_release';
    if (filter === 'late') return key === 'late';
    return true;
  });
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
