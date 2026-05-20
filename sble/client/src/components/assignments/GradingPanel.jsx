import React, { useEffect, useState } from 'react';
import api from '../../config/api';
import { Button } from '../ui';
import StatusPill from '../ui/StatusPill';
import ui from '../ui/system.module.css';
import { Field, TextInput, TextArea } from '../assessment/AssessmentPrimitives';
import { canPreviewFile, getLecturerSubmissionStatus } from './assignmentUtils';
import s from './Assignments.module.css';

export default function GradingPanel({
  submission,
  assignment,
  grade,
  feedback,
  publish,
  saving,
  error,
  onGradeChange,
  onFeedbackChange,
  onPublishChange,
  onSaveDraft,
  onPublish,
  onClose,
  onDownload
}) {
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');

  const status = submission ? getLecturerSubmissionStatus(submission, assignment) : null;
  const showPreview = submission?.file_name && canPreviewFile(submission.file_name);

  useEffect(() => {
    if (!submission?.id || !showPreview) {
      setPreviewUrl(null);
      return undefined;
    }

    let cancelled = false;
    let objectUrl = null;

    const load = async () => {
      setPreviewLoading(true);
      setPreviewError('');
      try {
        const res = await api.get(`/assignments/submissions/${submission.id}/download`, {
          responseType: 'blob'
        });
        if (cancelled) return;
        objectUrl = URL.createObjectURL(res.data);
        setPreviewUrl(objectUrl);
      } catch (err) {
        if (!cancelled) {
          setPreviewError(err?.response?.data?.error || 'Could not load preview.');
          setPreviewUrl(null);
        }
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [submission?.id, submission?.file_name, showPreview]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  if (!submission) return null;

  const isPdf = submission.file_name?.toLowerCase().endsWith('.pdf');
  const studentLabel = submission.student?.full_name || submission.student?.email || 'Student';
  const pillVariant = status?.key === 'graded' ? 'active'
    : status?.key === 'late' ? 'inactive'
      : status?.key === 'pending_release' ? 'info'
        : 'info';

  return (
    <div className={s.gradingOverlay} role="presentation" onClick={onClose}>
      <aside
        className={s.gradingPanel}
        role="dialog"
        aria-label="Grade submission"
        onClick={(e) => e.stopPropagation()}
      >
        <header className={s.gradingHeader}>
          <div className={s.gradingIdentity}>
            <p className={s.gradingKicker}>Grading submission</p>
            <h2 className={s.gradingTitle}>{studentLabel}</h2>
            <p className={s.gradingSub}>
              {assignment?.title ? `${assignment.title} · ` : ''}
              {submission.file_name || 'Attachment'}
            </p>
            <p className={s.gradingSub}>
              {submission.submitted_at
                ? `Submitted ${new Date(submission.submitted_at).toLocaleString()}`
                : 'Submission time unavailable'}
            </p>
            {status ? <StatusPill variant={pillVariant}>{status.label}</StatusPill> : null}
          </div>
          <button type="button" className={s.gradingClose} onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className={s.gradingBody}>
          {error ? <div className={`${ui.notice} ${ui.noticeError}`}>{error}</div> : null}

          <section className={s.gradingPreviewBlock} aria-label="Submission preview">
            <div className={s.gradingPreviewHead}>
              <h3 className={s.gradingSectionTitle}>Attachment</h3>
              <Button type="button" variant="ghost" onClick={() => onDownload(submission)}>
                Download
              </Button>
            </div>
            {showPreview ? (
              <>
                {previewLoading ? <p className={s.gradingHint}>Loading preview…</p> : null}
                {previewError ? <p className={s.gradingHint}>{previewError}</p> : null}
                {!previewLoading && previewUrl && isPdf ? (
                  <iframe title="Submission preview" className={s.previewFrame} src={previewUrl} />
                ) : null}
                {!previewLoading && previewUrl && !isPdf ? (
                  <img src={previewUrl} alt="Submission preview" className={s.previewImage} />
                ) : null}
              </>
            ) : (
              <p className={s.gradingHint}>Download the file to review unsupported or handwritten formats.</p>
            )}
          </section>

          <section className={s.gradingFormBlock}>
            <h3 className={s.gradingSectionTitle}>Score & feedback</h3>
            <Field label="Score (0–100)">
              <TextInput
                type="number"
                min={0}
                max={100}
                step={0.01}
                value={grade}
                onChange={(e) => onGradeChange(e.target.value)}
                placeholder="e.g. 85"
                className={s.scoreInput}
              />
            </Field>

            <Field label="Feedback for student">
              <TextArea
                value={feedback}
                onChange={(e) => onFeedbackChange(e.target.value)}
                rows={5}
                placeholder="Constructive comments on this submission…"
              />
            </Field>

            <label className={s.publishCheck}>
              <input
                type="checkbox"
                checked={publish}
                onChange={(e) => onPublishChange(e.target.checked)}
              />
              <span>Publish to student — updates gradebook and notifies the student</span>
            </label>

            <p className={s.rubricPlaceholder}>
              Structured rubric scoring is not enabled. Attach criteria in the assignment brief if needed.
            </p>
          </section>
        </div>

        <footer className={s.gradingFooter}>
          <Button type="button" variant="primary" disabled={saving} onClick={onPublish}>
            {saving ? 'Saving…' : publish ? 'Save & publish' : 'Publish results'}
          </Button>
          <Button type="button" variant="ghost" disabled={saving} onClick={onSaveDraft}>
            Save draft
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>Close</Button>
        </footer>
      </aside>
    </div>
  );
}
