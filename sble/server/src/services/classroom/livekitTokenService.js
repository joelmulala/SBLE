const { AccessToken } = require('livekit-server-sdk');
const { apiKey, apiSecret, wsUrl } = require('../../config/livekit');

/** @typedef {'lecturer' | 'student' | 'admin'} ClassroomTokenRole */

const DEFAULT_TTL_SECONDS = 15 * 60;

/**
 * @param {object} params
 * @param {object} params.room SBLE Room row (course_id, room_token)
 * @param {{ id: string, name?: string, email?: string }} params.user
 * @param {ClassroomTokenRole} params.classroomRole Resolved SBLE classroom role for this session
 * @param {{ ttlSeconds?: number }} [params.options]
 * @returns {Promise<{ serverUrl: string, roomName: string, participantToken: string, expiresAt: string }>}
 */
async function issueLiveKitParticipantToken({ room, user, classroomRole, options = {} }) {
  const key = apiKey();
  const secret = apiSecret();
  const serverUrl = wsUrl();
  if (!key || !secret || !serverUrl) {
    const err = new Error('LiveKit is not configured');
    err.status = 503;
    throw err;
  }

  const ttlSeconds = Number.isFinite(options.ttlSeconds) && options.ttlSeconds > 0
    ? Math.min(options.ttlSeconds, 3600)
    : DEFAULT_TTL_SECONDS;

  const roomName = String(room.room_token);
  const identity = String(user.id);
  const displayName = String(user.name || user.email || 'Participant').trim() || 'Participant';

  const metadata = JSON.stringify({
    role: classroomRole,
    courseId: room.course_id,
    roomToken: roomName
  });

  const isPrivileged = classroomRole === 'lecturer' || classroomRole === 'admin';

  const grant = {
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true
  };

  if (isPrivileged) {
    grant.roomAdmin = true;
    grant.roomRecord = true;
  }

  const at = new AccessToken(key, secret, {
    identity,
    name: displayName,
    ttl: ttlSeconds,
    metadata
  });

  at.addGrant(grant);

  const participantToken = await at.toJwt();
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

  return {
    serverUrl,
    roomName,
    participantToken,
    expiresAt
  };
}

module.exports = {
  issueLiveKitParticipantToken,
  DEFAULT_TTL_SECONDS
};
