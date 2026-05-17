import React from 'react';
import styles from './PresentationTeachingLabel.module.css';

/**
 * Calm label when viewing shared teaching content (not a webinar chrome).
 */
export default function PresentationTeachingLabel({ variant = 'lecturer_presentation' }) {
  const isStudent = variant === 'student_presentation';
  const title = isStudent ? 'Student presentation' : 'Instructor presentation';
  const hint = isStudent ? 'Shared by a classmate' : 'Teaching content';

  return (
    <div className={styles.label} role="status">
      <span className={styles.title}>{title}</span>
      <span className={styles.hint}>{hint}</span>
    </div>
  );
}
