import React from 'react';
import EmbeddedRoomPanel from './EmbeddedRoomPanel';
import ClassroomChatPanel from './ClassroomChatPanel';
import ParticipantRoster from './ParticipantRoster';
import SessionMetricsPanel from './SessionMetricsPanel';
import LecturerControlsPanel from './LecturerControlsPanel';
import LiveAttendanceBadge from './LiveAttendanceBadge';
import styles from './EmbeddedRoomPanels.module.css';

/**
 * Stacked chat + people overlays inside the live video shell (mockup-aligned).
 */
export default function EmbeddedRoomPanels({
  chatOpen,
  peopleOpen,
  onCloseChat,
  onClosePeople,
  notesOpen,
  onCloseNotes,
  chatMessages,
  localIdentity,
  onChatSend,
  chatDisabled,
  participants,
  sessionUserRole,
  showLecturerTools,
  classroomSession,
  onToggleParticipationLock,
  onReclaimPresentation,
  onModerationRequestDecision,
  onModerateParticipant,
  mediaSessionActive,
  sessionNotes,
  onSessionNotesChange
}) {
  const peopleTitle = `People (${participants.length})`;

  return (
    <div className={styles.stack} aria-hidden={!chatOpen && !peopleOpen && !notesOpen}>
      {chatOpen ? (
        <EmbeddedRoomPanel title="Chat" open stack="top" onClose={onCloseChat}>
          <div className={styles.chatHost}>
            <ClassroomChatPanel
              messages={chatMessages}
              localIdentity={localIdentity}
              onSend={onChatSend}
              disabled={chatDisabled}
            />
          </div>
        </EmbeddedRoomPanel>
      ) : null}

      {peopleOpen ? (
        <EmbeddedRoomPanel
          title={peopleTitle}
          open
          stack={chatOpen ? 'bottom' : 'top'}
          onClose={onClosePeople}
        >
          <div className={styles.peopleScroll}>
            {showLecturerTools ? (
              <>
                <div className={styles.peopleMeta}>
                  <LiveAttendanceBadge active />
                </div>
                <SessionMetricsPanel participants={participants} />
                <LecturerControlsPanel
                  requests={classroomSession.requests}
                  participationLocked={classroomSession.participationLocked}
                  onToggleParticipationLock={onToggleParticipationLock}
                  onReclaimPresentation={onReclaimPresentation}
                  onRequestDecision={onModerationRequestDecision}
                  disabled={!mediaSessionActive}
                />
              </>
            ) : null}
            <ParticipantRoster
              participants={participants}
              sessionUserRole={sessionUserRole}
              instructorView={showLecturerTools}
              showModerationActions
              moderationDisabled={!mediaSessionActive}
              onModerateParticipant={onModerateParticipant}
            />
          </div>
        </EmbeddedRoomPanel>
      ) : null}

      {notesOpen ? (
        <EmbeddedRoomPanel title="Notes" open stack="top" onClose={onCloseNotes}>
          <label className={styles.notesLabel}>
            <span className={styles.notesHint}>Private notes (this device only)</span>
            <textarea
              className={styles.notesArea}
              value={sessionNotes}
              onChange={(e) => onSessionNotesChange(e.target.value)}
              rows={10}
              placeholder="Key points, questions to ask…"
            />
          </label>
        </EmbeddedRoomPanel>
      ) : null}
    </div>
  );
}
