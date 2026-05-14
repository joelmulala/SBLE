import React, { useMemo } from 'react';
import styles from './SessionMetricsPanel.module.css';

/**
 * Live roster metrics for instructor awareness (RTC-derived).
 * @param {{ participants: Array<{ raisedHand?: boolean, hasQuestion?: boolean, screenSharing?: boolean, speaking?: boolean, isDominant?: boolean, classroomRole?: string, isModerator?: boolean }> }} props
 */
export default function SessionMetricsPanel({ participants }) {
  const list = Array.isArray(participants) ? participants : [];

  const metrics = useMemo(() => {
    const count = list.length;
    const hands = list.filter((p) => p.raisedHand).length;
    const questions = list.filter((p) => p.hasQuestion).length;
    const presenting = list.filter((p) => p.screenSharing).length;
    const speaking = list.filter((p) => p.speaking || p.isDominant).length;
    return { count, hands, questions, presenting, speaking };
  }, [list]);

  return (
    <section className={styles.wrap} aria-label="Live session metrics">
      <h3 className={styles.title}>Session metrics</h3>
      <dl className={styles.grid}>
        <div className={styles.cell}>
          <dt>Joined</dt>
          <dd>{metrics.count}</dd>
        </div>
        <div className={styles.cell}>
          <dt>Hands raised</dt>
          <dd>{metrics.hands}</dd>
        </div>
        <div className={styles.cell}>
          <dt>Questions</dt>
          <dd>{metrics.questions}</dd>
        </div>
        <div className={styles.cell}>
          <dt>Presenting</dt>
          <dd>{metrics.presenting}</dd>
        </div>
        <div className={styles.cell}>
          <dt>Speaking</dt>
          <dd>{metrics.speaking}</dd>
        </div>
      </dl>
    </section>
  );
}
