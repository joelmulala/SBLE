import React from 'react';
import { Link } from 'react-router-dom';
import {
  AssessmentCard,
  AssessmentSectionTitle,
  AssessmentEmpty,
  AssessmentMeta,
  Field,
  SelectInput,
  StatusBadge
} from '../assessment/AssessmentPrimitives';
import {
  ProgressBar,
  SummaryTile,
  LetterGrade,
  TrendIndicator
} from './GradebookUI';
import StudentDetailPanel from './StudentDetailPanel';
import {
  formatScore,
  formatPercentRatio
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

  if (!routeCourseId && !selectedCourseId && overview?.courses?.length > 1) {
    return <CourseOverviewCards courses={overview.courses} onSelect={onCourseChange} />;
  }

  if (loading && !courseDetail) {
    return <AssessmentMeta>Loading your grades...</AssessmentMeta>;
  }

  if (!row) {
    return <AssessmentEmpty>No grade data available for this course yet.</AssessmentEmpty>;
  }

  return (
    <>
      {!routeCourseId && courseOptions.length > 1 ? (
        <AssessmentCard>
          <Field label="Course">
            <SelectInput value={selectedCourseId} onChange={(e) => onCourseChange(e.target.value)}>
              {courseOptions.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </SelectInput>
          </Field>
        </AssessmentCard>
      ) : null}

      <StudentGradesHero row={row} courseTitle={courseTitle} courseId={courseId} />
      <StudentDetailPanel row={row} courseId={courseId} isLecturer={false} />
    </>
  );
}

function CourseOverviewCards({ courses, onSelect }) {
  return (
    <AssessmentCard>
      <AssessmentSectionTitle>Your courses</AssessmentSectionTitle>
      <AssessmentMeta>Select a course to view grades, feedback, and progress.</AssessmentMeta>
      <div className={s.courseCards}>
        {courses.map((c) => (
          <button
            key={c.courseId}
            type="button"
            className={s.courseCard}
            onClick={() => onSelect(String(c.courseId))}
          >
            <h3 style={{ margin: '0 0 0.5rem', fontSize: 'var(--fs-2)' }}>{c.courseTitle}</h3>
            {c.summary?.weightedAverage != null ? (
              <>
                <p style={{ margin: 0, fontSize: 'var(--fs-3)', fontWeight: 700 }}>
                  {formatScore(c.summary.weightedAverage)}%
                </p>
                {c.summary.letter ? (
                  <p style={{ margin: '0.25rem 0 0', color: 'var(--color-text-muted)', fontSize: 'var(--fs-0)' }}>
                    Grade {c.summary.letter}
                  </p>
                ) : null}
                <ProgressBar
                  value={(c.summary.completionRate || 0) * 100}
                  label="Completion"
                  hint={formatPercentRatio(c.summary.completionRate)}
                />
              </>
            ) : (
              <AssessmentMeta>No scores recorded yet</AssessmentMeta>
            )}
          </button>
        ))}
      </div>
    </AssessmentCard>
  );
}

function StudentGradesHero({ row, courseTitle, courseId }) {
  const summary = row.summary || {};
  const completionPct = summary.completionRate != null ? summary.completionRate * 100 : 0;
  const passState = summary.weightedAverage != null && Number(summary.weightedAverage) >= 50;

  return (
    <AssessmentCard>
      <AssessmentSectionTitle>{courseTitle || 'Course grades'}</AssessmentSectionTitle>
      <div className={s.heroCard}>
        <LetterGrade letter={summary.letter} status={summary.status} />
        <div>
          <div className={s.heroScore}>{formatScore(summary.weightedAverage)}%</div>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--color-text-muted)', fontSize: 'var(--fs-0)' }}>
            Weighted course average
          </p>
          <div style={{ marginTop: 'var(--space-4)', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', alignItems: 'center' }}>
            <TrendIndicator trend={summary.trend} />
            {summary.weightedAverage != null ? (
              <StatusBadge variant={passState ? 'success' : 'danger'}>
                {passState ? 'Passing' : 'Below pass threshold'}
              </StatusBadge>
            ) : null}
          </div>
          <ProgressBar
            label="Assessment completion"
            hint={formatPercentRatio(summary.completionRate)}
            value={completionPct}
            tone={completionPct >= 80 ? 'success' : completionPct >= 50 ? 'warn' : 'danger'}
          />
          <div className={s.summaryGrid} style={{ marginTop: 'var(--space-5)' }}>
            <SummaryTile label="Assignments" value={formatScore(summary.assignmentAvg)} />
            <SummaryTile label="Quizzes" value={formatScore(summary.quizAvg)} />
            <SummaryTile label="Attendance" value={summary.attendancePercent != null ? `${summary.attendancePercent}%` : '—'} />
          </div>
        </div>
      </div>
      {courseId ? (
        <nav className={s.navLinks} style={{ marginTop: 'var(--space-4)' }}>
          <Link to={`/student/courses/${courseId}/assignments`} className={s.navLink}>Assignments</Link>
          <Link to={`/student/courses/${courseId}/quizzes`} className={s.navLink}>Quizzes</Link>
          <Link to={`/student/courses/${courseId}/exams`} className={s.navLink}>Exams</Link>
        </nav>
      ) : null}
    </AssessmentCard>
  );
}
