import React, { useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { IconStudent, IconLecturer, IconCamera } from '../AuthIcons';
import { getPasswordStrength } from '../../../utils/registerValidation';
import styles from '../AuthLayout.module.css';

const STEPS = ['Account type', 'Your details', 'Complete'];

export function RegisterStepIndicator({ step }) {
  const index = step === 'role' ? 0 : step === 'form' ? 1 : 2;
  return (
    <ol className={styles.stepIndicator} aria-label="Registration progress">
      {STEPS.map((label, i) => (
        <li
          key={label}
          className={[
            styles.stepItem,
            i < index ? styles.stepItemDone : '',
            i === index ? styles.stepItemActive : ''
          ].filter(Boolean).join(' ')}
        >
          <span className={styles.stepDot}>{i < index ? '✓' : i + 1}</span>
          <span className={styles.stepLabel}>{label}</span>
        </li>
      ))}
    </ol>
  );
}

export function RegisterRoleStep({ onSelect }) {
  return (
    <div className={styles.roleStep}>
      <p className={styles.roleStepLead}>
        Select how you will use SBLE. Your onboarding form is tailored to your role.
      </p>
      <div className={styles.roleCards}>
        <button
          type="button"
          className={styles.roleCard}
          onClick={() => onSelect('student')}
        >
          <span className={styles.roleCardIcon} data-role="student">
            <IconStudent />
          </span>
          <span className={styles.roleCardTitle}>Student</span>
          <span className={styles.roleCardDesc}>
            Enrol in courses, submit assessments, and join live classes.
          </span>
        </button>
        <button
          type="button"
          className={styles.roleCard}
          onClick={() => onSelect('lecturer')}
        >
          <span className={styles.roleCardIcon} data-role="lecturer">
            <IconLecturer />
          </span>
          <span className={styles.roleCardTitle}>Lecturer</span>
          <span className={styles.roleCardDesc}>
            Create courses, manage modules, and host blended teaching sessions.
          </span>
        </button>
      </div>
      <p className={styles.note}>
        Admin accounts are provisioned by your institution. Already registered?
        {' '}
        <Link to="/login" className={styles.linkTertiary}>Sign in</Link>
      </p>
    </div>
  );
}

export function AuthFieldGroup({ title, description, children }) {
  return (
    <fieldset className={styles.fieldGroup}>
      <legend className={styles.fieldGroupLegend}>{title}</legend>
      {description ? <p className={styles.fieldGroupDesc}>{description}</p> : null}
      <div className={styles.fieldGroupBody}>{children}</div>
    </fieldset>
  );
}

export function AuthPasswordStrength({ password }) {
  const strength = useMemo(() => getPasswordStrength(password), [password]);
  if (!password) return null;

  return (
    <div className={styles.passwordStrength} aria-live="polite">
      <div className={styles.passwordStrengthBar}>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={[
              styles.passwordStrengthSegment,
              i < strength.score ? styles[`passwordStrengthSeg${strength.score}`] : ''
            ].filter(Boolean).join(' ')}
          />
        ))}
      </div>
      <p className={styles.passwordStrengthLabel}>
        Password strength:
        {' '}
        <strong>{strength.label || 'Too weak'}</strong>
      </p>
      <ul className={styles.passwordChecklist}>
        {strength.checks.map((c) => (
          <li
            key={c.key}
            className={c.met ? styles.passwordCheckMet : styles.passwordCheckPending}
          >
            {c.met ? '✓' : '○'}
            {' '}
            {c.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AuthPhotoUpload({ file, previewUrl, onChange, disabled, hint }) {
  const inputRef = useRef(null);

  const handleFile = (e) => {
    const next = e.target.files?.[0];
    if (!next) {
      onChange(null, null);
      return;
    }
    if (!next.type.startsWith('image/')) return;
    if (next.size > 2 * 1024 * 1024) return;
    const url = URL.createObjectURL(next);
    onChange(next, url);
  };

  return (
    <div className={styles.photoUpload}>
      <span className={styles.label}>Profile photo (optional)</span>
      <div className={styles.photoUploadRow}>
        <div className={styles.photoPreview} aria-hidden={!previewUrl}>
          {previewUrl ? (
            <img src={previewUrl} alt="" />
          ) : (
            <IconCamera />
          )}
        </div>
        <div className={styles.photoUploadMeta}>
          <button
            type="button"
            className={styles.photoUploadBtn}
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
          >
            {file ? 'Change photo' : 'Upload photo'}
          </button>
          {file ? (
            <button
              type="button"
              className={styles.photoRemoveBtn}
              disabled={disabled}
              onClick={() => onChange(null, null)}
            >
              Remove
            </button>
          ) : null}
          <p className={styles.photoHint}>
            {hint || 'JPG or PNG, max 2 MB. You can update this later in your profile.'}
          </p>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className={styles.photoInputHidden}
        onChange={handleFile}
        disabled={disabled}
      />
    </div>
  );
}
