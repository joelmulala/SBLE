import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useReducer,
  useRef,
  useState
} from 'react';
import { RoomEvent } from 'livekit-client';
import PresentationStage from './PresentationStage';
import CameraPip from './CameraPip';
import ActivePresentationOverlay from './ActivePresentationOverlay';
import ParticipantDock from './ParticipantDock';
import ClassroomStageLayout from './ClassroomStageLayout';
import { resolvePrimarySpeakerIdentity } from '../../services/classroom/classroomParticipantUtils';
import {
  getRoomParticipants,
  resolvePresentationState,
  getDockParticipants,
  resolvePipCameraParticipant,
  isLecturerParticipant,
  resolveDiscussionSpotlightIdentity
} from '../../services/classroom/classroomStageOrchestration';
import styles from './ClassroomStage.module.css';

/**
 * @param {{
 *   room: import('livekit-client').Room | null,
 *   sidebarOpen?: boolean,
 *   presenceByIdentity?: Record<string, { raisedHand?: boolean, hasQuestion?: boolean, participationAck?: string | null }>,
 *   onStageMetaChange?: (meta: { layoutMode: string, presentationFsActive: boolean }) => void
 * }} props
 */
const ClassroomStage = forwardRef(function ClassroomStage(
  { room, sidebarOpen = false, presenceByIdentity = {}, onStageMetaChange },
  ref
) {
  const shellRef = useRef(null);
  const [, bumpLayout] = useReducer((n) => n + 1, 0);
  const [fsActive, setFsActive] = useState(false);

  useEffect(() => {
    const onFs = () => {
      setFsActive(document.fullscreenElement === shellRef.current);
    };
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  useEffect(() => {
    if (!room) return undefined;
    const on = () => bumpLayout();
    const ev = [
      RoomEvent.LocalTrackPublished,
      RoomEvent.LocalTrackUnpublished,
      RoomEvent.TrackSubscribed,
      RoomEvent.TrackUnsubscribed,
      RoomEvent.ParticipantConnected,
      RoomEvent.ParticipantDisconnected,
      RoomEvent.ParticipantMetadataChanged,
      RoomEvent.ActiveSpeakersChanged,
      RoomEvent.Reconnected
    ];
    ev.forEach((e) => room.on(e, on));
    return () => {
      ev.forEach((e) => room.off(e, on));
    };
  }, [room]);

  const layout = useMemo(() => {
    if (!room) {
      return {
        mode: 'discussion',
        presenter: null,
        studentSharePending: false,
        primaryId: null,
        discussion: [],
        dock: []
      };
    }
    const pres = resolvePresentationState(room);
    const primaryId = resolvePrimarySpeakerIdentity(room);
    const all = getRoomParticipants(room);
    const discussion = [...all].sort((a, b) => {
      const la = isLecturerParticipant(a) ? 0 : 1;
      const lb = isLecturerParticipant(b) ? 0 : 1;
      if (la !== lb) return la - lb;
      return String(a.name || a.identity).localeCompare(String(b.name || b.identity));
    });

    if (pres.mode === 'discussion' || !pres.presenter) {
      return {
        mode: 'discussion',
        presenter: null,
        studentSharePending: false,
        primaryId,
        discussion,
        dock: []
      };
    }

    const dock = getDockParticipants(room, pres.presenter.identity);
    return {
      mode: pres.mode,
      presenter: pres.presenter,
      studentSharePending: pres.studentSharePending,
      primaryId,
      discussion,
      dock
    };
  }, [room, bumpLayout]);

  const spotlightId = useMemo(() => {
    if (!room || layout.mode !== 'discussion') return null;
    return resolveDiscussionSpotlightIdentity(room, layout.primaryId);
  }, [room, layout.mode, layout.primaryId, bumpLayout]);

  useEffect(() => {
    if (typeof onStageMetaChange !== 'function') return;
    onStageMetaChange({
      layoutMode: layout.mode,
      presentationFsActive: fsActive,
      discussionSpotlightId: layout.mode === 'discussion' ? spotlightId : null,
      discussionCount: layout.discussion.length
    });
  }, [layout.mode, layout.discussion.length, fsActive, spotlightId, onStageMetaChange]);

  const pipParticipant = useMemo(() => {
    if (!room || layout.mode === 'discussion') return null;
    return resolvePipCameraParticipant(room, layout.mode, layout.presenter);
  }, [room, layout.mode, layout.presenter, bumpLayout]);

  const togglePresentationFullscreen = useCallback(() => {
    const el = shellRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      togglePresentationFullscreen,
      get presentationFsActive() {
        return fsActive;
      },
      get layoutMode() {
        return layout.mode;
      }
    }),
    [togglePresentationFullscreen, fsActive, layout.mode]
  );

  if (!room) {
    return <div className={styles.placeholder} aria-hidden />;
  }

  if (layout.mode === 'discussion') {
    return (
      <div
        className={styles.shell}
        ref={shellRef}
        data-mode="discussion"
        data-sidebar={sidebarOpen ? 'open' : 'closed'}
      >
        <ClassroomStageLayout
          room={room}
          participants={layout.discussion}
          spotlightId={spotlightId}
          primarySpeakerId={layout.primaryId}
          sidebarOpen={sidebarOpen}
          presenceByIdentity={presenceByIdentity}
        />
      </div>
    );
  }

  const showStudentOverlay = layout.mode === 'student_presentation' && layout.studentSharePending;

  return (
    <div
      className={styles.shell}
      ref={shellRef}
      data-mode={layout.mode}
      data-sidebar={sidebarOpen ? 'open' : 'closed'}
    >
      <div className={styles.presentationColumn}>
        <div className={styles.presentationCanvas}>
          <PresentationStage
            room={room}
            presenter={layout.presenter}
            activeSpeakerId={layout.primaryId}
          />
          {pipParticipant ? <CameraPip room={room} participant={pipParticipant} /> : null}
          {showStudentOverlay ? <ActivePresentationOverlay variant="student_pending" /> : null}
        </div>
        {layout.dock.length ? (
          <ParticipantDock
            room={room}
            participants={layout.dock}
            primarySpeakerId={layout.primaryId}
            layout="dock"
            emphasizeLecturer={layout.mode === 'student_presentation'}
            compact={sidebarOpen}
            presenceByIdentity={presenceByIdentity}
          />
        ) : null}
      </div>
    </div>
  );
});

export default ClassroomStage;
