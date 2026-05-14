import React from 'react';
import styles from './LiveStageBadge.module.css';

/**
 * Top-left live identity pill on the video stage (mockup-aligned).
 */
export default function LiveStageBadge({ displayName = 'You', roleLabel = 'Participant' }) {
  return (
    <div className={styles.badge} role="status">
      <span className={styles.liveRow}>
        <span className={styles.liveDot} aria-hidden />
        <span className={styles.liveText}>Live</span>
      </span>
      <span className={styles.name}>{displayName}</span>
      <span className={styles.role}>{roleLabel}</span>
    </div>
  );
}
