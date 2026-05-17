import React from 'react';
import styles from './StageIdentityOverlay.module.css';

/**
 * Single stage-level identity chip (cinema / presentation focus).
 */
export default function StageIdentityOverlay({
  displayName = 'Participant',
  roleLabel = '',
  isYou = false
}) {
  const name = String(displayName || 'Participant').trim() || 'Participant';

  return (
    <div
      className={styles.overlay}
      role="status"
      aria-label={`${name}${roleLabel ? `, ${roleLabel}` : ''}${isYou ? ', you' : ''}`}
    >
      <span className={styles.name}>{name}</span>
      {roleLabel ? <span className={styles.role}>{roleLabel}</span> : null}
    </div>
  );
}
