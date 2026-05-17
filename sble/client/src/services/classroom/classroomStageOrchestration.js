import { Track } from 'livekit-client';
import { parseClassroomMetadata } from './classroomParticipantUtils';

export function isLecturerParticipant(p) {
  const r = parseClassroomMetadata(p.metadata).role;
  return r === 'lecturer' || r === 'admin';
}

export function hasScreenShareTrack(p) {
  return Boolean(p?.getTrackPublication?.(Track.Source.ScreenShare)?.track);
}

export function getRoomParticipants(room) {
  if (!room) return [];
  return [room.localParticipant, ...Array.from(room.remoteParticipants.values())];
}

export function findLecturerParticipant(room) {
  return getRoomParticipants(room).find((p) => isLecturerParticipant(p)) || null;
}

/**
 * Single active presentation: lecturer share wins over student share.
 * @returns {{ mode: 'discussion'|'lecturer_presentation'|'student_presentation', presenter: import('livekit-client').Participant | null, studentSharePending: boolean }}
 */
export function resolvePresentationState(room) {
  if (!room) {
    return { mode: 'discussion', presenter: null, studentSharePending: false };
  }
  const all = getRoomParticipants(room);
  const lecturerPresenter = all.find((p) => isLecturerParticipant(p) && hasScreenShareTrack(p));
  if (lecturerPresenter) {
    return {
      mode: 'lecturer_presentation',
      presenter: lecturerPresenter,
      studentSharePending: false
    };
  }
  const studentPresenter = all.find((p) => !isLecturerParticipant(p) && hasScreenShareTrack(p));
  if (studentPresenter) {
    return {
      mode: 'student_presentation',
      presenter: studentPresenter,
      studentSharePending: true
    };
  }
  return { mode: 'discussion', presenter: null, studentSharePending: false };
}

/**
 * Dock excludes active presenter (their content is on the presentation surface).
 * Lecturer-first sort; when student presents, lecturer remains first for awareness.
 */
export function getDockParticipants(room, presenterIdentity) {
  const all = getRoomParticipants(room).filter((p) => p.identity !== presenterIdentity);
  return [...all].sort((a, b) => {
    const la = isLecturerParticipant(a) ? 0 : 1;
    const lb = isLecturerParticipant(b) ? 0 : 1;
    if (la !== lb) return la - lb;
    return String(a.name || a.identity).localeCompare(String(b.name || b.identity));
  });
}

/**
 * Camera PIP while someone is screen-sharing: lecturer camera (self or remote).
 * When lecturer presents, PIP is the same person — still show their camera tile if enabled.
 */
export function resolvePipCameraParticipant(room, presentationMode, presenter) {
  if (!room || !presenter) return null;
  if (presentationMode === 'lecturer_presentation') {
    const cam = presenter.getTrackPublication(Track.Source.Camera)?.track;
    return cam ? presenter : null;
  }
  if (presentationMode === 'student_presentation') {
    const lect = findLecturerParticipant(room);
    if (!lect || lect.identity === presenter.identity) return null;
    return lect.getTrackPublication(Track.Source.Camera)?.track ? lect : null;
  }
  return null;
}

/** Participants above this count fall back to grid when no one is actively speaking. */
const GRID_FALLBACK_MIN = 6;

/**
 * Teaching stage priority in discussion mode (after presentation):
 * 1) lecturer active speaker 2) student active speaker 3) instructor presence (small groups)
 * 4) grid fallback (null spotlight) for larger idle classes.
 * @param {import('livekit-client').Room | null} room
 * @param {string | null} primarySpeakerId
 * @returns {string | null}
 */
export function resolveDiscussionSpotlightIdentity(room, primarySpeakerId) {
  if (!room) return null;
  const all = getRoomParticipants(room);
  if (!all.length) return null;
  if (all.length === 1) return all[0].identity;

  const primary = primarySpeakerId
    ? all.find((p) => p.identity === primarySpeakerId)
    : null;

  if (primary) {
    if (isLecturerParticipant(primary)) return primary.identity;
    return primary.identity;
  }

  if (all.length >= GRID_FALLBACK_MIN) return null;

  const lect = all.find((p) => isLecturerParticipant(p));
  if (lect) return lect.identity;

  return all[0].identity;
}

/**
 * @param {import('livekit-client').Room | null} room
 * @param {string | null} primarySpeakerId
 * @returns {'cinema'|'spotlight'|'grid'}
 */
export function resolveDiscussionLayoutKind(room, primarySpeakerId) {
  if (!room) return 'grid';
  const all = getRoomParticipants(room);
  if (!all.length) return 'grid';
  if (all.length === 1) return 'cinema';
  const spotlightId = resolveDiscussionSpotlightIdentity(room, primarySpeakerId);
  if (!spotlightId) return 'grid';
  return 'spotlight';
}
