import React, { useMemo, useState } from 'react';
import {
  AssessmentCard,
  AssessmentSectionTitle,
  AssessmentEmpty,
  Field,
  SelectInput
} from '../assessment/AssessmentPrimitives';
import {
  ProgressBar,
  SummaryTile,
  GradeCellDisplay,
  LetterGrade,
  GradingNavLinks
} from './GradebookUI';
import {
  formatScore,
  gradingProgressPercent,
  isAtRisk,
  hasMissingWork,
  countMissingInRow,
  formatWhen
} from './gradebookUtils';
import StudentDetailPanel from './StudentDetailPanel';
import s from './GradebookUI.module.css';

const FILTERS = [
  { id: 'all', label: 'All students' },
  { id: 'at_risk', label: 'At risk' },
  { id: 'missing', label: 'Missing work' }
];

export default function LecturerGradebookView({
  courseDetail,
  courseOptions,
  selectedCourseId,
  onCourseChange,
  routeCourseId,
  selectedStudentId,
  onSelectStudent,
  studentBreakdown
}) {
  const [filter, setFilter] = useState('all');

  const assignmentCols = courseDetail?.columns?.assignments || [];
  const quizCols = courseDetail?.columns?.quizzes || [];
  const examCols = courseDetail?.columns?.exams || [];
  const stats = courseDetail?.statistics;
  const weights = courseDetail?.weights;
  const courseId = courseDetail?.course?.id || selectedCourseId;

  const filteredRows = useMemo(() => {
    const rows = courseDetail?.rows || [];
    if (filter === 'at_risk') return rows.filter(isAtRisk);
    if (filter === 'missing') return rows.filter(hasMissingWork);
    return rows;
  }, [courseDetail?.rows, filter]);

  const atRiskCount = useMemo(
    () => (courseDetail?.rows || []).filter(isAtRisk).length,
    [courseDetail?.rows]
  );

  const missingCount = useMemo(
    () => (courseDetail?.rows || []).filter(hasMissingWork).length,
    [courseDetail?.rows]
  );

  if (!courseDetail?.rows?.length) {
    return <AssessmentEmpty>No enrolled students or assessments in this course yet.</AssessmentEmpty>;
  }

  const assignGradedPct = gradingProgressPercent(stats, 'assignments');
  const quizGradedPct = stats?.gradingProgress?.quizzes?.total
    ? Math.round((stats.gradingProgress.quizzes.completed / stats.gradingProgress.quizzes.total) * 100)
    : 0;

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

      <AssessmentCard>
        <AssessmentSectionTitle>Course overview</AssessmentSectionTitle>
        <div className={s.summaryGrid}>
          <SummaryTile label="Enrolled" value={stats?.studentsEnrolled ?? '—'} />
          <SummaryTile label="Class average" value={formatScore(stats?.classAverage)} />
          <SummaryTile label="Pass rate" value={stats?.passRatePercent != null ? `${stats.passRatePercent}%` : '—'} />
          <SummaryTile label="At risk" value={atRiskCount} hint="Below 50% overall" />
          <SummaryTile label="Missing work" value={missingCount} hint="One or more gaps" />
        </div>
        <ProgressBar
          label="Assignment grading"
          hint={`${assignGradedPct}%`}
          value={assignGradedPct}
          tone={assignGradedPct >= 80 ? 'success' : assignGradedPct >= 50 ? 'warn' : 'danger'}
        />
        <ProgressBar
          label="Quiz completion"
          hint={`${quizGradedPct}%`}
          value={quizGradedPct}
          tone="brand"
        />
        <p style={{ marginTop: 'var(--space-4)', fontSize: 'var(--fs-00)', color: 'var(--color-text-muted)' }}>
          Weights: Assignments {(weights?.assignments || 0) * 100}% · Quizzes {(weights?.quizzes || 0) * 100}%
        </p>
        {courseId ? <GradingNavLinks courseId={courseId} /> : null}
      </AssessmentCard>

      <AssessmentCard>
        <div className={s.matrixCard}>
        <div className={s.matrixHeader}>
          <AssessmentSectionTitle>Gradebook</AssessmentSectionTitle>
          <div className={s.toolbarGroup}>
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`${s.filterChip} ${filter === f.id ? s.filterChipActive : ''}`}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className={s.matrixScroll}>
          <table className={s.gradeTable}>
            <thead>
              <tr>
                <th rowSpan={2} className={s.colStudent}>Student</th>
                {assignmentCols.length > 0 ? (
                  <th colSpan={assignmentCols.length} className={s.groupHeader}>Assignments</th>
                ) : null}
                {quizCols.length > 0 ? (
                  <th colSpan={quizCols.length} className={s.groupHeader}>Quizzes</th>
                ) : null}
                {examCols.length > 0 ? (
                  <th colSpan={examCols.length} className={s.groupHeader}>Exams</th>
                ) : null}
                <th rowSpan={2} className={s.totalsCol}>Assign. avg</th>
                <th rowSpan={2} className={s.totalsCol}>Quiz avg</th>
                <th rowSpan={2} className={s.totalsCol}>Overall</th>
                <th rowSpan={2} className={s.totalsCol}>Grade</th>
              </tr>
              <tr>
                {assignmentCols.map((col) => (
                  <th key={`a-${col.id}`} title={col.dueDate ? `Due ${formatWhen(col.dueDate)}` : ''}>
                    <span className={s.colLink}>{col.title}</span>
                    {col.dueDate ? <span className={s.colDue}>{formatWhen(col.dueDate)}</span> : null}
                  </th>
                ))}
                {quizCols.map((col) => (
                  <th key={`q-${col.id}`}>{col.title}</th>
                ))}
                {examCols.map((col) => (
                  <th key={`e-${col.id}`}>{col.title}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => {
                const selected = selectedStudentId === String(row.userId);
                const atRisk = isAtRisk(row);
                const missingN = countMissingInRow(row);
                return (
                  <tr
                    key={row.userId}
                    className={`${selected ? s.rowSelected : ''} ${atRisk ? s.rowAtRisk : ''}`}
                    onClick={() => onSelectStudent(String(row.userId))}
                    style={{ cursor: 'pointer' }}
                  >
                    <td className={s.colStudent}>
                      <div className={s.studentName}>{row.fullName || row.studentId}</div>
                      <div className={s.studentId}>{row.studentId}</div>
                      {missingN > 0 ? (
                        <span className={s.cellMuted}>{missingN} missing</span>
                      ) : null}
                    </td>
                    {(row.categories?.assignments?.items || []).map((cell) => (
                      <td key={`a-${cell.id}`}><GradeCellDisplay cell={cell} /></td>
                    ))}
                    {(row.categories?.quizzes?.items || []).map((cell) => (
                      <td key={`q-${cell.id}`}><GradeCellDisplay cell={cell} /></td>
                    ))}
                    {(row.categories?.exams?.items || []).map((cell) => (
                      <td key={`e-${cell.id}`}><GradeCellDisplay cell={cell} /></td>
                    ))}
                    <td className={s.totalsCol}>{formatScore(row.summary?.assignmentAvg)}</td>
                    <td className={s.totalsCol}>{formatScore(row.summary?.quizAvg)}</td>
                    <td className={s.totalsCol}>{formatScore(row.summary?.weightedAverage)}</td>
                    <td className={s.totalsCol}>
                      <LetterGrade letter={row.summary?.letter} status={row.summary?.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filteredRows.length === 0 ? (
          <p className={s.emptyHint}>No students match this filter.</p>
        ) : null}
        </div>
      </AssessmentCard>

      {studentBreakdown ? (
        <StudentDetailPanel row={studentBreakdown} courseId={courseId} isLecturer />
      ) : null}
    </>
  );
}
