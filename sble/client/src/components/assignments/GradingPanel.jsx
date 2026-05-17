import React, { useEffect, useState } from 'react';
import api from '../../config/api';
import {
  AssessmentMeta,
  AssessmentAlert,
  BtnPrimary,
  BtnSecondary,
  Field,
  TextInput,
  TextArea,
  StatusBadge
} from '../assessment/AssessmentPrimitives';
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

  return (
    <div className={s.gradingOverlay} role="presentation" onClick={onClose}>
      <aside
        className={s.gradingPanel}
        role="dialog"
        aria-label="Grade submission"
        onClick={(e) => e.stopPropagation()}
      >
        <header className={s.gradingHeader}>
          <div>
            <h2 className={s.gradingTitle}>
              {submission.student?.full_name || submission.student?.email || 'Student'}
            </h2>
            <p className={s.gradingSub}>
              {submission.file_name || 'Submission'}
              {submission.submitted_at
                ? ` · ${new Date(submission.submitted_at).toLocaleString()}`
                : ''}
            </p>
            {status ? <StatusBadge variant={status.variant}>{status.label}</StatusBadge> : null}
          </div>
          <button type="button" className={s.gradingClose} onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className={s.gradingBody}>
          {error ? <AssessmentAlert type="error">{error}</AssessmentAlert> : null}

          {showPreview ? (
            <section aria-label="Submission preview">
              <AssessmentMeta strong>Submission preview</AssessmentMeta>
              {previewLoading ? <AssessmentMeta>Loading preview…</AssessmentMeta> : null}
              {previewError ? <AssessmentMeta>{previewError}</AssessmentMeta> : null}
              {!previewLoading && previewUrl && isPdf ? (
                <iframe
                  title="Submission preview"
                  className={s.previewFrame}
                  src={previewUrl}
                />
              ) : null}
              {!previewLoading && previewUrl && !isPdf ? (
                <img src={previewUrl} alt="Submission preview" className={s.previewImage} />
              ) : null}
            </section>
          ) : (
            <AssessmentMeta>Download the file to review handwritten or unsupported formats.</AssessmentMeta>
          )}

          <BtnSecondary type="button" onClick={() => onDownload(submission)}>
            Download attachment
          </BtnSecondary>

          <Field label="Score (0–100)">
            <TextInput
              type="number"
              min={0}
              max={100}
              step={0.01}
              value={grade}
              onChange={(e) => onGradeChange(e.target.value)}
              placeholder="e.g. 85"
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

          <label className="checkRow" style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
            <input
              type="checkbox"
              checked={publish}
              onChange={(e) => onPublishChange(e.target.checked)}
            />
            <span style={{ fontSize: 'var(--fs-00)', color: 'var(--color-text-muted)' }}>
              Publish to student — updates gradebook visibility and sends notification
            </span>
          </label>

          <div className="rubricPlaceholder" style={{
            padding: 'var(--space-3)',
            border: '1px dashed var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 'var(--fs-00)',
            color: 'var(--color-text-faint)'
          }}>
            Rubric criteria can be attached in the assignment brief. Structured rubric scoring is not enabled in this release.
          </div>
        </div>

        <footer className={s.gradingFooter}>
          <BtnPrimary type="button" disabled={saving} onClick={onPublish}>
            {saving ? 'Saving…' : publish ? 'Save & publish' : 'Publish results'}
          </BtnPrimary>
          <BtnSecondary type="button" disabled={saving} onClick={onSaveDraft}>
            Save draft
          </BtnSecondary>
          <BtnSecondary type="button" onClick={onClose}>Cancel</BtnSecondary>
        </footer>
      </aside>
    </div>
  );
}
