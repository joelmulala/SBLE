/**
 * Transport-agnostic classroom media contract (LiveKit).
 *
 * @typedef {'lecturer' | 'student'} ClassroomRole
 *
 * @typedef {Object} ClassroomConnectOptions
 * @property {string} roomId
 * @property {string} displayName
 * @property {ClassroomRole} role
 * @property {HTMLElement} [container] Legacy embed parent; unused for LiveKit.
 * @property {() => boolean} [getDisposed] When true, adapter must stop scheduling work and ignore late events.
 * @property {(handle: unknown) => void} [onRtcRoom] Optional: e.g. LiveKit `Room` instance when connected, or `null` when torn down.
 */

/**
 * Normalized participant row for SBLE UI (roster, raise hand, dominant speaker).
 *
 * @typedef {Object} ClassroomParticipant
 * @property {string|number} id
 * @property {string} name
 * @property {boolean} isLocal
 * @property {boolean} raisedHand
 * @property {boolean} isDominant
 * @property {boolean} isModerator
 * @property {'lecturer'|'student'|'admin'} [classroomRole]
 * @property {boolean} [micOn]
 * @property {boolean} [cameraOn]
 * @property {boolean} [screenSharing]
 * @property {boolean} [speaking]
 * @property {string|null} [joinedAt] ISO timestamp when known
 * @property {boolean} [hasQuestion]
 * @property {'understood'|'agree'|'ready'|'listening'|null} [participationAck] transient acknowledgement signal
 */

/**
 * @typedef {Object} ClassroomChatUserMessage
 * @property {'user'} kind
 * @property {string} id
 * @property {number} t
 * @property {string} identity
 * @property {string} name
 * @property {'lecturer'|'student'|'admin'} role
 * @property {string} body
 */

/**
 * @typedef {Object} ClassroomSessionState
 * @property {Array<{ id: string, actor: string, kind: string, t: number, name?: string }>} requests
 * @property {boolean} participationLocked
 * @property {{ message: string, targetIdentity?: string|null }|undefined} [notice]
 */

/**
 * @typedef {Object} ClassroomConnectionEvent
 * @property {'connecting'|'session_joined'|'session_ready'|'session_disconnected'|'reconnecting'|'reconnected'|'local_left_session'|'script_error'|'start_error'|'device_warning'} type
 * @property {string} [message]
 * @property {string|number} [localId]
 * @property {string} [displayName]
 * @property {ClassroomRole} [role]
 */

/**
 * Abstract classroom media adapter. Subclasses implement transport-specific behavior.
 */
export class ClassroomMediaAdapter {
  /** @type {((participants: ClassroomParticipant[]) => void) | null} */
  _onParticipantsChanged = null;

  /** @type {((event: ClassroomConnectionEvent) => void) | null} */
  _onConnectionStateChanged = null;

  /** @type {((msg: ClassroomChatUserMessage) => void) | null} */
  _onClassroomChatMessage = null;

  /** @type {((state: ClassroomSessionState) => void) | null} */
  _onClassroomSessionState = null;

  /**
   * @param {ClassroomConnectOptions} _options
   * @returns {void|Promise<void>}
   */
  connect(_options) {
    throw new Error('ClassroomMediaAdapter.connect() must be implemented by transport');
  }

  disconnect() {
    throw new Error('ClassroomMediaAdapter.disconnect() must be implemented by transport');
  }

  toggleMic() {
    throw new Error('ClassroomMediaAdapter.toggleMic() must be implemented by transport');
  }

  toggleCamera() {
    throw new Error('ClassroomMediaAdapter.toggleCamera() must be implemented by transport');
  }

  toggleScreenShare() {
    throw new Error('ClassroomMediaAdapter.toggleScreenShare() must be implemented by transport');
  }

  /**
   * Local user leaves the media session (hang up / dispose). Same as disconnect for current transports.
   */
  leaveRoom() {
    throw new Error('ClassroomMediaAdapter.leaveRoom() must be implemented by transport');
  }

  toggleRaiseHand() {
    throw new Error('ClassroomMediaAdapter.toggleRaiseHand() must be implemented by transport');
  }

  /** Student / instructor question signal (LiveKit data channel). */
  toggleQuestionSignal() {}

  /** Toggle understood / agree until clicked again (LiveKit data channel). */
  toggleParticipationAck(_kind) {}

  /** Lightweight acknowledgement pulse (LiveKit data channel). */
  sendParticipationAck(_kind) {}

  /** In-room text chat (LiveKit data channel when supported). */
  sendChatMessage(_text) {}

  /**
   * @param {(msg: ClassroomChatUserMessage) => void} callback
   */
  onClassroomChatMessage(callback) {
    this._onClassroomChatMessage = typeof callback === 'function' ? callback : null;
  }

  /** @param {ClassroomChatUserMessage} msg */
  _emitClassroomChat(msg) {
    this._onClassroomChatMessage?.(msg);
  }

  /**
   * @param {(state: ClassroomSessionState) => void} callback
   */
  onClassroomSessionState(callback) {
    this._onClassroomSessionState = typeof callback === 'function' ? callback : null;
  }

  /** @param {ClassroomSessionState} payload */
  _emitClassroomSessionState(payload) {
    this._onClassroomSessionState?.(payload);
  }

  /** @param {string} _identity */
  /** @param {string} _action */
  async moderateRemoteParticipant(_identity, _action) {}

  async reclaimPresentations() {}

  requestPresentationAccess() {}

  requestSpeakingTurn() {}

  cancelModerationRequest() {}

  /** @param {string} _requestId */
  /** @param {'approve'|'reject'} _decision */
  approveModerationRequest(_requestId, _decision) {}

  /** @param {boolean} _locked */
  setParticipationLocked(_locked) {}

  /**
   * Open or focus in-session text chat (transport-specific UI, if any).
   */
  openClassroomChat() {
    throw new Error('ClassroomMediaAdapter.openClassroomChat() must be implemented by transport');
  }

  /**
   * @param {(participants: ClassroomParticipant[]) => void} callback
   */
  onParticipantsChanged(callback) {
    this._onParticipantsChanged = typeof callback === 'function' ? callback : null;
  }

  /**
   * @param {(event: ClassroomConnectionEvent) => void} callback
   */
  onConnectionStateChanged(callback) {
    this._onConnectionStateChanged = typeof callback === 'function' ? callback : null;
  }

  /** @param {ClassroomParticipant[]} participants */
  _emitParticipants(participants) {
    this._onParticipantsChanged?.(participants);
  }

  /** @param {ClassroomConnectionEvent} event */
  _emitConnection(event) {
    this._onConnectionStateChanged?.(event);
  }
}
