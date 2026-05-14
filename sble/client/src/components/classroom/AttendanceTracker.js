import React from 'react';
import { useLiveClassAttendance } from '../../hooks/useLiveClassAttendance';

/**
 * @param {{ roomToken: string, enabled: boolean, metrics?: object }} props
 */
export default function AttendanceTracker({ roomToken, enabled, metrics = {} }) {
  useLiveClassAttendance({ roomToken, enabled, metrics });
  return null;
}
