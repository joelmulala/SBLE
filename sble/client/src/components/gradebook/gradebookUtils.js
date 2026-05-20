export const GRADE_STATE_LABELS = {
  missing: 'Missing',
  ungraded: 'Ungraded',
  graded: 'Graded',
  late: 'Late',
  excused: 'Excused',
  in_progress: 'In progress',
  released: 'Released',
  not_applicable: 'N/A'
};

export const GRADE_STATE_VARIANT = {
  missing: 'neutral',
  ungraded: 'warning',
  graded: 'info',
  late: 'warning',
  excused: 'info',
  in_progress: 'warning',
  released: 'success',
  not_applicable: 'neutral'
};

export function formatScore(value, digits = 1) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return Number(value).toFixed(digits);
}

export function formatPercentRatio(ratio) {
  if (ratio == null || Number.isNaN(Number(ratio))) return '—';
  return `${Math.round(Number(ratio) * 100)}%`;
}

export function letterVariant(status) {
  if (status === 'excellent' || status === 'good') return 'success';
  if (status === 'satisfactory' || status === 'at_risk') return 'warning';
  return 'danger';
}

export function isAtRisk(row) {
  const score = row?.summary?.weightedAverage;
  if (score == null) return false;
  return Number(score) < 50;
}

export function hasMissingWork(row) {
  const assign = row?.categories?.assignments?.items || [];
  const quizzes = row?.categories?.quizzes?.items || [];
  return [...assign, ...quizzes].some((i) => i.state === 'missing');
}

export function countMissingInRow(row) {
  const items = [
    ...(row?.categories?.assignments?.items || []),
    ...(row?.categories?.quizzes?.items || [])
  ];
  return items.filter((i) => i.state === 'missing').length;
}

export function trendLabel(trend) {
  if (trend === 'improving') return 'Improving';
  if (trend === 'declining') return 'Needs attention';
  return 'Stable';
}

export function trendVariant(trend) {
  if (trend === 'improving') return 'success';
  if (trend === 'declining') return 'danger';
  return 'neutral';
}

export function formatWhen(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (_) {
    return '';
  }
}

export function gradingProgressPercent(stats, type = 'assignments') {
  const block = stats?.gradingProgress?.[type];
  if (!block?.total) return 0;
  return Math.min(100, Math.round((block.graded / block.total) * 100));
}

/** Student-facing status labels for StatusPill (single primary status). */
export function getStudentGradeStatusPresentation(state) {
  switch (state) {
    case 'released':
      return { label: 'Graded', variant: 'active' };
    case 'graded':
      return { label: 'Awaiting release', variant: 'info' };
    case 'missing':
      return { label: 'Missing', variant: 'inactive' };
    case 'ungraded':
    case 'in_progress':
      return { label: 'Pending review', variant: 'info' };
    case 'late':
      return { label: 'Late', variant: 'inactive' };
    case 'excused':
      return { label: 'Excused', variant: 'neutral' };
    case 'not_applicable':
      return { label: 'N/A', variant: 'neutral' };
    default:
      return { label: GRADE_STATE_LABELS[state] || state || '—', variant: 'neutral' };
  }
}

export function flattenStudentAssessmentItems(categories = {}) {
  const groups = [
    { category: 'Assignment', items: categories.assignments?.items || [] },
    { category: 'Quiz', items: categories.quizzes?.items || [] },
    { category: 'Exam', items: categories.exams?.items || [] }
  ];
  return groups.flatMap(({ category, items }) =>
    items.map((item) => ({ ...item, category }))
  );
}

/** KPI summary for student gradebook — derived from existing row data only. */
export function computeStudentGradeSummary(row) {
  const summary = row?.summary || {};
  const items = flattenStudentAssessmentItems(row?.categories || {});

  let pendingGrades = 0;
  let completed = 0;
  let missing = 0;

  items.forEach((item) => {
    if (item.state === 'missing') missing += 1;
    else if (item.state === 'released') completed += 1;
    else if (item.state === 'graded') pendingGrades += 1;
    else if (['ungraded', 'in_progress'].includes(item.state)) pendingGrades += 1;
    else if (item.display && item.display !== '—') completed += 1;
  });

  const completionPct = summary.completionRate != null
    ? Math.round(Number(summary.completionRate) * 100)
    : null;

  return {
    currentAverage: summary.weightedAverage != null ? formatScore(summary.weightedAverage) : '—',
    completedAssessments: completed,
    pendingGrades,
    missing,
    completionPercent: completionPct
  };
}
