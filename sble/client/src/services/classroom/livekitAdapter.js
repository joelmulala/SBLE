import {
  Room,
  RoomEvent,
  Track
} from 'livekit-client';
import { ClassroomMediaAdapter } from './ClassroomMediaAdapter';
import api from '../../config/api';
import {
  parseClassroomMetadata,
  resolvePrimarySpeakerIdentity
} from './classroomParticipantUtils';
import {
  ACK_DISPLAY_MS,
  decodeParticipationPayload,
  encodeParticipationPayload
} from './classroomParticipationData';
import {
  decodeChatUserPayload,
  encodeChatUserPayload,
  sanitizeBody
} from './classroomChatData';
import {
  decodeModerationRequest,
  decodeModerationDecision,
  decodeSessionControl,
  encodeModerationRequest,
  encodeModerationDecision,
  encodeSessionControl
} from './classroomModerationData';

/** Max automatic getDisplayMedia retries after a screen-share track ends while sharing is still intended. */
const SCREEN_SHARE_MAX_AUTO_RESUMES = 2;

/**
 * Delay before re-requesting screen capture (ms). Override with REACT_APP_LIVEKIT_SCREEN_RESUME_MS (200–5000).
 * Defaults are slightly higher on Windows where the capture pipeline often needs more settle time.
 */
function getScreenShareResumeDelayMs() {
  const fromEnv = Number(process.env.REACT_APP_LIVEKIT_SCREEN_RESUME_MS);
  if (Number.isFinite(fromEnv) && fromEnv >= 200 && fromEnv <= 5000) {
    return Math.round(fromEnv);
  }
  try {
    const platform = typeof navigator !== 'undefined'
      ? (navigator.userAgentData?.platform || navigator.platform || '')
      : '';
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
    if (/Win/i.test(platform)) return 780;
    if (/Mac/i.test(platform)) return 620;
    if (/Linux/i.test(platform)) return 700;
    if (/Android/i.test(ua)) return 850;
  } catch (_) {
    /* ignore */
  }
  return 650;
}

function isLecturerLike(metadata) {
  const meta = parseClassroomMetadata(metadata);
  return meta.role === 'lecturer' || meta.role === 'admin';
}

/** User-facing hint when getUserMedia / LiveKit track publish fails. */
function describeDeviceError(kind, err) {
  const raw = String(err?.message || err || '').trim();
  const lower = raw.toLowerCase();

  if (kind === 'camera' && (/timeout/i.test(raw) || /video source/i.test(lower))) {
    return 'Camera did not start in time. Close other apps using the camera, allow browser camera access, then tap the camera button to retry.';
  }
  if (/notallowed|permission|denied/i.test(raw)) {
    return kind === 'camera'
      ? 'Camera access was blocked. Allow camera permission in your browser, then retry from the camera button.'
      : 'Microphone access was blocked. Allow microphone permission in your browser, then retry from the mic button.';
  }
  if (/notfound|devicesnotfound|no device/i.test(lower)) {
    return kind === 'camera'
      ? 'No camera was found on this device.'
      : 'No microphone was found on this device.';
  }
  if (/notreadable|in use|busy/i.test(lower)) {
    return kind === 'camera'
      ? 'Camera is in use by another application. Close it and use the camera button to retry.'
      : 'Microphone is in use by another application.';
  }

  return kind === 'camera'
    ? (raw || 'Could not start camera. Use the camera button to retry.')
    : (raw || 'Could not start microphone. Use the mic button to retry.');
}

/**
 * Enable local mic/camera without failing the room connection.
 * @returns {Promise<string[]>} non-fatal warnings for the UI
 */
async function enableLocalAvTracks(localParticipant) {
  const warnings = [];

  try {
    await localParticipant.setMicrophoneEnabled(true);
  } catch (err) {
    warnings.push(describeDeviceError('microphone', err));
  }

  try {
    await localParticipant.setCameraEnabled(true);
  } catch (err) {
    warnings.push(describeDeviceError('camera', err));
  }

  return warnings;
}

function participantToRow(participant, isLocal, room, localJoinIso, participationMap) {
  const meta = parseClassroomMetadata(participant.metadata);
  const sbRole = meta.role || 'student';
  const displayName = participant.name || participant.identity || 'Participant';
  const isModerator = sbRole === 'lecturer' || sbRole === 'admin';
  const dominantIdentity = resolvePrimarySpeakerIdentity(room);
  const speaking = Boolean(participant.isSpeaking);
  let joinedAt = null;
  if (isLocal) {
    joinedAt = localJoinIso || null;
  } else if (participant.joinedAt) {
    joinedAt = participant.joinedAt instanceof Date
      ? participant.joinedAt.toISOString()
      : new Date(participant.joinedAt).toISOString();
  }

  const extra = participationMap.get(participant.identity) || {};
  let participationAck = null;
  if (extra.ack === 'understood' || extra.ack === 'agree') {
    participationAck = extra.ack;
  } else if (
    extra.ack === 'listening'
    && typeof extra.ackTs === 'number'
    && (Date.now() - extra.ackTs < ACK_DISPLAY_MS)
  ) {
    participationAck = extra.ack;
  }

  return {
    id: participant.identity,
    name: displayName,
    isLocal,
    raisedHand: Boolean(extra.raisedHand),
    hasQuestion: Boolean(extra.hasQuestion),
    participationAck,
    isDominant: dominantIdentity != null && participant.identity === dominantIdentity,
    speaking,
    isModerator,
    classroomRole: sbRole,
    micOn: Boolean(participant.isMicrophoneEnabled),
    cameraOn: Boolean(participant.isCameraEnabled),
    screenSharing: Boolean(participant.isScreenShareEnabled),
    joinedAt
  };
}
/**
 * LiveKit client implementation of {@link ClassroomMediaAdapter}.
 */
export class LiveKitClassroomMediaAdapter extends ClassroomMediaAdapter {
  /** @type {Map<string, { raisedHand?: boolean, hasQuestion?: boolean, ack?: string|null, ackTs?: number|null }>} */
  _participation = new Map();

  /** @type {ReturnType<typeof setTimeout> | null} */
  _screenResumeTimer = null;

  /** Auto-resume attempts after track `ended` for the current share session (reset when a new screen track publishes). */
  _screenShareAutoResumeCount = 0;

  /** User intent: keep screen share session active (survive track-ended / surface switches). */
  _screenShareUserWants = false;

  /** @type {import('livekit-client').ScreenShareCaptureOptions} */
  _screenShareCaptureOptions = {
    audio: true,
    video: true,
    surfaceSwitching: 'include',
    selfBrowserSurface: 'include',
    systemAudio: 'include',
    contentHint: 'detail'
  };

  _hookScreenShareTrack = (publication) => {
    if (publication.source !== Track.Source.ScreenShare || !publication.track) return;
    this._screenShareAutoResumeCount = 0;
    const mst = publication.track.mediaStreamTrack;
    if (!mst) return;
    mst.addEventListener('ended', this._onScreenShareTrackEnded);
  };

  _unhookScreenShareTrack = (publication) => {
    if (publication.source !== Track.Source.ScreenShare || !publication.track) return;
    const mst = publication.track.mediaStreamTrack;
    if (!mst) return;
    mst.removeEventListener('ended', this._onScreenShareTrackEnded);
  };

  _onScreenShareTrackEnded = () => {
    if (this._getDisposed() || !this._room) return;
    if (!this._screenShareUserWants) return;
    const lp = this._room.localParticipant;
    if (!lp) return;
    if (this._screenResumeTimer) clearTimeout(this._screenResumeTimer);
    const delay = getScreenShareResumeDelayMs();
    this._screenResumeTimer = setTimeout(() => {
      this._screenResumeTimer = null;
      if (this._getDisposed() || !this._room || !this._screenShareUserWants) return;
      if (lp.isScreenShareEnabled) return;
      if (this._screenShareAutoResumeCount >= SCREEN_SHARE_MAX_AUTO_RESUMES) return;
      this._screenShareAutoResumeCount += 1;
      lp.setScreenShareEnabled(true, this._screenShareCaptureOptions).catch(() => {});
    }, delay);
  };


  /** @type {Array<{ id: string, actor: string, kind: string, t: number, name?: string }>} */
  _moderationQueue = [];

  _participationLocked = false;

  /** @type {import('./ClassroomMediaAdapter').ClassroomConnectOptions | null} */
  _connectOptions = null;

  /** @type {Room | null} */
  _room = null;

  _connectStarted = false;

  _connecting = false;

  _intentionalDisconnect = false;

  _getDisposed = () => false;

  /** @type {'lecturer' | 'student'} */
  _sbRole = 'student';

  _detachRoomListeners = null;

  /** @type {string | null} */
  _localJoinIso = null;

  _notifyRtcRoom(room) {
    const fn = this._connectOptions?.onRtcRoom;
    if (typeof fn === 'function') fn(room);
  }

  _syncParticipants() {
    if (!this._room) return;
    this._pruneParticipationMap();
    const map = this._participation;
    const rows = [];
    rows.push(
      participantToRow(this._room.localParticipant, true, this._room, this._localJoinIso, map)
    );
    this._room.remoteParticipants.forEach((p) => {
      rows.push(participantToRow(p, false, this._room, null, map));
    });
    this._emitParticipants(rows);
  }

  _pruneParticipationMap() {
    const room = this._room;
    if (!room) return;
    const valid = new Set([room.localParticipant.identity]);
    room.remoteParticipants.forEach((p) => {
      valid.add(p.identity);
    });
    this._participation.forEach((_v, id) => {
      if (!valid.has(id)) this._participation.delete(id);
    });
  }

  /**
   * @param {{ message: string, targetIdentity?: string|null } | undefined} notice
   */
  _emitClassroomSessionStatePayload(notice) {
    this._emitClassroomSessionState({
      requests: [...this._moderationQueue],
      participationLocked: this._participationLocked,
      notice: notice?.message
        ? { message: notice.message, targetIdentity: notice.targetIdentity || null }
        : undefined
    });
  }

  _onRoomDataReceived = (payload, participant) => {
    if (this._getDisposed() || !this._room || !payload?.byteLength) return;

    const parsedPart = decodeParticipationPayload(payload);
    if (parsedPart) {
      if (participant && participant.identity !== parsedPart.identity) return;
      const known = parsedPart.identity === this._room.localParticipant.identity
        || this._room.remoteParticipants.has(parsedPart.identity);
      if (!known) return;

      this._participation.set(parsedPart.identity, {
        raisedHand: parsedPart.raisedHand,
        hasQuestion: parsedPart.hasQuestion,
        ack: parsedPart.ack,
        ackTs: parsedPart.ackTs
      });
      this._syncParticipants();
      return;
    }

    const chat = decodeChatUserPayload(payload);
    if (chat) {
      if (participant && participant.identity !== chat.identity) return;
      const knownChat = chat.identity === this._room.localParticipant.identity
        || this._room.remoteParticipants.has(chat.identity);
      if (!knownChat) return;

      this._emitClassroomChat({
        kind: 'user',
        id: chat.id,
        t: chat.t,
        identity: chat.identity,
        name: chat.name,
        role: chat.role,
        body: chat.body
      });
      return;
    }

    const sessionCtl = decodeSessionControl(payload);
    if (sessionCtl) {
      const lp = this._room.localParticipant;
      const ok = participant
        ? (isLecturerLike(participant.metadata) && participant.identity === sessionCtl.actor)
        : (this._sbRole === 'lecturer' && lp.identity === sessionCtl.actor);
      if (!ok) return;
      this._participationLocked = Boolean(sessionCtl.participationLocked);
      this._emitClassroomSessionStatePayload();
      return;
    }

    const modReq = decodeModerationRequest(payload);
    if (modReq) {
      const lp = this._room.localParticipant;
      const senderOk = (participant && participant.identity === modReq.actor)
        || (!participant && lp.identity === modReq.actor);
      if (!senderOk) return;

      if (modReq.kind === 'cancel') {
        this._moderationQueue = this._moderationQueue.filter((x) => x.actor !== modReq.actor);
      } else {
        this._moderationQueue = this._moderationQueue.filter(
          (x) => !(x.actor === modReq.actor && x.kind === modReq.kind)
        );
        const name = participant?.name || lp.name || '';
        this._moderationQueue.push({
          id: modReq.id,
          actor: modReq.actor,
          kind: modReq.kind,
          t: modReq.t,
          name
        });
        if (this._moderationQueue.length > 40) this._moderationQueue.splice(0, this._moderationQueue.length - 40);
      }
      this._emitClassroomSessionStatePayload();
      return;
    }

    const modDec = decodeModerationDecision(payload);
    if (modDec) {
      const lp = this._room.localParticipant;
      const modOk = participant
        ? (isLecturerLike(participant.metadata) && participant.identity === modDec.moderator)
        : (this._sbRole === 'lecturer' && lp.identity === modDec.moderator);
      if (!modOk) return;

      this._moderationQueue = this._moderationQueue.filter((x) => x.id !== modDec.requestId);

      const notice = modDec.target && lp.identity === modDec.target
        ? {
            message: modDec.decision === 'approve'
              ? (modDec.kind === 'presentation'
                ? 'Instructor approved your presentation request.'
                : 'Instructor approved your speaking request.')
              : 'Instructor declined your request.',
            targetIdentity: modDec.target
          }
        : undefined;

      this._emitClassroomSessionStatePayload(notice);
      return;
    }
  };

  async _publishLocalParticipation() {
    const room = this._room;
    const lp = room?.localParticipant;
    if (!room || !lp || this._getDisposed()) return;
    const id = lp.identity;
    const st = this._participation.get(id) || {};
    const body = encodeParticipationPayload({
      identity: id,
      raisedHand: Boolean(st.raisedHand),
      hasQuestion: Boolean(st.hasQuestion),
      ack: st.ack || null,
      ackTs: typeof st.ackTs === 'number' ? st.ackTs : null
    });
    try {
      await lp.publishData(body, { reliable: true });
    } catch (_) { /* ignore */ }
  }

  _bindRoom(room) {
    const onParticipants = () => this._syncParticipants();
    const onLocalPub = (publication, participant) => {
      onParticipants();
      if (participant === room.localParticipant) {
        this._hookScreenShareTrack(publication);
      }
    };
    const onLocalUnpub = (publication, participant) => {
      if (participant === room.localParticipant) {
        this._unhookScreenShareTrack(publication);
      }
      onParticipants();
    };

    room.on(RoomEvent.ParticipantConnected, onParticipants);
    room.on(RoomEvent.ParticipantDisconnected, onParticipants);
    room.on(RoomEvent.ActiveSpeakersChanged, onParticipants);
    room.on(RoomEvent.TrackSubscribed, onParticipants);
    room.on(RoomEvent.TrackUnsubscribed, onParticipants);
    room.on(RoomEvent.LocalTrackPublished, onLocalPub);
    room.on(RoomEvent.LocalTrackUnpublished, onLocalUnpub);
    room.on(RoomEvent.ParticipantMetadataChanged, onParticipants);
    room.on(RoomEvent.ParticipantNameChanged, onParticipants);
    room.on(RoomEvent.TrackMuted, onParticipants);
    room.on(RoomEvent.TrackUnmuted, onParticipants);
    room.on(RoomEvent.Reconnected, onParticipants);
    room.on(RoomEvent.DataReceived, this._onRoomDataReceived);
    room.on(RoomEvent.Disconnected, this._onDisconnected);

    this._detachRoomListeners = () => {
      room.off(RoomEvent.ParticipantConnected, onParticipants);
      room.off(RoomEvent.ParticipantDisconnected, onParticipants);
      room.off(RoomEvent.ActiveSpeakersChanged, onParticipants);
      room.off(RoomEvent.TrackSubscribed, onParticipants);
      room.off(RoomEvent.TrackUnsubscribed, onParticipants);
      room.off(RoomEvent.LocalTrackPublished, onLocalPub);
      room.off(RoomEvent.LocalTrackUnpublished, onLocalUnpub);
      room.off(RoomEvent.ParticipantMetadataChanged, onParticipants);
      room.off(RoomEvent.ParticipantNameChanged, onParticipants);
      room.off(RoomEvent.TrackMuted, onParticipants);
      room.off(RoomEvent.TrackUnmuted, onParticipants);
      room.off(RoomEvent.Reconnected, onParticipants);
      room.off(RoomEvent.DataReceived, this._onRoomDataReceived);
      room.off(RoomEvent.Disconnected, this._onDisconnected);
    };
  }

  _detachListeners() {
    if (typeof this._detachRoomListeners === 'function') {
      try {
        this._detachRoomListeners();
      } catch (_) { /* ignore */ }
      this._detachRoomListeners = null;
    }
  }

  _applyDisconnectedCleanup() {
    if (this._ackClearTimer) {
      clearTimeout(this._ackClearTimer);
      this._ackClearTimer = null;
    }
    if (this._screenResumeTimer) {
      clearTimeout(this._screenResumeTimer);
      this._screenResumeTimer = null;
    }
    this._screenShareUserWants = false;
    this._screenShareAutoResumeCount = 0;
    this._participation.clear();
    this._moderationQueue = [];
    this._participationLocked = false;
    this._detachListeners();
    this._room = null;
    this._localJoinIso = null;
    this._notifyRtcRoom(null);
    this._emitParticipants([]);
    this._emitClassroomSessionState({
      requests: [],
      participationLocked: false,
      notice: undefined
    });
    this._connectStarted = false;
    this._connecting = false;
    this._connectOptions = null;
    this._getDisposed = () => false;
  }

  _onDisconnected = () => {
    if (this._getDisposed()) return;
    const intentional = this._intentionalDisconnect;
    this._intentionalDisconnect = false;
    this._applyDisconnectedCleanup();
    if (!intentional && this._sbRole === 'lecturer') {
      this._emitConnection({ type: 'local_left_session', role: 'lecturer' });
    }
  };

  /**
   * @param {import('./ClassroomMediaAdapter').ClassroomConnectOptions} options
   */
  connect(options) {
    if (this._connectStarted || this._connecting) return;
    this._connecting = true;
    this._connectStarted = true;
    this._connectOptions = options;
    this._getDisposed = typeof options.getDisposed === 'function' ? options.getDisposed : () => false;
    this._sbRole = options.role === 'lecturer' ? 'lecturer' : 'student';

    this._emitConnection({ type: 'connecting' });

    this._runConnect(options).finally(() => {
      this._connecting = false;
    });
  }

  /**
   * @param {import('./ClassroomMediaAdapter').ClassroomConnectOptions} options
   */
  async _runConnect(options) {
    const roomId = options.roomId;
    try {
      const res = await api.post(`rooms/${encodeURIComponent(roomId)}/livekit-token`, {});
      if (this._getDisposed()) return;

      const { data, status } = res;
      if (status === 503) {
        this._connectStarted = false;
        this._emitConnection({
          type: 'start_error',
          message: data?.error || 'LiveKit is not configured on the server.'
        });
        return;
      }

      const { serverUrl, participantToken } = data;
      if (!serverUrl || !participantToken) {
        this._connectStarted = false;
        this._emitConnection({
          type: 'start_error',
          message: data?.error || 'Invalid token response from server.'
        });
        return;
      }

      const room = new Room({ adaptiveStream: true, dynacast: true });
      this._room = room;
      this._bindRoom(room);

      await room.connect(serverUrl, participantToken);
      if (this._getDisposed()) {
        this.disconnect();
        return;
      }

      this._localJoinIso = new Date().toISOString();

      room.localParticipant.trackPublications.forEach((pub) => {
        this._hookScreenShareTrack(pub);
      });

      this._notifyRtcRoom(room);
      this._syncParticipants();

      this._emitConnection({
        type: 'session_joined',
        localId: room.localParticipant.identity,
        displayName: options.displayName,
        role: this._sbRole
      });

      const deviceWarnings = await enableLocalAvTracks(room.localParticipant);
      this._syncParticipants();

      this._emitConnection({ type: 'session_ready' });
      deviceWarnings.forEach((message) => {
        this._emitConnection({ type: 'device_warning', message });
      });
      this._emitClassroomSessionStatePayload();
    } catch (err) {
      this._connectStarted = false;
      if (this._room) {
        this._detachListeners();
        try {
          this._room.disconnect();
        } catch (_) { /* ignore */ }
        this._room = null;
      }
      this._localJoinIso = null;
      this._notifyRtcRoom(null);
      this._emitParticipants([]);
      const msg = err?.response?.data?.error
        || err?.response?.data?.message
        || err?.message
        || 'Could not connect to the classroom.';
      const type = err?.response ? 'start_error' : 'script_error';
      this._emitConnection({ type, message: String(msg) });
    }
  }

  disconnect() {
    this._intentionalDisconnect = true;
    const r = this._room;
    if (!r) {
      this._applyDisconnectedCleanup();
      return;
    }
    try {
      r.disconnect();
    } catch (_) {
      this._applyDisconnectedCleanup();
    }
  }

  leaveRoom() {
    this.disconnect();
  }

  toggleMic() {
    const lp = this._room?.localParticipant;
    if (!lp) return;
    const next = !lp.isMicrophoneEnabled;
    lp.setMicrophoneEnabled(next).catch((err) => {
      if (next) {
        this._emitConnection({
          type: 'device_warning',
          message: describeDeviceError('microphone', err)
        });
      }
    });
  }

  toggleCamera() {
    const lp = this._room?.localParticipant;
    if (!lp) return;
    const next = !lp.isCameraEnabled;
    lp.setCameraEnabled(next).catch((err) => {
      if (next) {
        this._emitConnection({
          type: 'device_warning',
          message: describeDeviceError('camera', err)
        });
      }
    });
  }

  toggleScreenShare() {
    const lp = this._room?.localParticipant;
    if (!lp) return;
    const next = !lp.isScreenShareEnabled;
    this._screenShareUserWants = next;
    this._screenShareAutoResumeCount = 0;
    if (this._screenResumeTimer) {
      clearTimeout(this._screenResumeTimer);
      this._screenResumeTimer = null;
    }
    const opts = next ? this._screenShareCaptureOptions : undefined;
    lp.setScreenShareEnabled(next, opts).catch(() => {});
  }

  toggleRaiseHand() {
    const lp = this._room?.localParticipant;
    if (!lp || this._getDisposed()) return;
    const id = lp.identity;
    const cur = this._participation.get(id) || {};
    this._participation.set(id, { ...cur, raisedHand: !cur.raisedHand });
    this._syncParticipants();
    this._publishLocalParticipation().catch(() => {});
  }

  toggleQuestionSignal() {
    const lp = this._room?.localParticipant;
    if (!lp || this._getDisposed()) return;
    const id = lp.identity;
    const cur = this._participation.get(id) || {};
    this._participation.set(id, { ...cur, hasQuestion: !cur.hasQuestion });
    this._syncParticipants();
    this._publishLocalParticipation().catch(() => {});
  }

  sendChatMessage(text) {
    const lp = this._room?.localParticipant;
    const opts = this._connectOptions;
    if (!lp || this._getDisposed()) return;
    const body = sanitizeBody(text);
    if (!body) return;

    const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `m-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const t = Date.now();
    const name = String(opts?.displayName || lp.name || 'Participant').trim() || 'Participant';
    const role = this._sbRole === 'lecturer' ? 'lecturer' : 'student';

    const payload = encodeChatUserPayload({
      id,
      t,
      identity: lp.identity,
      name,
      role,
      body
    });
    this._emitClassroomChat({
      kind: 'user',
      id,
      t,
      identity: lp.identity,
      name,
      role,
      body
    });
    lp.publishData(payload, { reliable: true }).catch(() => {});
  }

  toggleParticipationAck(kind) {
    const allowed = ['understood', 'agree'];
    if (!allowed.includes(kind)) return;
    const lp = this._room?.localParticipant;
    if (!lp || this._getDisposed()) return;
    const id = lp.identity;
    const cur = this._participation.get(id) || {};
    const active = cur.ack === kind;

    if (this._ackClearTimer) {
      clearTimeout(this._ackClearTimer);
      this._ackClearTimer = null;
    }

    if (active) {
      this._participation.set(id, { ...cur, ack: null, ackTs: null });
    } else {
      this._participation.set(id, { ...cur, ack: kind, ackTs: Date.now() });
    }
    this._syncParticipants();
    this._publishLocalParticipation().catch(() => {});
  }

  sendParticipationAck(kind) {
    if (kind === 'understood' || kind === 'agree') {
      this.toggleParticipationAck(kind);
      return;
    }
    if (kind !== 'listening') return;
    const lp = this._room?.localParticipant;
    if (!lp || this._getDisposed()) return;
    const id = lp.identity;
    const cur = this._participation.get(id) || {};
    const ts = Date.now();
    this._participation.set(id, { ...cur, ack: kind, ackTs: ts });
    this._syncParticipants();
    this._publishLocalParticipation().catch(() => {});

    if (this._ackClearTimer) clearTimeout(this._ackClearTimer);
    this._ackClearTimer = setTimeout(() => {
      if (this._getDisposed() || !this._room) return;
      const next = this._participation.get(id);
      if (!next || next.ack !== 'listening') return;
      this._participation.set(id, { ...next, ack: null, ackTs: null });
      this._syncParticipants();
      this._publishLocalParticipation().catch(() => {});
      this._ackClearTimer = null;
    }, ACK_DISPLAY_MS);
  }

  async moderateRemoteParticipant(identity, action) {
    const rid = this._connectOptions?.roomId;
    if (!rid || this._getDisposed()) return;
    await api.post(`/rooms/${encodeURIComponent(rid)}/livekit-moderate`, {
      participantIdentity: identity,
      action
    });
  }

  async reclaimPresentations() {
    const rid = this._connectOptions?.roomId;
    if (!rid || this._getDisposed()) return;
    await api.post(`/rooms/${encodeURIComponent(rid)}/livekit-moderate`, {
      action: 'reclaim_presentations'
    });
  }

  requestPresentationAccess() {
    const lp = this._room?.localParticipant;
    if (!lp || this._getDisposed() || this._participationLocked) return;
    const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `pr-${Date.now()}`;
    const body = encodeModerationRequest({
      kind: 'presentation',
      id,
      actor: lp.identity,
      ts: Date.now()
    });
    lp.publishData(body, { reliable: true }).catch(() => {});
  }

  requestSpeakingTurn() {
    const lp = this._room?.localParticipant;
    if (!lp || this._getDisposed() || this._participationLocked) return;
    const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `sr-${Date.now()}`;
    const body = encodeModerationRequest({
      kind: 'speaking',
      id,
      actor: lp.identity,
      ts: Date.now()
    });
    lp.publishData(body, { reliable: true }).catch(() => {});
  }

  cancelModerationRequest() {
    const lp = this._room?.localParticipant;
    if (!lp || this._getDisposed()) return;
    const body = encodeModerationRequest({
      kind: 'cancel',
      id: `c-${Date.now()}`,
      actor: lp.identity,
      ts: Date.now()
    });
    lp.publishData(body, { reliable: true }).catch(() => {});
  }

  approveModerationRequest(requestId, decision) {
    if (this._sbRole !== 'lecturer' || !requestId || !decision) return;
    const req = this._moderationQueue.find((r) => r.id === requestId);
    const lp = this._room?.localParticipant;
    if (!req || !lp || this._getDisposed()) return;
    const body = encodeModerationDecision({
      requestId,
      decision,
      moderator: lp.identity,
      kind: req.kind,
      target: req.actor
    });
    lp.publishData(body, { reliable: true }).catch(() => {});
    this._moderationQueue = this._moderationQueue.filter((x) => x.id !== requestId);
    this._emitClassroomSessionStatePayload();
  }

  setParticipationLocked(locked) {
    if (this._sbRole !== 'lecturer') return;
    const lp = this._room?.localParticipant;
    if (!lp || this._getDisposed()) return;
    this._participationLocked = Boolean(locked);
    const payload = encodeSessionControl({
      participationLocked: this._participationLocked,
      actor: lp.identity
    });
    lp.publishData(payload, { reliable: true }).catch(() => {});
    this._emitClassroomSessionStatePayload();
  }

  openClassroomChat() {
    /* SBLE sidebar hosts chat for LiveKit. */
  }
}

export function createLiveKitClassroomMediaAdapter() {
  return new LiveKitClassroomMediaAdapter();
}
