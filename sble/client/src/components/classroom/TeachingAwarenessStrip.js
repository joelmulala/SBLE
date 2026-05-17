import React, { useMemo } from 'react';
import styles from './TeachingAwarenessStrip.module.css';

/**
 * Compact instructor awareness (replaces dense metrics dashboard).
 */
export default function TeachingAwarenessStrip({ participants = [] }) {
  const list = Array.isArray(participants) ? participants : [];

  const stats = useMemo(() => {
    const joined = list.length;
    const hands = list.filter((p) => p.raisedHand).length;
    const presenting = list.filter((p) => p.screenSharing).length;
    const speaking = list.filter((p) => p.speaking || p.isDominant).length;
    return { joined, hands, presenting, speaking };
  }, [list]);

  return (
    <div className={styles.strip} aria-label="Classroom awareness">
      <span className={styles.chip}>
        <span className={styles.value}>{stats.joined}</span>
        <span className={styles.label}>Joined</span>
      </span>
      <span className={[styles.chip, stats.hands > 0 && styles.chipAlert].filter(Boolean).join(' ')}>
        <span className={styles.value}>{stats.hands}</span>
        <span className={styles.label}>Hands</span>
      </span>
      <span className={styles.chip}>
        <span className={styles.value}>{stats.speaking}</span>
        <span className={styles.label}>Speaking</span>
      </span>
      {stats.presenting > 0 ? (
        <span className={styles.chip}>
          <span className={styles.value}>{stats.presenting}</span>
          <span className={styles.label}>Presenting</span>
        </span>
      ) : null}
    </div>
  );
}
