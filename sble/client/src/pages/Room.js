import React, {
  useEffect, useMemo, useRef, useState, useCallback
} from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useKeycloak } from '../auth/AuthProvider';
import api from '../config/api';
import styles from './Room.module.css';

const JITSI_API_SCRIPT = 'https://meet.jit.si/external_api.js';

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

function normalizeLecturerName(value) {
  if (value == null) return '';
  const s = String(value).trim();
  if (!s) return '';
  const cleaned = s.replace(/\s*[-–—]\s*$/u, '').trim();
  return cleaned || '';
}

function formatElapsed(ms) {
  if (ms == null || ms < 0) return '0:00';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function Room() {
  const { roomId, token } = useParams();
  const { keycloak, initialized } = useKeycloak();
  const jitsiContainerRef = useRef(null);
  const jitsiApiRef = useRef(null);
  const lecturerSessionLiveRef = useRef(false);
  const participantsRef = useRef([]);
  const classroomRootRef = useRef(null);
  const videoShellRef = useRef(null);
  const userNameRef = useRef('User');
  const userRoleRef = useRef('student');
  const startMeetingRef = useRef(() => {});
  const pollRoomStatusRef = useRef(() => {});
  const studentJoinedIntentRef = useRef(false);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [roomDetails, setRoomDetails] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [classEnded, setClassEnded] = useState(false);
  const [endMessage, setEndMessage] = useState('Class has ended');
  const [jitsiSessionActive, setJitsiSessionActive] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState('participants');
  const [sessionNotes, setSessionNotes] = useState('');
  const [sessionStartedAt, setSessionStartedAt] = useState(null);
  const [elapsedTick, setElapsedTick] = useState(0);
  const [lecturerStarted, setLecturerStarted] = useState(false);
  const [studentJoinedIntent, setStudentJoinedIntent] = useState(false);

  const activeRoomId = decodeURIComponent(roomId || token || '').trim();
  const navigate = useNavigate();

  const user = useMemo(() => ({
    name: keycloak.tokenParsed?.name || 'User',
    role: keycloak.hasRealmRole('lecturer') || keycloak.hasRealmRole('admin') ? 'lecturer' : 'student'
  }), [keycloak]);

  userNameRef.current = user.name;
  userRoleRef.current = user.role;

  useEffect(() => {
    participantsRef.current = participants;
  }, [participants]);

  const execJitsi = useCallback((command, value) => {
    try {
      const apiInst = jitsiApiRef.current;
      if (!apiInst || typeof apiInst.executeCommand !== 'function') return;
      if (value !== undefined) apiInst.executeCommand(command, value);
      else apiInst.executeCommand(command);
    } catch (_) { /* ignore */ }
  }, []);

  const disposeJitsi = useCallback(() => {
    if (jitsiApiRef.current) {
      try {
        jitsiApiRef.current.dispose();
      } catch (e) {
        /* ignore */
      }
      jitsiApiRef.current = null;
    }
    setJitsiSessionActive(false);
  }, []);

  const closeRoomOnServer = useCallback(async () => {
    if (!activeRoomId) return;
    try {
      await api.patch(`/rooms/${encodeURIComponent(activeRoomId)}/close`);
    } catch (e) {
      /* idempotent / network */
    }
  }, [activeRoomId]);

  const exitLiveClass = useCallback((message, { closeOnServer = false } = {}) => {
    setEndMessage(message);
    setClassEnded(true);
    disposeJitsi();
    setReconnecting(false);
    studentJoinedIntentRef.current = false;
    setLecturerStarted(false);
    setStudentJoinedIntent(false);
    setSessionStartedAt(null);
    if (closeOnServer && user.role === 'lecturer') {
      closeRoomOnServer();
    }
  }, [closeRoomOnServer, disposeJitsi, user.role]);

  const exitLiveClassRef = useRef(exitLiveClass);
  exitLiveClassRef.current = exitLiveClass;

  useEffect(() => {
    if (!classEnded) return undefined;
    const t = setTimeout(() => {
      navigate('/rooms', { state: { liveClassEnded: true, liveClassMessage: endMessage } });
    }, 2200);
    return () => clearTimeout(t);
  }, [classEnded, endMessage, navigate]);

  useEffect(() => {
    if (!initialized || !keycloak.authenticated || !activeRoomId) return undefined;
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
    const es = new EventSource(`${apiUrl}/notifications/stream?token=${encodeURIComponent(keycloak.token)}`);

    const onEnded = (e) => {
      try {
        const data = JSON.parse(e.data);
        const rid = data.roomId || data.room_id;
        if (rid && String(rid) === String(activeRoomId)) {
          exitLiveClassRef.current('Class has ended', { closeOnServer: false });
        }
      } catch (err) {
        /* ignore */
      }
    };

    const onLiveReady = (e) => {
      try {
        const data = JSON.parse(e.data);
        const rid = data.roomId || data.room_id;
        if (rid && String(rid) === String(activeRoomId)) {
          pollRoomStatusRef.current?.();
        }
      } catch (err) {
        /* ignore */
      }
    };

    es.addEventListener('live-class-ended', onEnded);
    es.addEventListener('live_class_ended', onEnded);
    es.addEventListener('live-class-ready', onLiveReady);
    es.addEventListener('live_class_ready', onLiveReady);
    es.onerror = () => es.close();

    return () => es.close();
  }, [initialized, keycloak.authenticated, keycloak.token, activeRoomId]);

  useEffect(() => {
    if (!jitsiSessionActive || !sessionStartedAt) return undefined;
    const id = setInterval(() => setElapsedTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [jitsiSessionActive, sessionStartedAt]);

  const elapsedDisplay = useMemo(() => {
    if (!sessionStartedAt) return '0:00';
    return formatElapsed(Date.now() - sessionStartedAt);
  }, [sessionStartedAt, elapsedTick]);

  const liveStateLabel = useMemo(() => {
    const lecturerLive = Boolean(roomDetails?.lecturerActive || roomDetails?.lecturer_active);
    if (reconnecting) return 'Reconnecting';
    if (loadError) return 'Unavailable';
    if (jitsiSessionActive) return 'Live';
    if (user.role === 'lecturer' && !lecturerStarted) return 'Not started';
    if (user.role === 'student') {
      if (!roomDetails) return 'Preparing';
      if (!lecturerLive) return 'Waiting for lecturer';
      if (studentJoinedIntent && isLoading) return 'Joining classroom';
      if (!jitsiSessionActive) return 'Class started';
    }
    if (isLoading && lecturerStarted) return 'Joining classroom';
    return 'Preparing';
  }, [reconnecting, loadError, jitsiSessionActive, user.role, lecturerStarted, isLoading, roomDetails, studentJoinedIntent]);

  useEffect(() => {
    if (!activeRoomId) return undefined;

    let disposed = false;
    let pollTimer = null;
    let jitsiStarted = false;

    const loadScript = () => new Promise((resolve, reject) => {
      if (window.JitsiMeetExternalAPI) {
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

    const attachParticipantSignals = (jitsiApi) => {
      const syncRaiseHand = (payload) => {
        const pid = pickParticipantIdFromPayload(payload);
        const raised = payload?.raisedHand ?? payload?.handRaised ?? payload?.raised;
        if (pid == null) return;
        setParticipants((prev) => prev.map((p) => (
          String(p.id) === String(pid) ? { ...p, raisedHand: Boolean(raised) } : p
        )));
      };

      const syncDominant = (payload) => {
        const id = payload?.id;
        setParticipants((prev) => prev.map((p) => ({
          ...p,
          isDominant: id != null && String(p.id) === String(id)
        })));
      };

      try {
        jitsiApi.addEventListener('raiseHandUpdated', syncRaiseHand);
      } catch (_) { /* optional */ }
      try {
        jitsiApi.addEventListener('dominantSpeakerChanged', syncDominant);
      } catch (_) { /* optional */ }
    };

    const createMeeting = () => {
      if (disposed || !window.JitsiMeetExternalAPI) return;
      if (!jitsiContainerRef.current) {
        requestAnimationFrame(() => {
          if (!disposed) createMeeting();
        });
        return;
      }

      const isLecturer = userRoleRef.current === 'lecturer';
      const displayName = userNameRef.current;
      const domain = 'meet.jit.si';

      const options = {
        roomName: activeRoomId,
        parentNode: jitsiContainerRef.current,
        userInfo: {
          displayName,
          role: isLecturer ? 'moderator' : 'participant'
        },
        configOverwrite: {
          enableUserRolesBasedOnToken: false,
          prejoinPageEnabled: false,
          prejoinConfig: { enabled: false },
          /* Keep lobby off so participants are not held in Jitsi's knock/wait UI */
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

      const jitsiApi = new window.JitsiMeetExternalAPI(domain, options);
      jitsiApiRef.current = jitsiApi;

      attachParticipantSignals(jitsiApi);

      jitsiApi.addEventListener('videoConferenceJoined', (event) => {
        if (!disposed) setIsLoading(false);
        setJitsiSessionActive(true);
        setSessionStartedAt(Date.now());
        if (isLecturer) {
          lecturerSessionLiveRef.current = true;
          api.post(`/rooms/${encodeURIComponent(activeRoomId)}/presence`, { active: true }).catch(() => {});
        }
        setParticipants((prev) => {
          const exists = prev.some((p) => p.id === event.id);
          if (!exists) {
            return [...prev, {
              id: event.id,
              name: displayName,
              isLocal: true,
              raisedHand: false,
              isDominant: false,
              isModerator: isLecturer
            }];
          }
          return prev;
        });
      });

      jitsiApi.addEventListener('videoConferenceLeft', () => {
        if (disposed) return;
        if (isLecturer) {
          exitLiveClassRef.current('Class ended', { closeOnServer: true });
        }
      });

      jitsiApi.addEventListener('participantJoined', (event) => {
        setParticipants((prev) => {
          const exists = prev.some((p) => p.id === event.id);
          if (!exists) {
            return [...prev, {
              id: event.id,
              name: event.displayName || 'Participant',
              isLocal: false,
              raisedHand: false,
              isDominant: false,
              isModerator: Boolean(event.isModerator)
            }];
          }
          return prev;
        });
      });
      jitsiApi.addEventListener('participantLeft', (event) => {
        setParticipants((prev) => prev.filter((p) => p.id !== event.id));
      });

      jitsiApi.addEventListener('readyToClose', () => {
        if (!disposed) setIsLoading(false);
      });
    };

    const startJitsiOnce = () => {
      if (jitsiStarted || disposed) return;
      jitsiStarted = true;
      setIsLoading(true);
      loadScript()
        .then(() => {
          if (disposed) return;
          try {
            createMeeting();
          } catch (e) {
            jitsiStarted = false;
            setIsLoading(false);
            setLoadError('Could not start the meeting. Try again.');
            if (userRoleRef.current === 'student') {
              studentJoinedIntentRef.current = false;
              setStudentJoinedIntent(false);
            }
          }
        })
        .catch(() => {
          jitsiStarted = false;
          if (!disposed) setLoadError('Could not open the classroom. Try again.');
          setIsLoading(false);
          if (userRoleRef.current === 'student') {
            studentJoinedIntentRef.current = false;
            setStudentJoinedIntent(false);
          }
        });
    };

    const pollRoomStatus = () => {
      if (userRoleRef.current === 'lecturer' || !activeRoomId) return;
      api.get(`/rooms/${encodeURIComponent(activeRoomId)}/access`).then((res) => {
        if (disposed) return;
        setReconnecting(false);
        setRoomDetails(res.data);
        if (!res.data?.lecturerActive && !res.data?.lecturer_active) {
          setLoadError('');
          setIsLoading(false);
        } else if (!res.data?.isActive && !res.data?.is_active) {
          exitLiveClassRef.current('Class has ended', { closeOnServer: false });
        } else {
          setLoadError('');
          setIsLoading(false);
        }
      }).catch((err) => {
        if (disposed) return;
        if (!err?.response) setReconnecting(true);
        else setReconnecting(false);
        const st = err?.response?.status;
        const msg = err?.response?.data?.error || err?.response?.data?.message;
        if (st === 404) {
          exitLiveClassRef.current(msg || 'Room not found', { closeOnServer: false });
        } else if (st === 403 && msg === 'Class has ended') {
          exitLiveClassRef.current('Class has ended', { closeOnServer: false });
        } else if (st === 403) {
          if (pollTimer) clearInterval(pollTimer);
          setLoadError(msg || 'Access denied');
          setIsLoading(false);
        } else if (st === 409) {
          setLoadError('');
          setIsLoading(false);
        }
      });
    };

    startMeetingRef.current = startJitsiOnce;
    pollRoomStatusRef.current = pollRoomStatus;

    if (userRoleRef.current === 'lecturer') {
      api.get(`/rooms/${encodeURIComponent(activeRoomId)}/access`)
        .then((res) => {
          if (disposed) return;
          setReconnecting(false);
          setRoomDetails(res.data);
          setIsLoading(false);
          setLoadError('');
        })
        .catch((err) => {
          if (disposed) return;
          if (!err?.response) setReconnecting(true);
          else setReconnecting(false);
          const st = err?.response?.status;
          const msg = err?.response?.data?.error || err?.response?.data?.message;
          if (st === 404) {
            exitLiveClassRef.current(msg || 'Room not found', { closeOnServer: false });
          } else if (st === 403 && msg === 'Class has ended') {
            exitLiveClassRef.current('Class has ended', { closeOnServer: false });
          } else if (st === 403) {
            if (!disposed) setLoadError(msg || 'Access denied');
            setIsLoading(false);
          } else if (!disposed) {
            setLoadError(msg || err.message || 'Cannot open this room');
            setIsLoading(false);
          }
        });
    } else {
      pollTimer = setInterval(pollRoomStatus, 2000);
      pollRoomStatus();
    }

    return () => {
      disposed = true;
      studentJoinedIntentRef.current = false;
      if (pollTimer) clearInterval(pollTimer);
      if (userRoleRef.current === 'lecturer' && activeRoomId && lecturerSessionLiveRef.current) {
        closeRoomOnServer();
      }
      lecturerSessionLiveRef.current = false;
      disposeJitsi();
    };
  }, [activeRoomId, user.name, user.role, closeRoomOnServer, disposeJitsi]);

  const handleEndClass = () => {
    exitLiveClass('Class ended', { closeOnServer: true });
  };

  const handleLeaveClass = () => {
    exitLiveClass('You left the class', { closeOnServer: false });
  };

  const toggleFullscreen = useCallback(() => {
    const el = videoShellRef.current || classroomRootRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  const courseTitle = roomDetails?.course?.title || '';
  const rawLecturerName = roomDetails?.course?.lecturerName || roomDetails?.course?.lecturer_name || '';
  const lecturerNameClean = normalizeLecturerName(rawLecturerName);

  const raisedParticipants = useMemo(
    () => participants.filter((p) => p.raisedHand),
    [participants]
  );

  const lecturerLive = Boolean(roomDetails?.lecturerActive || roomDetails?.lecturer_active);

  const showLecturerLobby = user.role === 'lecturer' && !lecturerStarted && !jitsiSessionActive;
  const showStudentLobby = user.role === 'student' && roomDetails && !lecturerLive && !jitsiSessionActive;
  const showStudentJoining = user.role === 'student' && studentJoinedIntent && !jitsiSessionActive && isLoading;
  const showStudentJoinGate = user.role === 'student' && lecturerLive && !jitsiSessionActive && !studentJoinedIntent && !isLoading && !loadError;

  if (classEnded) {
    return (
      <div className={styles.endedShell}>
        <div className={styles.endedCard}>
          <p className={styles.endedTitle}>{endMessage}</p>
          <p className={styles.endedLead}>Returning to rooms…</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.roomShell}>
      <div ref={classroomRootRef} className={styles.classroomRoot}>
        <header className={styles.topBar}>
          <div className={styles.topBarMain}>
            <h1 className={styles.classTitle}>{courseTitle || 'Live class'}</h1>
            <p className={styles.classSubtitle}>
              {lecturerNameClean ? (
                <>
                  <span>{lecturerNameClean}</span>
                  <span className={styles.topDot} aria-hidden>·</span>
                </>
              ) : null}
              <span className={styles.sessionTimer} aria-label="Session time">
                {jitsiSessionActive ? elapsedDisplay : '—'}
              </span>
            </p>
          </div>
          <div className={styles.topBarMeta}>
            <span className={styles.livePill} data-state={liveStateLabel === 'Live' ? 'live' : 'idle'}>
              {liveStateLabel}
            </span>
            {reconnecting ? <span className={styles.reconnectHint}>Checking connection…</span> : null}
            <button type="button" className={styles.topBarBtn} onClick={toggleFullscreen}>
              Fullscreen
            </button>
            {user.role === 'lecturer' ? (
              <button type="button" className={styles.topBarBtnDanger} onClick={handleEndClass}>
                End class
              </button>
            ) : (
              <button type="button" className={styles.topBarBtnSecondary} onClick={handleLeaveClass}>
                Leave
              </button>
            )}
          </div>
        </header>

        <div className={styles.classroomBody}>
          <div className={styles.mainColumn}>
            <div className={styles.videoShell} ref={videoShellRef}>
              {(showLecturerLobby || showStudentLobby || showStudentJoining || showStudentJoinGate) && (
                <div className={styles.lobbyOverlay}>
                  {showLecturerLobby && (
                    <>
                      <p className={styles.lobbyTitle}>Start class</p>
                      <p className={styles.lobbyText}>Open the meeting room. Complete any prompts inside the meeting window to join as host.</p>
                      <button
                        type="button"
                        className={styles.primaryCta}
                        disabled={!roomDetails || Boolean(loadError)}
                        onClick={() => {
                          setLecturerStarted(true);
                          startMeetingRef.current?.();
                        }}
                      >
                        Start class
                      </button>
                    </>
                  )}
                  {showStudentLobby && (
                    <>
                      <p className={styles.lobbyTitle}>Waiting for lecturer</p>
                      <p className={styles.lobbyText}>Your instructor has not opened this live class yet.</p>
                    </>
                  )}
                  {showStudentJoining && (
                    <>
                      <p className={styles.lobbyTitle}>Joining classroom</p>
                      <p className={styles.lobbyText}>Loading the meeting…</p>
                    </>
                  )}
                  {showStudentJoinGate && (
                    <>
                      <p className={styles.lobbyTitle}>Class started</p>
                      <p className={styles.lobbyText}>Your instructor has opened the session. Join when you are ready.</p>
                      <button
                        type="button"
                        className={styles.primaryCta}
                        onClick={() => {
                          studentJoinedIntentRef.current = true;
                          setStudentJoinedIntent(true);
                          startMeetingRef.current?.();
                        }}
                      >
                        Join class
                      </button>
                    </>
                  )}
                </div>
              )}

              {loadError && user.role === 'student' && !showStudentLobby ? (
                <div className={styles.inlineError}>{loadError}</div>
              ) : null}
              {loadError && user.role === 'lecturer' && lecturerStarted ? (
                <div className={styles.inlineError}>{loadError}</div>
              ) : null}

              {isLoading && !showStudentJoining && (lecturerStarted || (user.role === 'student' && studentJoinedIntent)) ? (
                <div className={styles.loadingStrip}>Connecting…</div>
              ) : null}

              <div
                ref={jitsiContainerRef}
                id="jitsi-container"
                className={styles.videoWell}
              />
            </div>

            {jitsiSessionActive ? (
              <div className={styles.bottomBar} role="toolbar" aria-label="Class controls">
                <div className={styles.bottomBarInner}>
                  <button type="button" className={styles.barBtn} onClick={() => execJitsi('toggleAudio')}>
                    Microphone
                  </button>
                  <button type="button" className={styles.barBtn} onClick={() => execJitsi('toggleVideo')}>
                    Camera
                  </button>
                  {user.role === 'lecturer' ? (
                    <button type="button" className={styles.barBtn} onClick={() => execJitsi('toggleShareScreen')}>
                      Share screen
                    </button>
                  ) : null}
                  <button type="button" className={styles.barBtn} onClick={() => execJitsi('toggleRaiseHand')}>
                    Raise hand
                  </button>
                  <button
                    type="button"
                    className={`${styles.barBtn} ${sidebarOpen ? styles.barBtnActive : ''}`}
                    onClick={() => { setSidebarOpen((o) => !o); setSidebarTab('participants'); }}
                    aria-pressed={sidebarOpen}
                  >
                    People
                  </button>
                  <span className={styles.bottomSpacer} />
                  {user.role === 'lecturer' ? (
                    <button type="button" className={styles.barBtnLeave} onClick={handleEndClass}>
                      End class
                    </button>
                  ) : (
                    <button type="button" className={styles.barBtnLeave} onClick={handleLeaveClass}>
                      Leave
                    </button>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          <aside
            className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}
            aria-hidden={!sidebarOpen}
          >
            {(courseTitle || lecturerNameClean || roomDetails?.course?.lecturer_id) ? (
            <div className={styles.sidebarContext}>
              {courseTitle ? <p className={styles.sidebarContextTitle}>{courseTitle}</p> : null}
              {lecturerNameClean ? (
                <p className={styles.sidebarContextMeta}>
                  {user.role === 'student' ? 'Instructor · ' : 'Host · '}
                  {lecturerNameClean}
                </p>
              ) : roomDetails?.course?.lecturer_id ? (
                <p className={styles.sidebarContextMeta}>
                  {user.role === 'student' ? 'Instructor' : 'Session host'}
                </p>
              ) : null}
            </div>
            ) : null}
            <div className={styles.sidebarHeader}>
              <div className={styles.sidebarTabs} role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={sidebarTab === 'participants'}
                  className={sidebarTab === 'participants' ? styles.sidebarTabActive : styles.sidebarTab}
                  onClick={() => setSidebarTab('participants')}
                >
                  People
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={sidebarTab === 'chat'}
                  className={sidebarTab === 'chat' ? styles.sidebarTabActive : styles.sidebarTab}
                  onClick={() => setSidebarTab('chat')}
                >
                  Chat
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={sidebarTab === 'notes'}
                  className={sidebarTab === 'notes' ? styles.sidebarTabActive : styles.sidebarTab}
                  onClick={() => setSidebarTab('notes')}
                >
                  Notes
                </button>
              </div>
              <button
                type="button"
                className={styles.sidebarClose}
                onClick={() => setSidebarOpen(false)}
                aria-label="Close panel"
              >
                ×
              </button>
            </div>
            <div className={styles.sidebarBody}>
              {sidebarTab === 'participants' && (
                <>
                  {raisedParticipants.length ? (
                    <p className={styles.raiseLine}>
                      Hands raised ({raisedParticipants.length}):
                      {' '}
                      {raisedParticipants.map((p) => p.name).filter(Boolean).join(', ')}
                    </p>
                  ) : null}
                  <ul className={styles.participantList}>
                    {participants.length === 0 ? (
                      <li className={styles.emptyList}>No one listed yet.</li>
                    ) : (
                      participants.map((p) => {
                        const roleLine = (() => {
                          if (p.isLocal && user.role === 'lecturer') return 'Instructor';
                          if (p.isLocal && user.role === 'student') return 'You';
                          if (!p.isLocal && p.isModerator) return 'Moderator';
                          if (!p.isLocal) return 'Participant';
                          return '';
                        })();
                        return (
                          <li
                            key={p.id || p.name}
                            className={[
                              styles.participantRow,
                              p.isLocal && styles.participantRowLocal,
                              p.isDominant && styles.participantRowDominant
                            ].filter(Boolean).join(' ')}
                          >
                            <div>
                              <div className={styles.participantName}>{p.name || 'Participant'}</div>
                              <div className={styles.participantMeta}>
                                {roleLine}
                                {p.isDominant ? ' · Speaking' : ''}
                              </div>
                            </div>
                            <div className={styles.participantTags}>
                              {p.raisedHand ? <span className={`${styles.tag} ${styles.tagHand}`}>Hand</span> : null}
                            </div>
                          </li>
                        );
                      })
                    )}
                  </ul>
                </>
              )}
              {sidebarTab === 'chat' && (
                <div className={styles.chatPanel}>
                  <p className={styles.chatPanelText}>Class chat opens in the meeting view.</p>
                  <button type="button" className={styles.secondaryCta} onClick={() => execJitsi('toggleChat')}>
                    Open chat
                  </button>
                </div>
              )}
              {sidebarTab === 'notes' && (
                <label className={styles.notesLabel}>
                  <span className={styles.notesLabelText}>Private notes (this device only)</span>
                  <textarea
                    className={styles.notesArea}
                    value={sessionNotes}
                    onChange={(e) => setSessionNotes(e.target.value)}
                    rows={12}
                    placeholder="Key points, questions to ask…"
                  />
                </label>
              )}
            </div>
          </aside>
        </div>

        {sidebarOpen ? (
          <button
            type="button"
            className={styles.sidebarScrim}
            aria-label="Close side panel"
            onClick={() => setSidebarOpen(false)}
          />
        ) : null}
      </div>
    </div>
  );
}
