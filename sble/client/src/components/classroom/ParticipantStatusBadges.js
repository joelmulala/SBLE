import React from 'react';
import styles from './ParticipantStatusBadges.module.css';

const ACK_LABEL = {
  understood: 'Understood',
  agree: 'Agree',
  ready: 'Listening',
  listening: 'Listening'
};

/**
 * Calm textual badges for classroom participation (not emoji reactions).
 * @param {{ participant: import('../../services/classroom/ClassroomMediaAdapter').ClassroomParticipant }} props
 */
export default function ParticipantStatusBadges({ participant }) {
  const p = participant || {};
  const hasAny = Boolean(p.raisedHand || p.hasQuestion || p.participationAck);
  if (!hasAny) return null;

  return (
    <div className={styles.badges} aria-label="Participation signals">
      {p.raisedHand ? (
        <span className={`${styles.badge} ${styles.badgeHand}`}>Hand</span>
      ) : null}
      {p.hasQuestion ? (
        <span className={`${styles.badge} ${styles.badgeQuestion}`}>Question</span>
      ) : null}
      {p.participationAck ? (
        <span className={`${styles.badge} ${styles.badgeAck}`}>
          {ACK_LABEL[p.participationAck] || p.participationAck}
        </span>
      ) : null}
    </div>
  );
}
