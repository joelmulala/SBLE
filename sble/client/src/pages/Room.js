import React, {
  useEffect, useMemo, useRef, useState, useCallback
} from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useKeycloak } from '../auth/AuthProvider';
import api from '../config/api';
import ClassroomMediaStage from '../components/classroom/ClassroomMediaStage';
import MediaControlDock from '../components/classroom/MediaControlDock';
import FloatingSelfView from '../components/classroom/FloatingSelfView';
import VideoStageChrome from '../components/classroom/VideoStageChrome';
import LiveStageBadge from '../components/classroom/LiveStageBadge';
import StageSignalHint from '../components/classroom/StageSignalHint';
import ParticipantRoster from '../components/classroom/ParticipantRoster';
import RaiseHandButton from '../components/classroom/RaiseHandButton';
import QuestionSignalButton from '../components/classroom/QuestionSignalButton';
import ParticipationIndicators from '../components/classroom/ParticipationIndicators';
import ClassroomChatPanel from '../components/classroom/ClassroomChatPanel';
import AttendanceTracker from '../components/classroom/AttendanceTracker';
import SessionMetricsPanel from '../components/classroom/SessionMetricsPanel';
import LiveAttendanceBadge from '../components/classroom/LiveAttendanceBadge';
import SessionSummaryModal from '../components/classroom/SessionSummaryModal';
import LecturerControlsPanel from '../components/classroom/LecturerControlsPanel';
import { createClassroomMediaAdapter } from '../services/classroom/createClassroomMediaAdapter';
import { mergeChatMessages } from '../services/classroom/classroomChatMessages';
import styles from './Room.module.css';

const USE_LIVEKIT = String(process.env.REACT_APP_CLASSROOM_BACKEND || 'jitsi').toLowerCase() === 'livekit';

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
  const mediaContainerRef = useRef(null);
  const liveStageRef = useRef(null);
  const mediaAdapterRef = useRef(null);
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
  const [mediaSessionActive, setMediaSessionActive] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState('participants');
  const [sessionNotes, setSessionNotes] = useState('');
  const [sessionStartedAt, setSessionStartedAt] = useState(null);
  const [elapsedTick, setElapsedTick] = useState(0);
  const [lecturerStarted, setLecturerStarted] = useState(false);
  const [studentJoinedIntent, setStudentJoinedIntent] = useState(false);
  const [liveKitRoom, setLiveKitRoom] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const chatSystemKeysRef = useRef(new Set());
  const chatParticipantInitRef = useRef(false);
  const prevParticipantIdsRef = useRef(new Set());
  const participantDisplayNamesRef = useRef(new Map());
  const screenSharePrevRef = useRef(new Map());
  /** `undefined` = not in post-class summary flow; otherwise summary object or null after fetch */
  const [endClassAttendanceSummary, setEndClassAttendanceSummary] = useState(undefined);
  const [classroomSession, setClassroomSession] = useState({
    requests: [],
    participationLocked: false
  });
  const [stageMeta, setStageMeta] = useState({
    layoutMode: 'discussion',
    presentationFsActive: false,
    discussionSpotlightId: null,
    discussionCount: 0
  });
  const [moderationNotice, setModerationNotice] = useState(null);
  const moderationNoticeTimerRef = useRef(null);
  const keycloakSubRef = useRef('');

  const activeRoomId = decodeURIComponent(roomId || token || '').trim();
  const navigate = useNavigate();

  const user = useMemo(() => ({
    name: keycloak.tokenParsed?.name || 'User',
    role: keycloak.hasRealmRole('lecturer') || keycloak.hasRealmRole('admin') ? 'lecturer' : 'student'
  }), [keycloak]);

  userNameRef.current = user.name;
  userRoleRef.current = user.role;
  keycloakSubRef.current = keycloak.tokenParsed?.sub || '';

  useEffect(() => {
    participantsRef.current = participants;
  }, [participants]);

  const disposeMedia = useCallback(() => {
    try {
      mediaAdapterRef.current?.disconnect();
    } catch (_) { /* ignore */ }
    setLiveKitRoom(null);
    setMediaSessionActive(false);
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
    if (!chatSystemKeysRef.current.has('class-ended')) {
      chatSystemKeysRef.current.add('class-ended');
      setChatMessages((prev) => mergeChatMessages(prev, [{
        kind: 'system',
        id: `sys-class-ended-${Date.now()}`,
        t: Date.now(),
        body: 'Class ended.'
      }]));
    }
    setEndMessage(message);
    setClassEnded(true);
    disposeMedia();
    setReconnecting(false);
    studentJoinedIntentRef.current = false;
    setLecturerStarted(false);
    setStudentJoinedIntent(false);
    setSessionStartedAt(null);
    if (closeOnServer && user.role === 'lecturer') {
      closeRoomOnServer();
    }
  }, [closeRoomOnServer, disposeMedia, user.role]);

  const exitLiveClassRef = useRef(exitLiveClass);
  exitLiveClassRef.current = exitLiveClass;

  useEffect(() => {
    setEndClassAttendanceSummary(undefined);
  }, [activeRoomId]);

  useEffect(() => {
    if (!classEnded) return undefined;
    if (USE_LIVEKIT && user.role === 'lecturer' && endClassAttendanceSummary !== undefined) {
      return undefined;
    }
    const t = setTimeout(() => {
      navigate('/rooms', { state: { liveClassEnded: true, liveClassMessage: endMessage } });
    }, 2200);
    return () => clearTimeout(t);
  }, [classEnded, endMessage, navigate, endClassAttendanceSummary, user.role]);

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
    if (!mediaSessionActive || !sessionStartedAt) return undefined;
    const id = setInterval(() => setElapsedTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [mediaSessionActive, sessionStartedAt]);

  const elapsedDisplay = useMemo(() => {
    if (!sessionStartedAt) return '0:00';
    return formatElapsed(Date.now() - sessionStartedAt);
  }, [sessionStartedAt, elapsedTick]);

  const liveStateLabel = useMemo(() => {
    const lecturerLive = Boolean(roomDetails?.lecturerActive || roomDetails?.lecturer_active);
    if (reconnecting) return 'Reconnecting';
    if (loadError) return 'Unavailable';
    if (mediaSessionActive) return 'Live';
    if (user.role === 'lecturer' && !lecturerStarted) return 'Not started';
    if (user.role === 'student') {
      if (!roomDetails) return 'Preparing';
      if (!lecturerLive) return 'Waiting for lecturer';
      if (studentJoinedIntent && isLoading) return 'Joining classroom';
      if (!mediaSessionActive) return 'Class started';
    }
    if (isLoading && lecturerStarted) return 'Joining classroom';
    return 'Preparing';
  }, [reconnecting, loadError, mediaSessionActive, user.role, lecturerStarted, isLoading, roomDetails, studentJoinedIntent]);

  useEffect(() => {
    if (!activeRoomId) return undefined;

    let disposed = false;
    let pollTimer = null;

    const adapter = createClassroomMediaAdapter();
    mediaAdapterRef.current = adapter;

    adapter.onParticipantsChanged((list) => {
      if (disposed) return;
      setParticipants(list);
    });

    adapter.onConnectionStateChanged((evt) => {
      if (disposed) return;
      switch (evt.type) {
        case 'connecting':
          setIsLoading(true);
          break;
        case 'session_joined':
          setIsLoading(false);
          setMediaSessionActive(true);
          setSessionStartedAt(Date.now());
          if (USE_LIVEKIT) {
            chatParticipantInitRef.current = false;
            prevParticipantIdsRef.current = new Set();
            screenSharePrevRef.current = new Map();
            chatSystemKeysRef.current.delete('class-ended');
          }
          if (evt.role === 'lecturer') {
            lecturerSessionLiveRef.current = true;
            api.post(`/rooms/${encodeURIComponent(activeRoomId)}/presence`, { active: true }).catch(() => {});
          }
          break;
        case 'session_ready':
          setIsLoading(false);
          break;
        case 'local_left_session':
          if (evt.role === 'lecturer') {
            exitLiveClassRef.current('Class ended', { closeOnServer: true });
          }
          break;
        case 'script_error':
        case 'start_error':
          setIsLoading(false);
          setLoadError(evt.message || '');
          if (userRoleRef.current === 'student') {
            studentJoinedIntentRef.current = false;
            setStudentJoinedIntent(false);
          }
          break;
        default:
          break;
      }
    });

    adapter.onClassroomChatMessage((msg) => {
      if (disposed || !msg || msg.kind !== 'user') return;
      setChatMessages((prev) => mergeChatMessages(prev, [msg]));
    });

    adapter.onClassroomSessionState((state) => {
      if (disposed || !state) return;
      setClassroomSession({
        requests: Array.isArray(state.requests) ? state.requests : [],
        participationLocked: Boolean(state.participationLocked)
      });
      if (state.notice?.message) {
        const sub = keycloakSubRef.current;
        if (!state.notice.targetIdentity || state.notice.targetIdentity === sub) {
          if (moderationNoticeTimerRef.current) clearTimeout(moderationNoticeTimerRef.current);
          setModerationNotice(state.notice.message);
          moderationNoticeTimerRef.current = setTimeout(() => {
            setModerationNotice(null);
            moderationNoticeTimerRef.current = null;
          }, 7000);
        }
      }
    });

    const startMediaOnce = () => {
      adapter.connect({
        roomId: activeRoomId,
        displayName: userNameRef.current,
        role: userRoleRef.current,
        container: USE_LIVEKIT ? null : mediaContainerRef.current,
        getDisposed: () => disposed,
        onRtcRoom: USE_LIVEKIT ? (r) => {
          if (!disposed) setLiveKitRoom(r);
        } : undefined
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

    startMeetingRef.current = startMediaOnce;
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
      chatSystemKeysRef.current.clear();
      chatParticipantInitRef.current = false;
      prevParticipantIdsRef.current = new Set();
      screenSharePrevRef.current = new Map();
      setChatMessages([]);
      if (moderationNoticeTimerRef.current) {
        clearTimeout(moderationNoticeTimerRef.current);
        moderationNoticeTimerRef.current = null;
      }
      setModerationNotice(null);
      setClassroomSession({ requests: [], participationLocked: false });
      try {
        adapter.disconnect();
      } catch (_) { /* ignore */ }
      mediaAdapterRef.current = null;
      setLiveKitRoom(null);
      setMediaSessionActive(false);
    };
  }, [activeRoomId, user.name, user.role, closeRoomOnServer]);

  useEffect(() => {
    if (!USE_LIVEKIT || !mediaSessionActive) return;

    participants.forEach((p) => {
      participantDisplayNamesRef.current.set(String(p.id), p.name || 'Participant');
    });

    const currIds = new Set(participants.map((p) => String(p.id)));
    const additions = [];

    if (!chatParticipantInitRef.current) {
      chatParticipantInitRef.current = true;
      prevParticipantIdsRef.current = currIds;
      participants.forEach((p) => {
        screenSharePrevRef.current.set(String(p.id), Boolean(p.screenSharing));
      });
      return;
    }

    const prevIds = prevParticipantIdsRef.current;

    for (const id of prevIds) {
      if (!currIds.has(id)) {
        chatSystemKeysRef.current.delete(`join:${id}`);
        chatSystemKeysRef.current.delete(`screen:${id}`);
        screenSharePrevRef.current.delete(id);
        const leaveKey = `leave:${id}`;
        if (!chatSystemKeysRef.current.has(leaveKey)) {
          chatSystemKeysRef.current.add(leaveKey);
          const nm = participantDisplayNamesRef.current.get(id) || 'Participant';
          participantDisplayNamesRef.current.delete(id);
          additions.push({
            kind: 'system',
            id: `sys-leave-${id}-${Date.now()}`,
            t: Date.now(),
            body: `${nm} left the classroom.`
          });
        }
      }
    }

    for (const p of participants) {
      const pid = String(p.id);
      const nowShare = Boolean(p.screenSharing);

      if (!prevIds.has(pid)) {
        screenSharePrevRef.current.set(pid, nowShare);
        chatSystemKeysRef.current.delete(`leave:${pid}`);
        if (!p.isLocal) {
          const key = `join:${pid}`;
          if (!chatSystemKeysRef.current.has(key)) {
            chatSystemKeysRef.current.add(key);
            additions.push({
              kind: 'system',
              id: `sys-join-${pid}-${Date.now()}`,
              t: Date.now(),
              body: `${p.name || 'Participant'} joined the classroom.`
            });
          }
        }
      }

      const wasShare = screenSharePrevRef.current.get(pid);
      if (wasShare !== undefined && prevIds.has(pid)) {
        if (!wasShare && nowShare) {
          const skey = `screen:${pid}`;
          if (!chatSystemKeysRef.current.has(skey)) {
            chatSystemKeysRef.current.add(skey);
            const lect = p.classroomRole === 'lecturer' || p.classroomRole === 'admin' || p.isModerator;
            const line = lect
              ? 'Lecturer started screen sharing.'
              : `${p.name || 'Participant'} started screen sharing.`;
            additions.push({
              kind: 'system',
              id: `sys-screen-${pid}-${Date.now()}`,
              t: Date.now(),
              body: line
            });
          }
        } else if (wasShare && !nowShare) {
          chatSystemKeysRef.current.delete(`screen:${pid}`);
        }
      }

      screenSharePrevRef.current.set(pid, nowShare);
    }

    prevParticipantIdsRef.current = currIds;

    if (additions.length) {
      setChatMessages((prev) => mergeChatMessages(prev, additions));
    }
  }, [participants, mediaSessionActive]);

  const handleChatSend = useCallback((text) => {
    mediaAdapterRef.current?.sendChatMessage?.(text);
  }, []);

  const handleModerateParticipant = useCallback(async (participantId, action) => {
    try {
      await mediaAdapterRef.current?.moderateRemoteParticipant?.(participantId, action);
    } catch (_) { /* ignore */ }
  }, []);

  const handleModerationRequestDecision = useCallback((requestId, decision) => {
    mediaAdapterRef.current?.approveModerationRequest?.(requestId, decision);
  }, []);

  const handleToggleParticipationLock = useCallback(() => {
    const next = !classroomSession.participationLocked;
    mediaAdapterRef.current?.setParticipationLocked?.(next);
  }, [classroomSession.participationLocked]);

  const handleReclaimPresentation = useCallback(async () => {
    try {
      await mediaAdapterRef.current?.reclaimPresentations?.();
    } catch (_) { /* ignore */ }
  }, []);

  const handleEndClass = async () => {
    if (USE_LIVEKIT && user.role === 'lecturer') {
      try {
        await api.post(`/rooms/${encodeURIComponent(activeRoomId)}/session/leave`, {});
      } catch (_) { /* ignore */ }
      try {
        await api.patch(`/rooms/${encodeURIComponent(activeRoomId)}/close`);
      } catch (_) { /* ignore */ }
      try {
        const res = await api.get(`/rooms/${encodeURIComponent(activeRoomId)}/session/summary`);
        setEndClassAttendanceSummary(res.data);
      } catch (_) {
        setEndClassAttendanceSummary(null);
      }
      exitLiveClass('Class ended', { closeOnServer: false });
    } else {
      setEndClassAttendanceSummary(undefined);
      exitLiveClass('Class ended', { closeOnServer: true });
    }
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

  const questionParticipants = useMemo(
    () => participants.filter((p) => p.hasQuestion),
    [participants]
  );

  const localParticipantState = useMemo(
    () => participants.find((p) => p.isLocal) || null,
    [participants]
  );

  const stageBadgeName = useMemo(() => {
    const raw = String(localParticipantState?.name || user.name || 'You').trim() || 'You';
    if (/\(you\)\s*$/i.test(raw)) return raw;
    return `${raw} (You)`;
  }, [localParticipantState?.name, user.name]);

  const stageRoleLabel = user.role === 'lecturer' ? 'Instructor' : 'Student';

  const presenceByIdentity = useMemo(() => {
    const o = {};
    participants.forEach((p) => {
      o[p.id] = {
        raisedHand: Boolean(p.raisedHand),
        hasQuestion: Boolean(p.hasQuestion),
        participationAck: p.participationAck || null
      };
    });
    return o;
  }, [participants]);

  const lecturerLive = Boolean(roomDetails?.lecturerActive || roomDetails?.lecturer_active);

  const showLecturerLobby = user.role === 'lecturer' && !lecturerStarted && !mediaSessionActive;
  const showStudentLobby = user.role === 'student' && roomDetails && !lecturerLive && !mediaSessionActive;
  const showStudentJoining = user.role === 'student' && studentJoinedIntent && !mediaSessionActive && isLoading;
  const showStudentJoinGate = user.role === 'student' && lecturerLive && !mediaSessionActive && !studentJoinedIntent && !isLoading && !loadError;

  const liveKitActiveSession = USE_LIVEKIT && mediaSessionActive;

  if (classEnded) {
    const showAttendanceSummary = USE_LIVEKIT && user.role === 'lecturer' && endClassAttendanceSummary !== undefined;
    return (
      <div className={styles.endedShell}>
        {showAttendanceSummary ? (
          <SessionSummaryModal
            summary={endClassAttendanceSummary}
            onDismiss={() => {
              setEndClassAttendanceSummary(undefined);
              navigate('/rooms', { state: { liveClassEnded: true, liveClassMessage: endMessage } });
            }}
          />
        ) : (
          <div className={styles.endedCard}>
            <p className={styles.endedTitle}>{endMessage}</p>
            <p className={styles.endedLead}>Returning to rooms…</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={styles.roomShell}>
      <div ref={classroomRootRef} className={styles.classroomRoot}>
        {USE_LIVEKIT && mediaSessionActive && activeRoomId ? (
          <AttendanceTracker
            roomToken={activeRoomId}
            enabled={Boolean(mediaSessionActive && activeRoomId)}
            metrics={{
              raisedHand: Boolean(localParticipantState?.raisedHand),
              hasQuestion: Boolean(localParticipantState?.hasQuestion),
              screenSharing: Boolean(localParticipantState?.screenSharing),
              speaking: Boolean(localParticipantState?.speaking || localParticipantState?.isDominant)
            }}
          />
        ) : null}
        <header className={styles.topBar}>
          <div className={styles.topBarMain}>
            <p className={styles.topBarKicker}>Teaching workspace</p>
            <h1 className={styles.liveRoomTitle}>Live classroom</h1>
            <p className={styles.classSubtitle}>
              {lecturerNameClean ? (
                <span className={styles.hostLine}>
                  {user.role === 'student' ? `Instructor · ${lecturerNameClean}` : `Host · ${lecturerNameClean}`}
                </span>
              ) : null}
              {!liveKitActiveSession ? (
                <span className={styles.sessionTimer} aria-label="Session time">
                  {mediaSessionActive ? (
                    <>
                      {lecturerNameClean ? <span className={styles.topDot} aria-hidden>·</span> : null}
                      {elapsedDisplay}
                    </>
                  ) : (
                    '—'
                  )}
                </span>
              ) : null}
            </p>
          </div>
          <div className={styles.topBarMeta}>
            {liveKitActiveSession ? (
              <>
                <span className={styles.livePill} data-state="live">
                  Live
                </span>
                {reconnecting ? <span className={styles.reconnectHint}>Reconnecting…</span> : null}
              </>
            ) : (
              <>
                <span
                  className={styles.livePill}
                  data-state={liveStateLabel === 'Live' ? 'live' : 'idle'}
                  title={liveStateLabel}
                >
                  {liveStateLabel === 'Live' || liveStateLabel === 'Reconnecting' ? liveStateLabel : null}
                </span>
                {reconnecting ? <span className={styles.reconnectHint}>Checking connection…</span> : null}
                {mediaSessionActive && !USE_LIVEKIT ? (
                  <>
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
                  </>
                ) : null}
              </>
            )}
          </div>
        </header>

        <div className={styles.classroomBody}>
          <div className={styles.mainColumn}>
            {moderationNotice ? (
              <div className={styles.moderationNotice} role="status">
                {moderationNotice}
              </div>
            ) : null}
            <div className={styles.videoShell} ref={videoShellRef}>
              {(showLecturerLobby || showStudentLobby || showStudentJoining || showStudentJoinGate) && (
                <div className={styles.lobbyOverlay}>
                  {showLecturerLobby && (
                    <>
                      <p className={styles.lobbyTitle}>Start class</p>
                      <p className={styles.lobbyText}>
                        {USE_LIVEKIT
                          ? 'Connect with your camera and microphone. Video appears inside SBLE—no external meeting window.'
                          : 'Open the meeting room. Complete any prompts inside the meeting window to join as host.'}
                      </p>
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
                ref={mediaContainerRef}
                id={USE_LIVEKIT ? 'classroom-media' : 'jitsi-container'}
                className={styles.videoWell}
              >
                {USE_LIVEKIT ? (
                  <>
                    <ClassroomMediaStage
                      ref={liveStageRef}
                      room={liveKitRoom}
                      sidebarOpen={sidebarOpen}
                      presenceByIdentity={presenceByIdentity}
                      onStageMetaChange={setStageMeta}
                    />
                    {mediaSessionActive ? (
                      <>
                        <LiveStageBadge displayName={stageBadgeName} roleLabel={stageRoleLabel} />
                        <StageSignalHint reconnecting={reconnecting} />
                        <VideoStageChrome
                          onClassroomFullscreen={toggleFullscreen}
                          showPresentationExpand={stageMeta.layoutMode !== 'discussion'}
                          presentationFsActive={stageMeta.presentationFsActive}
                          onPresentationFullscreen={() => liveStageRef.current?.togglePresentationFullscreen?.()}
                        />
                        <FloatingSelfView
                          room={liveKitRoom}
                          participantCount={stageMeta.discussionCount || participants.length}
                          spotlightIdentity={stageMeta.discussionSpotlightId}
                          layoutMode={stageMeta.layoutMode}
                        />
                        <MediaControlDock
                          role={user.role}
                          micOn={Boolean(localParticipantState?.micOn)}
                          camOn={Boolean(localParticipantState?.cameraOn)}
                          screenSharing={Boolean(localParticipantState?.screenSharing)}
                          participationLocked={classroomSession.participationLocked}
                          sidebarOpen={sidebarOpen}
                          sidebarTab={sidebarTab}
                          onOpenChat={() => {
                            setSidebarOpen(true);
                            setSidebarTab('chat');
                          }}
                          onTogglePeople={() => {
                            setSidebarOpen((o) => !o);
                            setSidebarTab('participants');
                          }}
                          onToggleMic={() => mediaAdapterRef.current?.toggleMic()}
                          onToggleCam={() => mediaAdapterRef.current?.toggleCamera()}
                          onToggleShare={() => mediaAdapterRef.current?.toggleScreenShare()}
                          onToggleRaiseHand={() => mediaAdapterRef.current?.toggleRaiseHand()}
                          onToggleQuestion={() => mediaAdapterRef.current?.toggleQuestionSignal()}
                          raisedHand={Boolean(localParticipantState?.raisedHand)}
                          hasQuestion={Boolean(localParticipantState?.hasQuestion)}
                          onAckUnderstood={() => mediaAdapterRef.current?.sendParticipationAck('understood')}
                          onAckAgree={() => mediaAdapterRef.current?.sendParticipationAck('agree')}
                          onRequestPresent={() => mediaAdapterRef.current?.requestPresentationAccess?.()}
                          onRequestSpeak={() => mediaAdapterRef.current?.requestSpeakingTurn?.()}
                          onCancelRequest={() => mediaAdapterRef.current?.cancelModerationRequest?.()}
                          onEndOrLeave={user.role === 'lecturer' ? handleEndClass : handleLeaveClass}
                          isLecturer={user.role === 'lecturer'}
                        />
                      </>
                    ) : null}
                  </>
                ) : null}
              </div>
            </div>

            {mediaSessionActive && !(USE_LIVEKIT && mediaSessionActive) ? (
              <div className={styles.bottomBar} role="toolbar" aria-label="Class controls">
                <div className={styles.bottomBarInner}>
                  <button type="button" className={styles.barBtn} onClick={() => mediaAdapterRef.current?.toggleMic()}>
                    Microphone
                  </button>
                  <button type="button" className={styles.barBtn} onClick={() => mediaAdapterRef.current?.toggleCamera()}>
                    Camera
                  </button>
                  {USE_LIVEKIT && user.role === 'student' ? (
                    <>
                      <button
                        type="button"
                        className={styles.barBtn}
                        disabled={classroomSession.participationLocked}
                        onClick={() => mediaAdapterRef.current?.requestPresentationAccess?.()}
                      >
                        Request present
                      </button>
                      <button
                        type="button"
                        className={styles.barBtn}
                        disabled={classroomSession.participationLocked}
                        onClick={() => mediaAdapterRef.current?.requestSpeakingTurn?.()}
                      >
                        Request speak
                      </button>
                      <button
                        type="button"
                        className={styles.barBtn}
                        onClick={() => mediaAdapterRef.current?.cancelModerationRequest?.()}
                      >
                        Cancel request
                      </button>
                    </>
                  ) : null}
                  {user.role === 'lecturer' ? (
                    <button type="button" className={styles.barBtn} onClick={() => mediaAdapterRef.current?.toggleScreenShare()}>
                      Share screen
                    </button>
                  ) : null}
                  <RaiseHandButton
                    className={styles.barBtn}
                    activeClassName={styles.barBtnActive}
                    pressed={Boolean(localParticipantState?.raisedHand)}
                    onToggle={() => mediaAdapterRef.current?.toggleRaiseHand()}
                    disabled={classroomSession.participationLocked}
                  />
                  {USE_LIVEKIT ? (
                    <>
                      <QuestionSignalButton
                        className={styles.barBtn}
                        activeClassName={styles.barBtnActive}
                        hasQuestion={Boolean(localParticipantState?.hasQuestion)}
                        onToggle={() => mediaAdapterRef.current?.toggleQuestionSignal()}
                        disabled={classroomSession.participationLocked}
                      />
                      <ParticipationIndicators
                        disabled={classroomSession.participationLocked}
                        onAck={(kind) => mediaAdapterRef.current?.sendParticipationAck(kind)}
                      />
                    </>
                  ) : null}
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
                <div className={styles.sidebarScroll}>
                  {USE_LIVEKIT && mediaSessionActive ? (
                    <div className={styles.sidebarAttendanceRow}>
                      <LiveAttendanceBadge active />
                    </div>
                  ) : null}
                  {USE_LIVEKIT && user.role === 'lecturer' && mediaSessionActive ? (
                    <SessionMetricsPanel participants={participants} />
                  ) : null}
                  {USE_LIVEKIT && user.role === 'lecturer' && mediaSessionActive ? (
                    <LecturerControlsPanel
                      requests={classroomSession.requests}
                      participationLocked={classroomSession.participationLocked}
                      onToggleParticipationLock={handleToggleParticipationLock}
                      onReclaimPresentation={handleReclaimPresentation}
                      onRequestDecision={handleModerationRequestDecision}
                      disabled={!mediaSessionActive}
                    />
                  ) : null}
                  {raisedParticipants.length ? (
                    <p className={styles.raiseLine}>
                      Hands raised ({raisedParticipants.length}):
                      {' '}
                      {raisedParticipants.map((p) => p.name || 'Participant').join(', ')}
                    </p>
                  ) : null}
                  {USE_LIVEKIT && questionParticipants.length ? (
                    <p className={styles.raiseLine}>
                      Questions ({questionParticipants.length}):
                      {' '}
                      {questionParticipants.map((p) => p.name || 'Participant').join(', ')}
                    </p>
                  ) : null}
                  <ParticipantRoster
                    participants={participants}
                    sessionUserRole={user.role}
                    instructorView={user.role === 'lecturer'}
                    showModerationActions={USE_LIVEKIT}
                    moderationDisabled={!mediaSessionActive}
                    onModerateParticipant={handleModerateParticipant}
                  />
                </div>
              )}
              {sidebarTab === 'chat' && (
                <div className={styles.sidebarChatHost}>
                  {USE_LIVEKIT ? (
                    <div className={styles.chatPanel}>
                      <ClassroomChatPanel
                        messages={chatMessages}
                        localIdentity={localParticipantState?.id != null ? String(localParticipantState.id) : null}
                        onSend={handleChatSend}
                        disabled={!mediaSessionActive}
                      />
                    </div>
                  ) : (
                    <div className={styles.chatPanel}>
                      <p className={styles.chatPanelText}>Class chat opens in the meeting view.</p>
                      <button type="button" className={styles.secondaryCta} onClick={() => mediaAdapterRef.current?.openClassroomChat()}>
                        Open chat
                      </button>
                    </div>
                  )}
                </div>
              )}
              {sidebarTab === 'notes' && (
                <div className={styles.sidebarScroll}>
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
                </div>
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
