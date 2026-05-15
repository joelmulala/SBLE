import React from 'react';
import ParticipantDock from './ParticipantDock';
import ParticipantTile from './ParticipantTile';
import { isLecturerParticipant } from '../../services/classroom/classroomStageOrchestration';
import styles from './ClassroomStageLayout.module.css';

/**
 * Discussion-mode layouts: solo cinema, spotlight + filmstrip, or balanced grid.
 * @param {{
 *   room: import('livekit-client').Room,
 *   participants: import('livekit-client').Participant[],
 *   spotlightId: string | null,
 *   primarySpeakerId: string | null,
 *   sidebarOpen?: boolean,
 *   presenceByIdentity?: Record<string, { raisedHand?: boolean, hasQuestion?: boolean, participationAck?: string | null }>
 * }} props
 */
export default function ClassroomStageLayout({
  room,
  participants,
  spotlightId,
  primarySpeakerId,
  sidebarOpen = false,
  presenceByIdentity = {}
}) {
  if (!room) {
    return null;
  }

  const roster = participants?.length
    ? participants
    : (room.localParticipant ? [room.localParticipant] : []);

  if (!roster.length) {
    return null;
  }

  const signalsFor = (identity) => presenceByIdentity[identity] || {};

  if (roster.length === 1) {
    const p = roster[0];
    return (
      <div className={styles.cinema} data-sidebar={sidebarOpen ? 'open' : 'closed'}>
        <ParticipantTile
          room={room}
          participant={p}
          variant="cinema"
          isPrimarySpeaker={primarySpeakerId === p.identity}
          isLecturerRole={isLecturerParticipant(p)}
          signals={signalsFor(p.identity)}
        />
      </div>
    );
  }

  const spotlight = spotlightId ? roster.find((x) => x.identity === spotlightId) : null;
  const others = spotlight
    ? roster.filter((x) => x.identity !== spotlight.identity)
    : roster;

  if (spotlight && others.length) {
    return (
      <div className={styles.spotlightSplit} data-sidebar={sidebarOpen ? 'open' : 'closed'}>
        <div className={styles.spotlightMain}>
          <ParticipantTile
            room={room}
            participant={spotlight}
            variant="cinema"
            isPrimarySpeaker={primarySpeakerId === spotlight.identity}
            isLecturerRole={isLecturerParticipant(spotlight)}
            signals={signalsFor(spotlight.identity)}
          />
        </div>
        <ParticipantDock
          room={room}
          participants={others}
          primarySpeakerId={primarySpeakerId}
          layout="filmstrip"
          emphasizeLecturer={false}
          compact={sidebarOpen}
          presenceByIdentity={presenceByIdentity}
        />
      </div>
    );
  }

  return (
    <ParticipantDock
      room={room}
      participants={roster}
      primarySpeakerId={primarySpeakerId}
      layout="grid"
      emphasizeLecturer={false}
      compact={sidebarOpen}
      presenceByIdentity={presenceByIdentity}
    />
  );
}
