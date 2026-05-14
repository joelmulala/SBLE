/**
 * Strip unreleased grades before returning submissions to students.
 */
function maskSubmissionForStudentView(sub) {
  if (!sub) return null;
  const row = typeof sub.toJSON === 'function' ? sub.toJSON() : { ...sub };
  const legacyGraded = row.grade != null && (row.grading_status == null || row.grading_status === '');
  const visible = row.grading_status === 'published'
    || Boolean(row.results_published_at)
    || legacyGraded;

  if (!visible) {
    row.grade = null;
    row.feedback = null;
    row.grading_display = row.grading_status === 'graded' ? 'graded_pending_release' : 'submitted';
  } else {
    row.grading_display = 'published';
  }

  return row;
}

function submissionLocksStudentEdits(sub) {
  if (!sub) return false;
  if (sub.grading_status === 'graded' || sub.grading_status === 'published') return true;
  if (sub.grade != null && (sub.grading_status == null || sub.grading_status === '')) return true;
  return false;
}

module.exports = { maskSubmissionForStudentView, submissionLocksStudentEdits };
