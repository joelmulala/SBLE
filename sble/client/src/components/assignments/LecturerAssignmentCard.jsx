import React from 'react';
import {
  AssessmentAlert,
  AssessmentCard,
  AssessmentDivider,
  AssessmentMeta,
  AssessmentToolbar,
  BtnPrimary,
  BtnSecondary,
  CardTitleRow,
  StatusBadge
} from '../assessment/AssessmentPrimitives';
import AssignmentsEmptyState from './AssignmentsEmptyState';
import {
  formatDueDate,
  getLecturerSubmissionStatus,
  isAssignmentOverdue
} from './assignmentUtils';
import s from './Assignments.module.css';

export default function LecturerAssignmentCard({
  assignment,
  stats,
  submissions,
  queueOpen,
  queueLoading,
  queueError,
  downloadingSubmissionId,
  activeSubmissionId,
  onToggleQueue,
  onOpenGrading,
  onDownloadSubmission,
  onDownloadBrief,
  downloadingBrief
}) {
  const overdue = isAssignmentOverdue(assignment);

  return (
    <AssessmentCard as="article" className={s.assignmentCard}>
      <div className={s.assignmentHeader}>
        <CardTitleRow
          title={assignment.title}
          aside={
            <>
              {overdue ? <StatusBadge variant="warning">Past due</StatusBadge> : null}
              {assignment.due_date ? (
                <StatusBadge variant="neutral">Due {formatDueDate(assignment.due_date)}</StatusBadge>
              ) : null}
            </>
          }
        />
      </div>

      {assignment.description ? (
        <p className={s.description}>{assignment.description}</p>
      ) : null}

      <div className={s.statsBar}>
        <div className={s.statBlock}>
          <strong>{stats?.total ?? '—'}</strong>
          <span>Submissions</span>
        </div>
        <div className={s.statBlock}>
          <strong>{stats?.graded ?? '—'}</strong>
          <span>Graded</span>
        </div>
        <div className={s.statBlock}>
          <strong>{stats?.pending ?? '—'}</strong>
          <span>Pending</span>
        </div>
        {stats?.total > 0 ? (
          <div className={s.progressTrack}>
            <p className={s.progressLabel}>{stats.progress}% grading complete</p>
            <div className={s.progressBar}>
              <div
                className={s.progressFill}
                style={{ width: `${stats.progress}%` }}
              />
            </div>
          </div>
        ) : null}
      </div>

      {assignment.file_name ? (
        <>
          <AssessmentDivider />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
            <AssessmentMeta strong>Brief: {assignment.file_name}</AssessmentMeta>
            <BtnSecondary
              type="button"
              onClick={() => onDownloadBrief(assignment)}
              disabled={downloadingBrief}
            >
              {downloadingBrief ? 'Downloading…' : 'Download'}
            </BtnSecondary>
          </div>
        </>
      ) : null}

      <AssessmentToolbar>
        <BtnPrimary type="button" onClick={onToggleQueue}>
          {queueOpen ? 'Close grading' : 'Open grading workspace'}
        </BtnPrimary>
      </AssessmentToolbar>

      {queueOpen ? (
        <section className={s.queueSection} aria-label="Grading queue">
          {queueError ? <AssessmentAlert type="error">{queueError}</AssessmentAlert> : null}
          {queueLoading ? (
            <AssessmentMeta>Loading submissions…</AssessmentMeta>
          ) : submissions.length === 0 ? (
            <AssignmentsEmptyState
              title="No submissions yet"
              lead="Students have not uploaded work for this assignment. The queue will populate as submissions arrive."
              isLecturer
            />
          ) : (
            <ul className={s.queueList}>
              {submissions.map((entry) => {
                const st = getLecturerSubmissionStatus(entry, assignment);
                return (
                  <li key={entry.id}>
                    <div
                      className={[
                        s.queueRow,
                        activeSubmissionId === entry.id ? s.queueRowActive : ''
                      ].filter(Boolean).join(' ')}
                    >
                      <div className={s.queueStudent}>
                        <p className={s.queueStudentName}>
                          {entry.student?.full_name || entry.student?.email || 'Student'}
                        </p>
                        <p className={s.queueFileMeta}>
                          {entry.file_name || 'File'}
                          {entry.submitted_at
                            ? ` · ${new Date(entry.submitted_at).toLocaleString()}`
                            : ''}
                        </p>
                        <StatusBadge variant={st.variant}>{st.label}</StatusBadge>
                        {entry.grade != null ? (
                          <AssessmentMeta>Score: {entry.grade}%</AssessmentMeta>
                        ) : null}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <BtnSecondary
                          type="button"
                          onClick={() => onDownloadSubmission(entry)}
                          disabled={downloadingSubmissionId === entry.id}
                        >
                          {downloadingSubmissionId === entry.id ? '…' : 'Download'}
                        </BtnSecondary>
                        <BtnPrimary type="button" onClick={() => onOpenGrading(entry)}>
                          Review & grade
                        </BtnPrimary>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}
    </AssessmentCard>
  );
}

