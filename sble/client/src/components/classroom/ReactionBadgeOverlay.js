import React from 'react';
import styles from './ReactionBadgeOverlay.module.css';

const ACK_ICON = {
  understood: '✅',
  agree: '🤝',
  ready: '👂',
  listening: '👂'
};

/**
 * Subtle academic presence badges (non-interactive).
 * @param {{ raisedHand?: boolean, hasQuestion?: boolean, participationAck?: string | null }} props
 */
export default function ReactionBadgeOverlay({
  raisedHand = false,
  hasQuestion = false,
  participationAck = null
}) {
  const ackIcon = participationAck && ACK_ICON[participationAck] ? ACK_ICON[participationAck] : null;

  if (!raisedHand && !hasQuestion && !ackIcon) return null;

  return (
    <div className={styles.wrap} aria-hidden>
      {raisedHand ? (
        <span className={styles.badge} title="Hand raised">
          🤚
        </span>
      ) : null}
      {hasQuestion ? (
        <span className={styles.badge} title="Question">
          ❓
        </span>
      ) : null}
      {ackIcon ? (
        <span className={styles.badge} title="Acknowledgement">
          {ackIcon}
        </span>
      ) : null}
    </div>
  );
}
