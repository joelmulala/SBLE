import React, { useMemo } from 'react';
import MediaStateIndicators from './MediaStateIndicators';
import ParticipantStatusBadges from './ParticipantStatusBadges';
import { sortParticipantsForClassroom } from '../../services/classroom/classroomParticipantUtils';
import styles from './ParticipantRoster.module.css';

/**
 * @param {{
 *   participants: import('../../services/classroom/ClassroomMediaAdapter').ClassroomParticipant[],
 *   sessionUserRole?: 'lecturer' | 'student' | 'admin',
 *   instructorView?: boolean,
 *   showModerationActions?: boolean,
 *   moderationDisabled?: boolean,
 *   onModerateParticipant?: (participantId: string, action: string) => void
 * }} props
 */
export default function ParticipantRoster({
  participants,
  sessionUserRole = 'student',
  instructorView = false,
  showModerationActions = false,
  moderationDisabled = false,
  onModerateParticipant
}) {
  const sorted = useMemo(
    () => sortParticipantsForClassroom(Array.isArray(participants) ? participants : []),
    [participants]
  );

  const roleLine = (p) => {
    const cr = p.classroomRole || (p.isModerator ? 'lecturer' : 'student');
    if (p.isLocal && (sessionUserRole === 'lecturer' || cr === 'lecturer' || cr === 'admin')) {
      return 'Instructor';
    }
    if (p.isLocal && sessionUserRole === 'student') return 'You';
    if (!p.isLocal && (cr === 'lecturer' || cr === 'admin')) return 'Instructor';
    if (!p.isLocal && cr === 'student') return 'Student';
    if (!p.isLocal && p.isModerator) return 'Moderator';
    if (!p.isLocal) return 'Participant';
    return '';
  };

  const badge = (p) => {
    const cr = p.classroomRole || (p.isModerator ? 'lecturer' : 'student');
    if (cr === 'admin') return 'Admin';
    if (cr === 'lecturer') return 'Instructor';
    if (cr === 'student') return 'Student';
    return '';
  };

  if (!sorted.length) {
    return <p className={styles.empty}>No one listed yet.</p>;
  }

  return (
    <ul className={styles.list}>
      {sorted.map((p) => {
        const lect =
          p.classroomRole === 'lecturer' || p.classroomRole === 'admin' || p.isModerator;
        const signalStudent = instructorView && !lect && (p.hasQuestion || p.raisedHand);
        const signalQuestion = instructorView && p.hasQuestion;
        return (
        <li
          key={String(p.id)}
          className={[
            styles.row,
            p.isLocal && styles.rowLocal,
            (p.isDominant || p.speaking) && styles.rowSpeaking,
            lect && styles.rowLecturer,
            signalStudent && styles.rowSignalStudent,
            signalQuestion && styles.rowSignalQuestion
          ].filter(Boolean).join(' ')}
        >
          <div className={styles.rowTop}>
          <div className={styles.rowMain}>
            <div className={styles.nameRow}>
              <span className={styles.name}>{p.name || 'Participant'}</span>
              {badge(p) ? (
                <span className={styles.roleBadge}>{badge(p)}</span>
              ) : null}
            </div>
            <div className={styles.meta}>
              {roleLine(p)}
              {(p.isDominant || p.speaking) ? ' · Speaking' : ''}
            </div>
          </div>
          <div className={styles.rowRight}>
            <MediaStateIndicators
              micOn={p.micOn !== false}
              cameraOn={p.cameraOn !== false}
              screenSharing={Boolean(p.screenSharing)}
              speaking={Boolean(p.speaking || p.isDominant)}
              raisedHand={Boolean(p.raisedHand)}
              hasQuestion={Boolean(p.hasQuestion)}
            />
            <div className={styles.tags}>
              <ParticipantStatusBadges participant={p} />
              {p.screenSharing ? <span className={styles.tag}>Screen</span> : null}
            </div>
          </div>
          </div>
          {showModerationActions && instructorView && !lect && !p.isLocal && typeof onModerateParticipant === 'function' ? (
            <div className={styles.rowActions}>
              <button
                type="button"
                className={styles.quickMute}
                disabled={moderationDisabled || p.micOn === false}
                onClick={() => onModerateParticipant(String(p.id), 'mute_microphone')}
              >
                Mute mic
              </button>
              {p.screenSharing ? (
                <button
                  type="button"
                  className={styles.quickAction}
                  disabled={moderationDisabled}
                  onClick={() => onModerateParticipant(String(p.id), 'stop_screen_share')}
                >
                  Stop share
                </button>
              ) : null}
            </div>
          ) : null}
        </li>
        );
      })}
    </ul>
  );
}
