import { ClassroomMediaAdapter } from './ClassroomMediaAdapter';

const JITSI_API_SCRIPT = 'https://meet.jit.si/external_api.js';
const JITSI_DOMAIN = 'meet.jit.si';

function pickParticipantIdFromPayload(payload) {
  if (!payload || typeof payload !== 'object') return null;
  return (
    payload.participant?._id
    || payload.participant?.id
    || payload.id
    || payload.participantId
    || null
  );
}

function loadJitsiScript() {
  return new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && window.JitsiMeetExternalAPI) {
      resolve();
      return;
    }

    const existingScript = document.querySelector(`script[src="${JITSI_API_SCRIPT}"]`);
    if (existingScript) {
      existingScript.addEventListener('load', resolve, { once: true });
      existingScript.addEventListener('error', reject, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = JITSI_API_SCRIPT;
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.body.appendChild(script);
  });
}

/**
 * Jitsi Meet (iframe / External API) implementation of {@link ClassroomMediaAdapter}.
 */
export class JitsiClassroomMediaAdapter extends ClassroomMediaAdapter {
  /** @type {import('./ClassroomMediaAdapter').ClassroomConnectOptions | null} */
  _connectOptions = null;

  /** @type {any} */
  _api = null;

  _connectStarted = false;

  /** @type {import('./ClassroomMediaAdapter').ClassroomParticipant[]} */
  _participants = [];

  _getDisposed = () => false;

  _exec(command, value) {
    try {
      const apiInst = this._api;
      if (!apiInst || typeof apiInst.executeCommand !== 'function') return;
      if (value !== undefined) apiInst.executeCommand(command, value);
      else apiInst.executeCommand(command);
    } catch (_) { /* ignore */ }
  }

  _notifyParticipants() {
    this._emitParticipants(this._participants.map((p) => ({ ...p })));
  }

  _attachParticipantSignals(jitsiApi) {
    const syncRaiseHand = (payload) => {
      const pid = pickParticipantIdFromPayload(payload);
      const raised = payload?.raisedHand ?? payload?.handRaised ?? payload?.raised;
      if (pid == null) return;
      this._participants = this._participants.map((p) => (
        String(p.id) === String(pid) ? { ...p, raisedHand: Boolean(raised) } : p
      ));
      this._notifyParticipants();
    };

    const syncDominant = (payload) => {
      const id = payload?.id;
      this._participants = this._participants.map((p) => {
        const dom = id != null && String(p.id) === String(id);
        return {
          ...p,
          isDominant: dom,
          speaking: dom
        };
      });
      this._notifyParticipants();
    };

    try {
      jitsiApi.addEventListener('raiseHandUpdated', syncRaiseHand);
    } catch (_) { /* optional */ }
    try {
      jitsiApi.addEventListener('dominantSpeakerChanged', syncDominant);
    } catch (_) { /* optional */ }
  }

  _disposeApi() {
    if (this._api) {
      try {
        this._api.dispose();
      } catch (_) { /* ignore */ }
      this._api = null;
    }
    this._participants = [];
    this._connectStarted = false;
  }

  /**
   * @param {import('./ClassroomMediaAdapter').ClassroomConnectOptions} options
   */
  connect(options) {
    if (this._connectStarted) return;
    this._connectStarted = true;
    this._connectOptions = options;
    this._getDisposed = typeof options.getDisposed === 'function' ? options.getDisposed : () => false;

    this._emitConnection({ type: 'connecting' });

    loadJitsiScript()
      .then(() => {
        if (this._getDisposed()) return;
        try {
          this._createMeeting();
        } catch (_) {
          this._connectStarted = false;
          this._emitConnection({ type: 'start_error', message: 'Could not start the meeting. Try again.' });
        }
      })
      .catch(() => {
        this._connectStarted = false;
        if (!this._getDisposed()) {
          this._emitConnection({ type: 'script_error', message: 'Could not open the classroom. Try again.' });
        }
      });
  }

  _createMeeting() {
    if (this._getDisposed() || typeof window === 'undefined' || !window.JitsiMeetExternalAPI) return;

    const container = this._connectOptions?.container;
    if (!container) {
      requestAnimationFrame(() => {
        if (!this._getDisposed()) this._createMeeting();
      });
      return;
    }

    const role = this._connectOptions?.role || 'student';
    const displayName = this._connectOptions?.displayName || 'User';
    const roomName = this._connectOptions?.roomId;
    const isLecturer = role === 'lecturer';

    const jitsiOptions = {
      roomName,
      parentNode: container,
      userInfo: {
        displayName,
        role: isLecturer ? 'moderator' : 'participant'
      },
      configOverwrite: {
        enableUserRolesBasedOnToken: false,
        prejoinPageEnabled: false,
        prejoinConfig: { enabled: false },
        enableLobby: false,
        startWithAudioMuted: false,
        startWithVideoMuted: false,
        disableDeepLinking: true,
        enableWelcomePage: false,
        requireDisplayName: false,
        disableProfile: true,
        disableSelfDemote: true,
        readOnlyName: !isLecturer,
        disableRemoteMute: true,
        disableInviteFunctions: true,
        enableInsecureRoomNameWarning: false,
        localRecording: { enabled: isLecturer },
        fileRecordingsEnabled: isLecturer,
        remoteVideoMenu: isLecturer
          ? { disableKick: false, disableGrantModerator: false }
          : { disableKick: true, disableGrantModerator: true }
      },
      interfaceConfigOverwrite: {
        SHOW_JITSI_WATERMARK: false,
        SHOW_BRAND_WATERMARK: false,
        SHOW_POWERED_BY: false,
        SHOW_PROMOTIONAL_CLOSE_PAGE: false,
        DISPLAY_WELCOME_PAGE_CONTENT: false,
        SHOW_DEEP_LINKING_IMAGE: false,
        MOBILE_APP_PROMO: false,
        APP_NAME: 'SBLE Live Class',
        NATIVE_APP_NAME: 'SBLE Live Class',
        TOOLBAR_BUTTONS: ['raisehand', 'settings']
      }
    };

    const jitsiApi = new window.JitsiMeetExternalAPI(JITSI_DOMAIN, jitsiOptions);
    this._api = jitsiApi;

    this._attachParticipantSignals(jitsiApi);

    jitsiApi.addEventListener('videoConferenceJoined', (event) => {
      if (this._getDisposed()) return;
      this._emitConnection({
        type: 'session_joined',
        localId: event.id,
        displayName,
        role
      });
      const exists = this._participants.some((p) => p.id === event.id);
      if (!exists) {
        this._participants = [...this._participants, {
          id: event.id,
          name: displayName,
          isLocal: true,
          raisedHand: false,
          hasQuestion: false,
          participationAck: null,
          isDominant: false,
          speaking: false,
          isModerator: isLecturer,
          classroomRole: isLecturer ? 'lecturer' : 'student',
          micOn: true,
          cameraOn: true,
          screenSharing: false,
          joinedAt: null
        }];
      }
      this._notifyParticipants();
    });

    jitsiApi.addEventListener('videoConferenceLeft', () => {
      if (this._getDisposed()) return;
      this._emitConnection({ type: 'local_left_session', role });
    });

    jitsiApi.addEventListener('participantJoined', (event) => {
      const exists = this._participants.some((p) => p.id === event.id);
      if (!exists) {
        this._participants = [...this._participants, {
          id: event.id,
          name: event.displayName || 'Participant',
          isLocal: false,
          raisedHand: false,
          hasQuestion: false,
          participationAck: null,
          isDominant: false,
          speaking: false,
          isModerator: Boolean(event.isModerator),
          classroomRole: event.isModerator ? 'lecturer' : 'student',
          micOn: true,
          cameraOn: true,
          screenSharing: false,
          joinedAt: null
        }];
      }
      this._notifyParticipants();
    });

    jitsiApi.addEventListener('participantLeft', (event) => {
      this._participants = this._participants.filter((p) => p.id !== event.id);
      this._notifyParticipants();
    });

    jitsiApi.addEventListener('readyToClose', () => {
      if (!this._getDisposed()) {
        this._emitConnection({ type: 'session_ready' });
      }
    });
  }

  disconnect() {
    this._disposeApi();
    this._participants = [];
    this._connectOptions = null;
    this._getDisposed = () => false;
  }

  leaveRoom() {
    this.disconnect();
  }

  toggleMic() {
    this._exec('toggleAudio');
  }

  toggleCamera() {
    this._exec('toggleVideo');
  }

  toggleScreenShare() {
    this._exec('toggleShareScreen');
  }

  toggleRaiseHand() {
    this._exec('toggleRaiseHand');
  }

  openClassroomChat() {
    this._exec('toggleChat');
  }
}

/**
 * @returns {JitsiClassroomMediaAdapter}
 */
export function createJitsiClassroomMediaAdapter() {
  return new JitsiClassroomMediaAdapter();
}
