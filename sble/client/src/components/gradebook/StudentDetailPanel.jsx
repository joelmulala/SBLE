import React from 'react';
import { Link } from 'react-router-dom';
import {
  AssessmentCard,
  AssessmentSectionTitle,
  AssessmentMeta
} from '../assessment/AssessmentPrimitives';
import {
  SummaryTile,
  ProgressBar,
  GradeStateBadge,
  TrendIndicator,
  FeedbackPanel,
  GradingNavLinks
} from './GradebookUI';
import { formatScore, formatPercentRatio, formatWhen } from './gradebookUtils';
import s from './GradebookUI.module.css';

export default function StudentDetailPanel({ row, courseId, isLecturer = false }) {
  if (!row) return null;

  const summary = row.summary || {};
  const categories = row.categories || {};
  const completionPct = summary.completionRate != null ? summary.completionRate * 100 : 0;

  return (
    <AssessmentCard>
      <AssessmentSectionTitle>
        {isLecturer ? `Student — ${row.fullName}` : 'Assessment breakdown'}
      </AssessmentSectionTitle>

      <div className={s.summaryGrid}>
        <SummaryTile label="Overall" value={`${formatScore(summary.weightedAverage)}%`} />
        <SummaryTile label="Assignments" value={formatScore(summary.assignmentAvg)} />
        <SummaryTile label="Quizzes" value={formatScore(summary.quizAvg)} />
        <SummaryTile label="Trend" value={summary.trend || 'stable'} />
      </div>

      <ProgressBar
        label="Completion"
        hint={formatPercentRatio(summary.completionRate)}
        value={completionPct}
        tone={completionPct >= 80 ? 'success' : completionPct >= 50 ? 'warn' : 'danger'}
      />

      <CategorySection title="Assignments" items={categories.assignments?.items} courseId={courseId} isLecturer={isLecturer} path="assignments" />
      <CategorySection title="Quizzes" items={categories.quizzes?.items} courseId={courseId} isLecturer={isLecturer} path="quizzes" />
      <CategorySection title="Exams" items={categories.exams?.items} courseId={courseId} isLecturer={isLecturer} path="exams" placeholder />

      <div className={s.placeholderRow}>
        <span>Attendance</span>
        <span>
          {summary.attendancePercent != null
            ? `${summary.attendancePercent}% (${categories.attendance?.meta?.sessionsAttended ?? 0}/${categories.attendance?.meta?.totalSessions ?? 0} sessions)`
            : '—'}
        </span>
      </div>
      <div className={s.placeholderRow}>
        <span>Participation</span>
        <span>{categories.participation?.meta?.discussionPosts ?? 0} discussion posts</span>
      </div>

      {isLecturer && courseId ? <GradingNavLinks courseId={courseId} /> : null}
    </AssessmentCard>
  );
}

function CategorySection({ title, items = [], courseId, isLecturer, path, placeholder }) {
  if (!items.length) return null;

  const prefix = isLecturer ? 'lecturer' : 'student';
  const href = courseId ? `/${prefix}/courses/${courseId}/${path}` : null;

  return (
    <div className={s.categoryBlock} style={{ marginTop: 'var(--space-5)' }}>
      <h3 className={s.categoryTitle}>{title}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {items.map((item) => (
          <article key={item.id} className={s.assessmentCard}>
            <div className={s.assessmentCardHeader}>
              <h4 className={s.assessmentTitle}>{item.title}</h4>
              <div style={{ textAlign: 'right' }}>
                <GradeStateBadge state={item.state} />
                <div className={s.cellScore}>{item.display || '—'}</div>
              </div>
            </div>
            {item.isLate ? <AssessmentMeta>Late submission</AssessmentMeta> : null}
            {item.dueDate ? <AssessmentMeta>Due {formatWhen(item.dueDate)}</AssessmentMeta> : null}
            <FeedbackPanel>{item.feedback}</FeedbackPanel>
          </article>
        ))}
      </div>
      {placeholder ? <AssessmentMeta>Exam scores appear when recorded by your lecturer.</AssessmentMeta> : null}
      {href && isLecturer ? (
        <Link to={href} className={s.navLink} style={{ marginTop: 'var(--space-3)', display: 'inline-block' }}>
          Open {title.toLowerCase()}
        </Link>
      ) : null}
    </div>
  );
}
