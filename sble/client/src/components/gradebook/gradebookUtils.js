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
