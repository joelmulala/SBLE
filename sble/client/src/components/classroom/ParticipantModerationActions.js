import React from 'react';
import styles from './ParticipantModerationActions.module.css';

const ACTIONS = [
  { key: 'mute_microphone', label: 'Mute mic' },
  { key: 'camera_off', label: 'Cam off' },
  { key: 'stop_screen_share', label: 'Stop share' },
  { key: 'remove_participant', label: 'Remove' }
];

/**
 * @param {{
 *   participantId: string,
 *   onAction: (participantId: string, action: string) => void,
 *   disabled?: boolean
 * }} props
 */
export default function ParticipantModerationActions({ participantId, onAction, disabled = false }) {
  return (
    <div className={styles.wrap} role="group" aria-label="Instructor actions">
      {ACTIONS.map((a) => (
        <button
          key={a.key}
          type="button"
          className={styles.btn}
          disabled={disabled}
          onClick={() => onAction(participantId, a.key)}
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}
