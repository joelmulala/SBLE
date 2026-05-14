const { RoomServiceClient } = require('livekit-server-sdk');
const { TrackSource } = require('@livekit/protocol');
const { apiKey, apiSecret, wsUrl } = require('../../config/livekit');

function httpHostFromWs(ws) {
  const u = String(ws || '').trim();
  if (u.startsWith('wss://')) return `https://${u.slice(6)}`;
  if (u.startsWith('ws://')) return `http://${u.slice(5)}`;
  return u;
}

function getRoomService() {
  const host = httpHostFromWs(wsUrl());
  return new RoomServiceClient(host, apiKey(), apiSecret());
}

/**
 * @param {{ roomName: string, targetIdentity?: string, action: string, lecturerIdentity?: string }} params
 */
async function moderateParticipant({ roomName, targetIdentity, action, lecturerIdentity }) {
  const svc = getRoomService();
  const room = String(roomName || '').trim();
  const identity = String(targetIdentity || '').trim();
  const lec = String(lecturerIdentity || '').trim();

  if (!room) {
    const err = new Error('roomName is required');
    err.status = 400;
    throw err;
  }

  if (action === 'reclaim_presentations') {
    const list = await svc.listParticipants(room);
    let muted = 0;
    for (const p of list) {
      if (lec && p.identity === lec) continue;
      const tracks = p.tracks || [];
      for (const tr of tracks) {
        const src = Number(tr.source);
        if (src === TrackSource.SCREEN_SHARE || src === TrackSource.SCREEN_SHARE_AUDIO) {
          if (tr.sid) {
            await svc.mutePublishedTrack(room, p.identity, tr.sid, true);
            muted += 1;
          }
        }
      }
    }
    return { ok: true, action, muted };
  }

  if (!identity) {
    const err = new Error('participantIdentity is required');
    err.status = 400;
    throw err;
  }

  if (action === 'remove_participant') {
    await svc.removeParticipant(room, identity);
    return { ok: true, action };
  }

  const participant = await svc.getParticipant(room, identity);
  const tracks = participant.tracks || [];

  if (action === 'mute_microphone') {
    const t = tracks.find((tr) => Number(tr.source) === TrackSource.MICROPHONE);
    if (!t?.sid) return { ok: false, error: 'No microphone track' };
    await svc.mutePublishedTrack(room, identity, t.sid, true);
    return { ok: true, action };
  }

  if (action === 'camera_off') {
    const t = tracks.find((tr) => Number(tr.source) === TrackSource.CAMERA);
    if (!t?.sid) return { ok: false, error: 'No camera track' };
    await svc.mutePublishedTrack(room, identity, t.sid, true);
    return { ok: true, action };
  }

  if (action === 'stop_screen_share') {
    let muted = 0;
    for (const tr of tracks) {
      const src = Number(tr.source);
      if (src === TrackSource.SCREEN_SHARE || src === TrackSource.SCREEN_SHARE_AUDIO) {
        if (tr.sid) {
          await svc.mutePublishedTrack(room, identity, tr.sid, true);
          muted += 1;
        }
      }
    }
    return { ok: muted > 0, action, muted };
  }

  const err = new Error('Unknown moderation action');
  err.status = 400;
  throw err;
}

module.exports = {
  moderateParticipant,
  getRoomService
};
