import React, { useMemo, useState } from 'react';
import {
  AssessmentEmpty
} from '../assessment/AssessmentPrimitives';
import {
  ProgressBar,
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
import { KpiStatGrid, StatCard, Panel, FilterSelect, PageActions } from '../ui';
import ui from '../ui/system.module.css';
import s from './GradebookUI.module.css';

const FILTERS = [
  { id: 'all', label: 'All students' },
  { id: 'at_risk', label: 'At risk' },
  { id: 'missing', label: 'Missing work' }
];

export default function LecturerGradebookView({
  courseDetail,
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
  const courseId = courseDetail?.course?.id;

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
      <KpiStatGrid>
        <StatCard label="Enrolled" value={stats?.studentsEnrolled ?? '—'} hint="Active roster" />
        <StatCard label="Class average" value={formatScore(stats?.classAverage)} hint="Weighted overall" />
        <StatCard label="Pass rate" value={stats?.passRatePercent != null ? `${stats.passRatePercent}%` : '—'} hint="Meeting threshold" />
        <StatCard label="At risk" value={atRiskCount} hint={`${missingCount} with missing work`} />
      </KpiStatGrid>

      <Panel title="Grading progress">
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
        <p className={s.weightsLine}>
          Weights: Assignments {(weights?.assignments || 0) * 100}% · Quizzes {(weights?.quizzes || 0) * 100}%
        </p>
        {courseId ? <GradingNavLinks courseId={courseId} /> : null}
      </Panel>

      <PageActions
        filters={(
          <FilterSelect
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Filter gradebook rows"
          >
            {FILTERS.map((f) => (
              <option key={f.id} value={f.id}>{f.label}</option>
            ))}
          </FilterSelect>
        )}
      />

      <Panel title="Grade matrix" lead={`${filteredRows.length} student${filteredRows.length === 1 ? '' : 's'}`} flush>
        <div className={s.matrixScroll} tabIndex={0} role="region" aria-label="Grade matrix">
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
                    className={`${s.rowClickable} ${selected ? s.rowSelected : ''} ${atRisk ? s.rowAtRisk : ''}`}
                    onClick={() => onSelectStudent(String(row.userId))}
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
      </Panel>

      {studentBreakdown ? (
        <StudentDetailPanel row={studentBreakdown} courseId={courseId} isLecturer />
      ) : null}
    </>
  );
}
