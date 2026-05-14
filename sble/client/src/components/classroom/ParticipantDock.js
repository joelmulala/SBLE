import React from 'react';
import ParticipantTile from './ParticipantTile';
import { isLecturerParticipant } from '../../services/classroom/classroomStageOrchestration';
import styles from './ParticipantDock.module.css';

/**
 * Secondary participant tiles (discussion grid or presentation dock).
 * @param {{
 *   room: import('livekit-client').Room,
 *   participants: import('livekit-client').Participant[],
 *   primarySpeakerId?: string | null,
 *   layout: 'grid' | 'dock' | 'filmstrip',
 *   emphasizeLecturer?: boolean,
 *   compact?: boolean,
 *   presenceByIdentity?: Record<string, { raisedHand?: boolean, hasQuestion?: boolean, participationAck?: string | null }>
 * }} props
 */
export default function ParticipantDock({
  room,
  participants,
  primarySpeakerId = null,
  layout,
  emphasizeLecturer = false,
  compact = false,
  presenceByIdentity = {}
}) {
  if (!room || !participants?.length) {
    return null;
  }

  const rootClass = [
    layout === 'grid' && styles.dockGrid,
    layout === 'dock' && styles.dockStrip,
    layout === 'filmstrip' && styles.dockFilmstrip,
    layout === 'grid' && compact && styles.dockGridCompact,
    layout === 'dock' && compact && styles.dockStripCompact,
    layout === 'filmstrip' && compact && styles.dockFilmstripCompact
  ].filter(Boolean).join(' ');

  return (
    <div className={rootClass} role="list" aria-label="Participants">
      {participants.map((p, idx) => {
        const lect = isLecturerParticipant(p);
        const emphasize = emphasizeLecturer && lect && idx === 0;
        const sig = presenceByIdentity[p.identity] || {};
        const tileVariant = layout === 'grid' ? 'grid' : layout === 'filmstrip' ? 'strip' : 'dock';
        return (
          <div
            key={p.identity}
            className={[
              layout === 'dock' ? styles.dockCell : styles.gridCell,
              layout === 'filmstrip' && styles.filmstripCell,
              emphasize && styles.dockCellEmphasis
            ].filter(Boolean).join(' ')}
          >
            <ParticipantTile
              room={room}
              participant={p}
              variant={tileVariant}
              isPrimarySpeaker={primarySpeakerId === p.identity}
              isLecturerRole={lect}
              dimmed={layout === 'dock' && !emphasize}
              signals={sig}
            />
          </div>
        );
      })}
    </div>
  );
}
