import React from 'react';
import styles from './SessionControlBar.module.css';

/**
 * @param {{
 *   participationLocked: boolean,
 *   onToggleLock: () => void,
 *   onReclaimPresentation: () => void,
 *   disabled?: boolean
 * }} props
 */
export default function SessionControlBar({
  participationLocked,
  onToggleLock,
  onReclaimPresentation,
  disabled = false
}) {
  return (
    <div className={styles.bar} role="toolbar" aria-label="Session controls">
      <button
        type="button"
        className={participationLocked ? styles.btnOn : styles.btn}
        disabled={disabled}
        onClick={onToggleLock}
        aria-pressed={participationLocked}
      >
        {participationLocked ? 'Unlock participation' : 'Lock participation'}
      </button>
      <button type="button" className={styles.btn} disabled={disabled} onClick={onReclaimPresentation}>
        Reclaim presentation
      </button>
    </div>
  );
}
