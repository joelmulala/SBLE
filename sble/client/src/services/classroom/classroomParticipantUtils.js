/**
 * Shared ordering / detection helpers for SBLE classroom roster & stage (LiveKit-first).
 */

/** @param {string | undefined} metadata */
export function parseClassroomMetadata(metadata) {
  if (!metadata || typeof metadata !== 'string') {
    return { role: 'student', courseId: undefined, roomToken: undefined };
  }
  try {
    const m = JSON.parse(metadata);
    const role = m.role === 'admin' || m.role === 'lecturer' || m.role === 'student' ? m.role : 'student';
    return {
      role,
      courseId: m.courseId,
      roomToken: m.roomToken
    };
  } catch (_) {
    return { role: 'student', courseId: undefined, roomToken: undefined };
  }
}

/**
 * Prefer lecturer/admin among LiveKit activeSpeakers for UI highlight (calm, academic).
 * @param {{ activeSpeakers?: import('livekit-client').Participant[] } | null} room
 * @returns {string | null} identity
 */
export function resolvePrimarySpeakerIdentity(room) {
  const speakers = room?.activeSpeakers || [];
  if (!speakers.length) return null;
  const lect = speakers.find((s) => {
    const r = parseClassroomMetadata(s.metadata).role;
    return r === 'lecturer' || r === 'admin';
  });
  return (lect || speakers[0]).identity;
}

/**
 * @param {import('./ClassroomMediaAdapter').ClassroomParticipant[]} rows
 */
export function sortParticipantsForClassroom(rows) {
  const rank = (r) => {
    const role = r.classroomRole || (r.isModerator ? 'lecturer' : 'student');
    if (role === 'admin') return 0;
    if (role === 'lecturer') return 1;
    return 2;
  };
  const signalBoost = (r) => {
    let v = 0;
    if (r.hasQuestion) v += 4;
    if (r.raisedHand) v += 2;
    return v;
  };
  return [...rows].sort((a, b) => {
    const d = rank(a) - rank(b);
    if (d !== 0) return d;
    const sb = signalBoost(b) - signalBoost(a);
    if (sb !== 0) return sb;
    const an = String(a.name || '').toLowerCase();
    const bn = String(b.name || '').toLowerCase();
    if (an !== bn) return an.localeCompare(bn);
    return String(a.id).localeCompare(String(b.id));
  });
}
