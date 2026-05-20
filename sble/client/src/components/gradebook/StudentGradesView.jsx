import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  PageActions,
  Panel,
  FilterSelect,
  KpiStatGrid,
  StatCard,
  LoadingState,
  EmptyState
} from '../ui';
import StatusPill from '../ui/StatusPill';
import {
  ProgressBar,
  LetterGrade,
  TrendIndicator
} from './GradebookUI';
import StudentDetailPanel from './StudentDetailPanel';
import {
  formatScore,
  formatPercentRatio,
  computeStudentGradeSummary
} from './gradebookUtils';
import s from './GradebookUI.module.css';

export default function StudentGradesView({
  overview,
  courseDetail,
  courseOptions,
  selectedCourseId,
  onCourseChange,
  routeCourseId,
  loading
}) {
  const row = courseDetail?.rows?.[0];
  const courseTitle = courseDetail?.course?.title;
  const courseId = courseDetail?.course?.id || selectedCourseId;

  const kpi = useMemo(() => (row ? computeStudentGradeSummary(row) : null), [row]);

  if (!routeCourseId && !selectedCourseId && overview?.courses?.length > 1) {
    return <CourseOverviewPanel courses={overview.courses} onSelect={onCourseChange} />;
  }

  if (loading && !courseDetail) {
    return <LoadingState label="Loading your grades…" />;
  }

  if (!row) {
    return (
      <EmptyState
        title="No grades released yet"
        message="Grades and feedback will appear here once your lecturer publishes results for this course."
      />
    );
  }

  return (
    <>
      {!routeCourseId && courseOptions.length > 1 ? (
        <PageActions
          filters={(
            <FilterSelect
              value={selectedCourseId}
              onChange={(e) => onCourseChange(e.target.value)}
              className={s.courseFilter}
              aria-label="Select course"
            >
              {courseOptions.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </FilterSelect>
          )}
        />
      ) : null}

      {kpi ? (
        <KpiStatGrid>
          <StatCard
            label="Current average"
            value={kpi.currentAverage === '—' ? '—' : `${kpi.currentAverage}%`}
            hint="Weighted course average"
          />
          <StatCard label="Completed" value={kpi.completedAssessments} hint="Released results" />
          <StatCard label="Pending grades" value={kpi.pendingGrades} hint="Awaiting release or review" />
          <StatCard
            label="Completion"
            value={kpi.completionPercent != null ? `${kpi.completionPercent}%` : '—'}
            hint="Assessments completed"
          />
        </KpiStatGrid>
      ) : null}

      <Panel title={courseTitle || 'Course grades'}>
        <StudentGradesHero row={row} courseId={courseId} />
      </Panel>

      <StudentDetailPanel row={row} courseId={courseId} isLecturer={false} />
    </>
  );
}

function CourseOverviewPanel({ courses, onSelect }) {
  return (
    <Panel title="Your courses" lead="Select a course to view grades, feedback, and progress.">
      <div className={s.courseCards}>
        {courses.map((c) => (
          <button
            key={c.courseId}
            type="button"
            className={s.courseCard}
            onClick={() => onSelect(String(c.courseId))}
          >
            <h3 className={s.courseCardTitle}>{c.courseTitle}</h3>
            {c.summary?.weightedAverage != null ? (
              <>
                <p className={s.courseCardScore}>{formatScore(c.summary.weightedAverage)}%</p>
                {c.summary.letter ? (
                  <p className={s.courseCardLetter}>Grade {c.summary.letter}</p>
                ) : null}
                <ProgressBar
                  value={(c.summary.completionRate || 0) * 100}
                  label="Completion"
                  hint={formatPercentRatio(c.summary.completionRate)}
                />
              </>
            ) : (
              <p className={s.courseCardMuted}>No scores recorded yet</p>
            )}
          </button>
        ))}
      </div>
    </Panel>
  );
}

function StudentGradesHero({ row, courseId }) {
  const summary = row.summary || {};
  const completionPct = summary.completionRate != null ? summary.completionRate * 100 : 0;
  const passState = summary.weightedAverage != null && Number(summary.weightedAverage) >= 50;

  return (
    <div className={s.studentHero}>
      <div className={s.studentHeroMain}>
        <LetterGrade letter={summary.letter} status={summary.status} />
        <div className={s.studentHeroStats}>
          <p className={s.studentHeroScore}>
            {formatScore(summary.weightedAverage)}
            {summary.weightedAverage != null ? '%' : ''}
          </p>
          <p className={s.studentHeroLabel}>Weighted course average</p>
          <div className={s.studentHeroMeta}>
            <TrendIndicator trend={summary.trend} />
            {summary.weightedAverage != null ? (
              <StatusPill variant={passState ? 'active' : 'inactive'}>
                {passState ? 'Passing' : 'Below pass threshold'}
              </StatusPill>
            ) : null}
          </div>
          <ProgressBar
            label="Assessment completion"
            hint={formatPercentRatio(summary.completionRate)}
            value={completionPct}
            tone={completionPct >= 80 ? 'success' : completionPct >= 50 ? 'warn' : 'danger'}
          />
        </div>
      </div>
      {courseId ? (
        <nav className={s.navLinks} aria-label="Course sections">
          <Link to={`/student/courses/${courseId}/assignments`} className={s.navLink}>Assignments</Link>
          <Link to={`/student/courses/${courseId}/quizzes`} className={s.navLink}>Quizzes</Link>
          <Link to={`/student/courses/${courseId}/exams`} className={s.navLink}>Exams</Link>
        </nav>
      ) : null}
    </div>
  );
}
