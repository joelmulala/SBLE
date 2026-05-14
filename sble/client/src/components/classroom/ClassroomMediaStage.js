import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import ClassroomStage from './ClassroomStage';
import styles from './ClassroomMediaStage.module.css';

/**
 * SBLE-owned LiveKit video stage (orchestrated from Room.js).
 * @param {{
 *   room: import('livekit-client').Room | null,
 *   sidebarOpen?: boolean,
 *   presenceByIdentity?: Record<string, { raisedHand?: boolean, hasQuestion?: boolean, participationAck?: string | null }>,
 *   onStageMetaChange?: (meta: {
 *     layoutMode: string,
 *     presentationFsActive: boolean,
 *     discussionSpotlightId: string | null,
 *     discussionCount: number
 *   }) => void
 * }} props
 */
const ClassroomMediaStage = forwardRef(function ClassroomMediaStage(
  { room, sidebarOpen = false, presenceByIdentity = {}, onStageMetaChange },
  ref
) {
  const stageRef = useRef(null);

  useImperativeHandle(
    ref,
    () => ({
      togglePresentationFullscreen: () => stageRef.current?.togglePresentationFullscreen?.(),
      get presentationFsActive() {
        return stageRef.current?.presentationFsActive ?? false;
      },
      get layoutMode() {
        return stageRef.current?.layoutMode ?? 'discussion';
      }
    }),
    []
  );

  if (!room) {
    return <div className={styles.stagePlaceholder} aria-hidden />;
  }
  return (
    <div className={styles.stageRoot}>
      <ClassroomStage
        ref={stageRef}
        room={room}
        sidebarOpen={sidebarOpen}
        presenceByIdentity={presenceByIdentity}
        onStageMetaChange={onStageMetaChange}
      />
    </div>
  );
});

export default ClassroomMediaStage;
