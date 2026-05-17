import React from 'react';
import SessionControlBar from './SessionControlBar';
import PresentationRequestQueue from './PresentationRequestQueue';
import styles from './LecturerControlsPanel.module.css';

/**
 * @param {{
 *   requests: Array<{ id: string, kind: string, name?: string, actor: string }>,
 *   participationLocked: boolean,
 *   onToggleParticipationLock: () => void,
 *   onReclaimPresentation: () => void,
 *   onRequestDecision: (requestId: string, decision: 'approve'|'reject') => void,
 *   disabled?: boolean
 * }} props
 */
export default function LecturerControlsPanel({
  requests,
  participationLocked,
  onToggleParticipationLock,
  onReclaimPresentation,
  onRequestDecision,
  disabled = false
}) {
  return (
    <section className={styles.panel} aria-label="Instructor classroom controls">
      <h3 className={styles.heading}>Session</h3>
      <SessionControlBar
        participationLocked={participationLocked}
        onToggleLock={onToggleParticipationLock}
        onReclaimPresentation={onReclaimPresentation}
        disabled={disabled}
      />
      <PresentationRequestQueue requests={requests} onDecision={onRequestDecision} disabled={disabled} />
    </section>
  );
}
