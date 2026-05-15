import React from 'react';
import { Link } from 'react-router-dom';
import { StatusBadge } from '../assessment/AssessmentPrimitives';
import {
  GRADE_STATE_LABELS,
  GRADE_STATE_VARIANT,
  formatScore,
  letterVariant,
  trendLabel,
  trendVariant
} from './gradebookUtils';
import s from './GradebookUI.module.css';

export function ProgressBar({ value = 0, label, hint, tone = 'brand' }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  const fillClass = tone === 'success' ? s.progressFillSuccess
    : tone === 'warn' ? s.progressFillWarn
      : tone === 'danger' ? s.progressFillDanger
        : s.progressFill;

  return (
    <div className={s.progressBlock}>
      {(label || hint) ? (
        <div className={s.progressLabel}>
          <span>{label}</span>
          <span>{hint}</span>
        </div>
      ) : null}
      <div className={s.progressTrack} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className={fillClass} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function GradeStateBadge({ state, compact = false }) {
  const variant = GRADE_STATE_VARIANT[state] || 'neutral';
  const label = GRADE_STATE_LABELS[state] || state;
  return (
    <StatusBadge variant={variant}>
      {compact ? label.slice(0, 1) : label}
    </StatusBadge>
  );
}

export function LetterGrade({ letter, status }) {
  if (!letter) return <span className={s.cellMuted}>—</span>;
  const cls = letterVariant(status) === 'success' ? s.letterSuccess
    : letterVariant(status) === 'warning' ? s.letterWarn
      : s.letterDanger;
  return <span className={`${s.letterBadge} ${cls}`}>{letter}</span>;
}

export function TrendIndicator({ trend }) {
  return (
    <StatusBadge variant={trendVariant(trend)}>
      {trendLabel(trend)}
    </StatusBadge>
  );
}

export function SummaryTile({ label, value, hint, children }) {
  return (
    <div className={s.summaryTile}>
      <p className={s.summaryTileLabel}>{label}</p>
      <div className={s.summaryTileValue}>{value}</div>
      {hint ? <p className={s.summaryTileHint}>{hint}</p> : null}
      {children}
    </div>
  );
}

export function GradeCellDisplay({ cell }) {
  if (!cell) return <span className={s.cellMuted}>—</span>;

  const isMissing = cell.state === 'missing';
  const isPending = ['ungraded', 'in_progress', 'graded'].includes(cell.state)
    && !cell.score && cell.percent == null;

  return (
    <div className={s.gradeCell}>
      <GradeStateBadge state={cell.state} compact />
      <span className={isMissing ? s.cellMuted : s.cellScore}>
        {isPending ? '—' : (cell.display || '—')}
      </span>
    </div>
  );
}

export function GradingNavLinks({ courseId, rolePrefix = 'lecturer' }) {
  const base = `/${rolePrefix}/courses/${courseId}`;
  return (
    <nav className={s.navLinks} aria-label="Grading shortcuts">
      <Link to={`${base}/assignments`} className={s.navLink}>Grade assignments</Link>
      <Link to={`${base}/quizzes`} className={s.navLink}>Manage quizzes</Link>
      <Link to={`${base}/exams`} className={s.navLink}>Exams</Link>
    </nav>
  );
}

export function FeedbackPanel({ children }) {
  if (!children) return null;
  return (
    <div className={s.feedbackPanel}>
      <strong style={{ display: 'block', marginBottom: '0.35rem', fontSize: 'var(--fs-00)' }}>
        Instructor feedback
      </strong>
      {children}
    </div>
  );
}
