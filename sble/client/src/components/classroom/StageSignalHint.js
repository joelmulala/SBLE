import React from 'react';
import styles from './StageSignalHint.module.css';

/** Subtle connection hint (bottom-left of stage). */
export default function StageSignalHint({ reconnecting = false }) {
  return (
    <div
      className={[styles.wrap, reconnecting && styles.wrapWarn].filter(Boolean).join(' ')}
      title={reconnecting ? 'Reconnecting…' : 'Connected'}
      aria-hidden
    >
      <span className={styles.bar} />
      <span className={styles.bar} />
      <span className={styles.bar} />
      <span className={styles.bar} />
    </div>
  );
}
