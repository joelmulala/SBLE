import React from 'react';
import styles from './MediaStateIndicators.module.css';

/**
 * Compact mic / camera / screen / speaking indicators for roster or tile chrome.
 * @param {{
 *   micOn?: boolean,
 *   cameraOn?: boolean,
 *   screenSharing?: boolean,
 *   speaking?: boolean,
 *   raisedHand?: boolean,
 *   hasQuestion?: boolean,
 *   compact?: boolean
 * }} props
 */
export default function MediaStateIndicators({
  micOn = true,
  cameraOn = true,
  screenSharing = false,
  speaking = false,
  raisedHand = false,
  hasQuestion = false,
  compact = true
}) {
  const cls = compact ? styles.wrap : styles.wrapComfortable;

  return (
    <div className={cls} aria-hidden>
      <span
        className={`${styles.dot} ${micOn ? styles.dotOn : styles.dotOff}`}
        title={micOn ? 'Microphone on' : 'Microphone off'}
      >
        M
      </span>
      <span
        className={`${styles.dot} ${cameraOn ? styles.dotOn : styles.dotOff}`}
        title={cameraOn ? 'Camera on' : 'Camera off'}
      >
        C
      </span>
      {screenSharing ? (
        <span className={`${styles.dot} ${styles.dotScreen}`} title="Sharing screen">
          S
        </span>
      ) : null}
      {speaking ? (
        <span className={`${styles.dot} ${styles.dotSpeak}`} title="Speaking">
          ·
        </span>
      ) : null}
      {raisedHand ? (
        <span className={`${styles.dot} ${styles.dotHand}`} title="Hand raised">
          H
        </span>
      ) : null}
      {hasQuestion ? (
        <span className={`${styles.dot} ${styles.dotQuestion}`} title="Has a question">
          ?
        </span>
      ) : null}
    </div>
  );
}
