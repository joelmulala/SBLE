import React from 'react';
import styles from './TeachingSessionBanner.module.css';

const MODE_LABEL = {
  discussion: 'Class discussion',
  lecturer_presentation: 'Instructor presenting',
  student_presentation: 'Student presenting'
};

/**
 * Calm in-stage session context (join count, mode, hands, timer).
 */
export default function TeachingSessionBanner({
  layoutMode = 'discussion',
  joinedCount = 0,
  handsRaised = 0,
  elapsed = '',
  showHands = false,
  reconnecting = false
}) {
  const modeLabel = MODE_LABEL[layoutMode] || 'Live class';

  return (
    <div className={styles.banner} role="status" aria-live="polite">
      <span className={styles.mode}>{reconnecting ? 'Reconnecting…' : modeLabel}</span>
      <span className={styles.sep} aria-hidden>·</span>
      <span className={styles.stat}>{joinedCount} joined</span>
      {elapsed ? (
        <>
          <span className={styles.sep} aria-hidden>·</span>
          <span className={styles.stat}>{elapsed}</span>
        </>
      ) : null}
      {showHands && handsRaised > 0 ? (
        <>
          <span className={styles.sep} aria-hidden>·</span>
          <span className={styles.hands}>
            {handsRaised} hand{handsRaised === 1 ? '' : 's'} raised
          </span>
        </>
      ) : null}
    </div>
  );
}
