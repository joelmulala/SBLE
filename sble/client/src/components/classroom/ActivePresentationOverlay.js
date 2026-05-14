import React from 'react';
import styles from './ActivePresentationOverlay.module.css';

/**
 * @param {{ variant?: 'student_pending' }} props
 */
export default function ActivePresentationOverlay({ variant = 'student_pending' }) {
  if (variant !== 'student_pending') return null;

  return (
    <div className={styles.banner} role="status">
      <span className={styles.title}>Student presentation</span>
      <span className={styles.meta}>Awaiting instructor acknowledgment (preview)</span>
    </div>
  );
}
