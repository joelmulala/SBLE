import React from 'react';
import {
  AssessmentCard,
  AssessmentDivider,
  AssessmentMeta,
  BtnDanger,
  BtnPrimary,
  CardTitleRow,
  StatusBadge
} from '../assessment/AssessmentPrimitives';
import { getAssignmentStudentUiState } from '../../assessment';
import { formatDueDate, isAssignmentOverdue, isLateSubmission } from './assignmentUtils';
import SubmissionDropzone from './SubmissionDropzone';
import s from './Assignments.module.css';

export default function StudentAssignmentCard({
  assignment,
  file,
  onFileChange,
  uploadProgress,
  submitting,
  deleting,
  onSubmit,
  onDelete,
  onDownloadBrief,
  downloadingBrief,
  showConfirm
}) {
  const submission = assignment.mySubmission || null;
  const status = getAssignmentStudentUiState(assignment);
  const overdue = isAssignmentOverdue(assignment) && !submission?.id;
  const late = submission && isLateSubmission(submission, assignment);

  return (
    <AssessmentCard as="article" className={s.assignmentCard}>
      <CardTitleRow
        title={assignment.title}
        aside={
          <StatusBadge variant={status.badgeVariant}>{status.label}</StatusBadge>
        }
      />

      {assignment.description ? (
        <p className={s.description}>{assignment.description}</p>
      ) : null}

      <div className={s.detailGrid}>
        <div className={s.detailItem}>
          <label>Due date</label>
          <span>{formatDueDate(assignment.due_date)}</span>
        </div>
        <div className={s.detailItem}>
          <label>Submission</label>
          <span>
            {submission?.submitted_at
              ? new Date(submission.submitted_at).toLocaleString()
              : overdue ? 'Not submitted — overdue' : 'Not submitted'}
          </span>
        </div>
        <div className={s.detailItem}>
          <label>Status</label>
          <span>
            {late ? 'Submitted late' : status.label}
          </span>
        </div>
      </div>

      {assignment.file_name ? (
        <>
          <AssessmentDivider />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginTop: 'var(--space-3)' }}>
            <AssessmentMeta strong>Assignment materials: {assignment.file_name}</AssessmentMeta>
            <BtnPrimary
              type="button"
              onClick={() => onDownloadBrief(assignment)}
              disabled={downloadingBrief}
            >
              {downloadingBrief ? 'Downloading…' : 'Download brief'}
            </BtnPrimary>
          </div>
        </>
      ) : null}

      <p className={s.rubricPlaceholder}>
        Grading criteria are described in the assignment brief. Your lecturer may attach a rubric file above.
      </p>

      {submission?.grade != null && submission.grading_display !== 'graded_pending_release' ? (
        <div className={s.feedbackPanel}>
          <h4 className={s.feedbackPanelTitle}>Instructor feedback</h4>
          <p className={s.feedbackGrade}>Score: {submission.grade}%</p>
          {submission.feedback ? (
            <p className={s.feedbackBody}>{submission.feedback}</p>
          ) : (
            <AssessmentMeta>No written feedback provided.</AssessmentMeta>
          )}
        </div>
      ) : null}

      {submission?.grading_display === 'graded_pending_release' ? (
        <div className={s.feedbackPanel} style={{ background: '#fffbeb', borderColor: '#fde68a' }}>
          <h4 className={s.feedbackPanelTitle}>Grading in progress</h4>
          <AssessmentMeta>Your work has been reviewed. Results will appear here when released.</AssessmentMeta>
        </div>
      ) : null}

      {submission?.submitted_at && !submission.grade && submission.grading_display !== 'graded_pending_release' ? (
        <>
          <AssessmentDivider />
          <AssessmentMeta strong>
            Submitted {new Date(submission.submitted_at).toLocaleString()}
            {late ? ' (late)' : ''}
          </AssessmentMeta>
        </>
      ) : null}

      {status.canUpload ? (
        <>
          <AssessmentDivider />
          <SubmissionDropzone
            file={file}
            onFileChange={onFileChange}
            disabled={!status.canUpload}
            uploadProgress={uploadProgress}
            hint={status.uploadLabel}
          />
          <div className={s.submitActions}>
            <BtnPrimary
              type="button"
              onClick={onSubmit}
              disabled={!file || submitting}
            >
              {submitting ? 'Uploading…' : status.uploadLabel}
            </BtnPrimary>
            {status.canDelete && submission?.id ? (
              <BtnDanger type="button" onClick={onDelete} disabled={deleting}>
                {deleting ? 'Removing…' : 'Remove submission'}
              </BtnDanger>
            ) : null}
          </div>
          {showConfirm ? (
            <p className={s.confirmBanner} role="status">
              Submission received successfully.
            </p>
          ) : null}
        </>
      ) : null}
    </AssessmentCard>
  );
}
