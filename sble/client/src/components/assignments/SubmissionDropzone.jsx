import React, { useCallback, useRef, useState } from 'react';
import s from './Assignments.module.css';

const ACCEPT = '.pdf,.jpg,.jpeg,.png,.doc,.docx';

export default function SubmissionDropzone({
  file,
  onFileChange,
  disabled = false,
  uploadProgress = null,
  hint
}) {
  const inputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);

  const pickFile = useCallback((next) => {
    if (disabled || !next) return;
    onFileChange(next);
  }, [disabled, onFileChange]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragActive(false);
    if (disabled) return;
    const dropped = e.dataTransfer?.files?.[0];
    pickFile(dropped || null);
  }, [disabled, pickFile]);

  const onDragOver = (e) => {
    e.preventDefault();
    if (!disabled) setDragActive(true);
  };

  const onDragLeave = () => setDragActive(false);

  return (
    <div>
      <div
        className={[
          s.dropzone,
          dragActive ? s.dropzoneActive : '',
          disabled ? s.dropzoneDisabled : ''
        ].filter(Boolean).join(' ')}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => !disabled && inputRef.current?.click()}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        aria-disabled={disabled}
      >
        <p className={s.dropzoneTitle}>
          {file ? 'Replace submission file' : 'Drag and drop your file here'}
        </p>
        <p className={s.dropzoneHint}>
          {hint || 'PDF, Word, or image · Max 50MB'}
        </p>
        {file ? (
          <p className={s.dropzoneFile}>{file.name}</p>
        ) : (
          <p className={s.dropzoneHint} style={{ marginTop: 'var(--space-2)' }}>
            or tap to browse
          </p>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
          onChange={(e) => pickFile(e.target.files?.[0] || null)}
          disabled={disabled}
        />
      </div>
      {uploadProgress != null && uploadProgress > 0 && uploadProgress < 100 ? (
        <div className={s.uploadProgress} aria-hidden>
          <div className={s.uploadProgressBar} style={{ width: `${uploadProgress}%` }} />
        </div>
      ) : null}
    </div>
  );
}
