import React, { useRef } from 'react';
import { Button } from '../ui';
import StatusPill from '../ui/StatusPill';
import {
  getAssignmentStudentUiState,
  getStudentPrimaryStatus,
  getStudentLifecycleStrip,
  AssignmentStudentPhase
} from '../../assessment/assignmentStudentWorkflow';
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
  const feedbackRef = useRef(null);
  const submission = assignment.mySubmission || null;
  const workflow = getAssignmentStudentUiState(assignment);
  const primary = getStudentPrimaryStatus(assignment);
  const lifecycle = getStudentLifecycleStrip(assignment);

  const hasReleasedGrade = submission?.grade != null
    && submission.grading_display !== 'graded_pending_release';
  const awaitingRelease = submission?.grading_display === 'graded_pending_release';
  const showUpload = workflow.canUpload;
  const showFeedback = hasReleasedGrade || awaitingRelease;

  const scrollToFeedback = () => {
    feedbackRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  return (
    <article className={s.studentCard}>
      <div className={s.studentCardTop}>
        <h3 className={s.studentCardTitle}>{assignment.title}</h3>
        <StatusPill variant={primary.variant}>{primary.label}</StatusPill>
      </div>

      {lifecycle.length > 0 ? (
        <p className={s.studentLifecycleStrip}>
          {lifecycle.map((part, i) => (
            <span key={part}>
              {i > 0 ? <span className={s.lifecycleSep}> · </span> : null}
              {part}
            </span>
          ))}
        </p>
      ) : null}

      {assignment.description ? (
        <p className={s.studentDescription}>{assignment.description}</p>
      ) : null}

      {assignment.file_name ? (
        <div className={s.studentBriefRow}>
          <span className={s.studentBriefLabel}>Brief: {assignment.file_name}</span>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onDownloadBrief(assignment)}
            disabled={downloadingBrief}
          >
            {downloadingBrief ? 'Downloading…' : 'Download'}
          </Button>
        </div>
      ) : null}

      {showFeedback ? (
        <div
          ref={feedbackRef}
          className={awaitingRelease ? s.feedbackPanelPending : s.feedbackPanel}
        >
          {hasReleasedGrade ? (
            <>
              <h4 className={s.feedbackPanelTitle}>Your grade</h4>
              <p className={s.feedbackGrade}>{submission.grade}%</p>
              {submission.feedback ? (
                <p className={s.feedbackBody}>{submission.feedback}</p>
              ) : (
                <p className={s.feedbackEmpty}>No written feedback provided.</p>
              )}
            </>
          ) : (
            <>
              <h4 className={s.feedbackPanelTitle}>Awaiting feedback</h4>
              <p className={s.feedbackEmpty}>
                Your work has been reviewed. Results will appear here when released.
              </p>
            </>
          )}
        </div>
      ) : null}

      <div className={s.studentActions}>
        {hasReleasedGrade ? (
          <Button type="button" variant="ghost" onClick={scrollToFeedback}>
            View feedback
          </Button>
        ) : null}

        {showUpload ? (
          <>
            <SubmissionDropzone
              file={file}
              onFileChange={onFileChange}
              disabled={!workflow.canUpload}
              uploadProgress={uploadProgress}
              hint={workflow.uploadLabel}
            />
            <div className={s.studentSubmitRow}>
              <Button
                type="button"
                variant="primary"
                onClick={onSubmit}
                disabled={!file || submitting}
              >
                {submitting ? 'Uploading…' : workflow.uploadLabel}
              </Button>
              {workflow.canDelete && submission?.id ? (
                <Button type="button" variant="danger" onClick={onDelete} disabled={deleting}>
                  {deleting ? 'Removing…' : 'Remove submission'}
                </Button>
              ) : null}
            </div>
            {showConfirm ? (
              <p className={s.confirmBanner} role="status">
                Submission received successfully.
              </p>
            ) : null}
          </>
        ) : null}

        {!showUpload && !hasReleasedGrade && workflow.phase === AssignmentStudentPhase.CLOSED ? (
          <p className={s.studentClosedNote}>The due date has passed. Contact your lecturer if you need an extension.</p>
        ) : null}

        {!showUpload && !hasReleasedGrade
          && (workflow.phase === AssignmentStudentPhase.SUBMITTED_LOCKED
            || workflow.phase === AssignmentStudentPhase.SUBMITTED_RESUBMIT_ALLOWED) ? (
          <p className={s.studentClosedNote}>
            Your submission is on file. You will be notified when grading is complete.
          </p>
        ) : null}
      </div>
    </article>
  );
}
