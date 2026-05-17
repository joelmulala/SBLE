import React from 'react';
import styles from './ClassroomTransitionBanner.module.css';

const COPY = {
  connecting: 'Joining classroom…',
  reconnecting: 'Reconnecting to class…',
  preparing: 'Preparing video…',
  presentation: 'Switching to presentation view…'
};

/**
 * Lightweight transition feedback inside the video well.
 */
export default function ClassroomTransitionBanner({ variant = 'connecting' }) {
  const message = COPY[variant] || COPY.connecting;

  return (
    <div className={styles.banner} role="status" aria-live="polite">
      <span className={styles.spinner} aria-hidden />
      <span>{message}</span>
    </div>
  );
}
