import React from 'react';
import styles from './LiveAttendanceBadge.module.css';

/**
 * @param {{ active?: boolean }} props
 */
export default function LiveAttendanceBadge({ active = false, joinedCount = 0 }) {
  if (!active) return null;
  return (
    <span className={styles.badge} title="Attendance is recorded automatically while you remain in class">
      <span className={styles.dot} aria-hidden />
      Attendance recording
      {joinedCount > 0 ? <span className={styles.meta}> · {joinedCount} in class</span> : null}
    </span>
  );
}
