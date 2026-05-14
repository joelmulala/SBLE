import React from 'react';
import styles from './LiveAttendanceBadge.module.css';

/**
 * @param {{ active?: boolean }} props
 */
export default function LiveAttendanceBadge({ active = false }) {
  if (!active) return null;
  return (
    <span className={styles.badge} title="Attendance is being recorded for this session">
      Attendance on
    </span>
  );
}
