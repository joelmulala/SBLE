import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import ClassroomStage from './ClassroomStage';
import styles from './ClassroomMediaStage.module.css';

/**
 * SBLE-owned LiveKit video stage (orchestrated from Room.js).
 */
const ClassroomMediaStage = forwardRef(function ClassroomMediaStage(
  {
    room,
    sidebarOpen = false,
    presentationExpanded = false,
    presenceByIdentity = {},
    onStageMetaChange
  },
  ref
) {
  const stageRef = useRef(null);

  useImperativeHandle(
    ref,
    () => ({
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
        presentationExpanded={presentationExpanded}
        presenceByIdentity={presenceByIdentity}
        onStageMetaChange={onStageMetaChange}
      />
    </div>
  );
});

export default ClassroomMediaStage;
export { ClassroomMediaStage as LiveClassroomStage };
