import React, { useMemo, useState } from 'react';
import { Button, FilterSelect, EmptyState } from '../ui';
import StatusPill from '../ui/StatusPill';
import ui from '../ui/system.module.css';
import {
  formatDueDate,
  getLecturerSubmissionStatus,
  isAssignmentOverdue,
  sortSubmissionsForReview,
  filterSubmissionsByStatus
} from './assignmentUtils';
import s from './Assignments.module.css';

const QUEUE_FILTERS = [
  { id: 'all', label: 'All submissions' },
  { id: 'pending', label: 'Needs review' },
  { id: 'late', label: 'Late' },
  { id: 'graded', label: 'Graded' }
];

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
  const [queueFilter, setQueueFilter] = useState('all');
  const overdue = isAssignmentOverdue(assignment);

  const sortedSubmissions = useMemo(
    () => sortSubmissionsForReview(submissions, assignment),
    [submissions, assignment]
  );

  const visibleSubmissions = useMemo(
    () => filterSubmissionsByStatus(sortedSubmissions, assignment, queueFilter),
    [sortedSubmissions, assignment, queueFilter]
  );

  const pendingCount = useMemo(
    () => sortedSubmissions.filter((e) => {
      const k = getLecturerSubmissionStatus(e, assignment).key;
      return k === 'pending' || k === 'late';
    }).length,
    [sortedSubmissions, assignment]
  );

  return (
    <article className={s.assignmentCardLite}>
      <div className={s.assignmentTop}>
        <div className={s.assignmentTitleBlock}>
          <h3 className={s.assignmentTitle}>{assignment.title}</h3>
          <div className={s.assignmentMetaRow}>
            {overdue ? <StatusPill variant="inactive">Past due</StatusPill> : null}
            {assignment.due_date ? (
              <span className={s.dueLabel}>Due {formatDueDate(assignment.due_date)}</span>
            ) : (
              <span className={s.dueLabel}>No due date</span>
            )}
          </div>
        </div>
        <Button type="button" variant={queueOpen ? 'ghost' : 'primary'} onClick={onToggleQueue}>
          {queueOpen ? 'Close queue' : pendingCount > 0 ? `Review (${pendingCount})` : 'Submissions'}
        </Button>
      </div>

      {assignment.description ? (
        <p className={s.description}>{assignment.description}</p>
      ) : null}

      <div className={s.lifecycleStrip}>
        <span>{stats?.total ?? 0} submitted</span>
        <span className={s.lifecycleSep}>·</span>
        <span>{stats?.graded ?? 0} graded</span>
        <span className={s.lifecycleSep}>·</span>
        <span>{stats?.pending ?? 0} pending</span>
        {stats?.total > 0 ? (
          <>
            <span className={s.lifecycleSep}>·</span>
            <span>{stats.progress}% complete</span>
          </>
        ) : null}
      </div>

      {stats?.total > 0 ? (
        <div className={s.progressBar} aria-hidden>
          <div className={s.progressFill} style={{ width: `${stats.progress}%` }} />
        </div>
      ) : null}

      {assignment.file_name ? (
        <div className={s.briefRow}>
          <span className={s.briefLabel}>Brief: {assignment.file_name}</span>
          <Button type="button" variant="ghost" onClick={() => onDownloadBrief(assignment)} disabled={downloadingBrief}>
            {downloadingBrief ? 'Downloading…' : 'Download'}
          </Button>
        </div>
      ) : null}

      {queueOpen ? (
        <section className={s.queueSection} aria-label="Submission queue">
          {queueError ? <div className={`${ui.notice} ${ui.noticeError}`}>{queueError}</div> : null}

          <div className={s.queueToolbar}>
            <FilterSelect
              value={queueFilter}
              onChange={(e) => setQueueFilter(e.target.value)}
              aria-label="Filter submissions"
            >
              {QUEUE_FILTERS.map((f) => (
                <option key={f.id} value={f.id}>{f.label}</option>
              ))}
            </FilterSelect>
            <span className={s.queueCount}>
              {visibleSubmissions.length} of {sortedSubmissions.length}
            </span>
          </div>

          {queueLoading ? (
            <p className={s.queueLoading}>Loading submissions…</p>
          ) : sortedSubmissions.length === 0 ? (
            <EmptyState message="No submissions yet. Students will appear here once work is uploaded." />
          ) : visibleSubmissions.length === 0 ? (
            <EmptyState message="No submissions match this filter." />
          ) : (
            <ul className={s.queueList}>
              {visibleSubmissions.map((entry) => {
                const st = getLecturerSubmissionStatus(entry, assignment);
                const pillVariant = st.key === 'graded' ? 'active'
                  : st.key === 'late' ? 'inactive'
                    : st.key === 'pending_release' ? 'info'
                      : 'info';
                return (
                  <li key={entry.id}>
                    <div
                      className={[
                        s.queueRow,
                        activeSubmissionId === entry.id ? s.queueRowActive : '',
                        st.key === 'late' ? s.queueRowLate : '',
                        st.key === 'pending' ? s.queueRowPending : ''
                      ].filter(Boolean).join(' ')}
                    >
                      <div className={s.queueStudent}>
                        <div className={s.queueStudentHead}>
                          <p className={s.queueStudentName}>
                            {entry.student?.full_name || entry.student?.email || 'Student'}
                          </p>
                          <StatusPill variant={pillVariant}>{st.label}</StatusPill>
                        </div>
                        <p className={s.queueFileMeta}>
                          {entry.file_name || 'Attachment'}
                          {entry.submitted_at
                            ? ` · ${new Date(entry.submitted_at).toLocaleString()}`
                            : ''}
                        </p>
                        {entry.grade != null ? (
                          <p className={s.queueScore}>Score: {entry.grade}%</p>
                        ) : null}
                      </div>
                      <div className={s.queueActions}>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => onDownloadSubmission(entry)}
                          disabled={downloadingSubmissionId === entry.id}
                        >
                          {downloadingSubmissionId === entry.id ? '…' : 'Download'}
                        </Button>
                        <Button type="button" variant="primary" onClick={() => onOpenGrading(entry)}>
                          Grade
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}
    </article>
  );
}
