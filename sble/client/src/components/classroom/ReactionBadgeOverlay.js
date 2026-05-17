import React from 'react';
import styles from './ReactionBadgeOverlay.module.css';

const ACK_ICON = {
  understood: '✅',
  agree: '🤝'
};

/**
 * Subtle academic presence badges (raise hand, understood, agree only).
 */
export default function ReactionBadgeOverlay({
  raisedHand = false,
  participationAck = null
}) {
  const ackIcon = participationAck && ACK_ICON[participationAck] ? ACK_ICON[participationAck] : null;

  if (!raisedHand && !ackIcon) return null;

  return (
    <div className={styles.wrap} aria-hidden>
      {raisedHand ? (
        <span className={styles.badge} title="Hand raised">
          🤚
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
