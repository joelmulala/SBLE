import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  AssessmentCard,
  AssessmentSectionTitle,
  AssessmentMeta
} from '../assessment/AssessmentPrimitives';
import { Panel, DataTable, EmptyState } from '../ui';
import ui from '../ui/system.module.css';
import {
  SummaryTile,
  ProgressBar,
  GradeStateBadge,
  TrendIndicator,
  FeedbackPanel,
  GradingNavLinks,
  GradeStatePill
} from './GradebookUI';
import { formatScore, formatPercentRatio, formatWhen } from './gradebookUtils';
import s from './GradebookUI.module.css';

export default function StudentDetailPanel({ row, courseId, isLecturer = false }) {
  if (!row) return null;

  if (isLecturer) {
    return <LecturerDetailPanel row={row} courseId={courseId} />;
  }

  return <StudentAssessmentPanels row={row} courseId={courseId} />;
}

function StudentAssessmentPanels({ row, courseId }) {
  const categories = row.categories || {};

  const sections = [
    { title: 'Assignments', items: categories.assignments?.items || [], empty: 'No assignment grades yet.' },
    { title: 'Quizzes', items: categories.quizzes?.items || [], empty: 'No quiz grades yet.' },
    { title: 'Exams', items: categories.exams?.items || [], empty: 'No exam grades recorded yet.', placeholder: true }
  ];

  const hasAnyItems = sections.some((sec) => sec.items.length > 0);

  if (!hasAnyItems) {
    return (
      <EmptyState
        title="No completed assessments"
        message="Assessment results will appear here as they are graded and released."
      />
    );
  }

  return (
    <>
      {sections.map((sec) => (
        <AssessmentTableSection
          key={sec.title}
          title={sec.title}
          items={sec.items}
          emptyMessage={sec.empty}
          placeholder={sec.placeholder}
          courseId={courseId}
        />
      ))}

      <Panel title="Participation">
        <div className={s.metaRows}>
          <div className={s.metaRow}>
            <span>Attendance</span>
            <span>
              {row.summary?.attendancePercent != null
                ? `${row.summary.attendancePercent}% (${categories.attendance?.meta?.sessionsAttended ?? 0}/${categories.attendance?.meta?.totalSessions ?? 0} sessions)`
                : '—'}
            </span>
          </div>
          <div className={s.metaRow}>
            <span>Discussion posts</span>
            <span>{categories.participation?.meta?.discussionPosts ?? 0}</span>
          </div>
        </div>
      </Panel>
    </>
  );
}

function AssessmentTableSection({ title, items, emptyMessage, placeholder, courseId }) {
  const columns = useMemo(() => [
    {
      key: 'title',
      label: 'Assessment',
      render: (item) => (
        <div className={ui.cellStack}>
          <span className={ui.cellPrimary}>{item.title}</span>
          {item.dueDate ? (
            <span className={ui.cellMuted}>Due {formatWhen(item.dueDate)}</span>
          ) : null}
          {item.isLate ? <span className={ui.cellMuted}>Late submission</span> : null}
        </div>
      )
    },
    {
      key: 'status',
      label: 'Status',
      render: (item) => <GradeStatePill state={item.state} />
    },
    {
      key: 'score',
      label: 'Result',
      render: (item) => (
        <span className={item.state === 'released' ? s.tableScoreReleased : s.tableScore}>
          {item.display || '—'}
        </span>
      )
    },
    {
      key: 'feedback',
      label: 'Feedback',
      render: (item) => (
        item.feedback
          ? <span className={s.tableFeedback}>{item.feedback}</span>
          : <span className={ui.cellMuted}>—</span>
      )
    }
  ], []);

  if (!items.length) {
    if (placeholder) {
      return (
        <Panel title={title}>
          <p className={s.panelMuted}>Exam scores appear when recorded by your lecturer.</p>
        </Panel>
      );
    }
    return null;
  }

  return (
    <Panel title={title}>
      <DataTable
        columns={columns}
        rows={items}
        rowKey={(item) => item.id}
        hideToolbar
        emptyMessage={emptyMessage}
      />
    </Panel>
  );
}

function LecturerDetailPanel({ row, courseId }) {
  const summary = row.summary || {};
  const categories = row.categories || {};
  const completionPct = summary.completionRate != null ? summary.completionRate * 100 : 0;

  return (
    <AssessmentCard>
      <AssessmentSectionTitle>
        Student — {row.fullName}
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

      <LecturerCategorySection title="Assignments" items={categories.assignments?.items} courseId={courseId} path="assignments" />
      <LecturerCategorySection title="Quizzes" items={categories.quizzes?.items} courseId={courseId} path="quizzes" />
      <LecturerCategorySection title="Exams" items={categories.exams?.items} courseId={courseId} path="exams" placeholder />

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

      {courseId ? <GradingNavLinks courseId={courseId} /> : null}
    </AssessmentCard>
  );
}

function LecturerCategorySection({ title, items = [], courseId, path, placeholder }) {
  if (!items.length) return null;

  const href = courseId ? `/lecturer/courses/${courseId}/${path}` : null;

  return (
    <div className={s.categoryBlock}>
      <h3 className={s.categoryTitle}>{title}</h3>
      <div className={s.assessmentList}>
        {items.map((item) => (
          <article key={item.id} className={s.assessmentCard}>
            <div className={s.assessmentCardHeader}>
              <h4 className={s.assessmentTitle}>{item.title}</h4>
              <div className={s.assessmentCardAside}>
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
      {href ? (
        <Link to={href} className={s.navLink}>
          Open {title.toLowerCase()}
        </Link>
      ) : null}
    </div>
  );
}
