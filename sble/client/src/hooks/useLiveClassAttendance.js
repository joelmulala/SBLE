import { useEffect, useRef } from 'react';
import api from '../config/api';

/**
 * Heartbeat attendance to SBLE while the live media session is active.
 * Reconnect-safe: one row per user per open session; gaps capped server-side.
 *
 * @param {{ roomToken: string, enabled: boolean, metrics?: object }} opts
 */
export function useLiveClassAttendance({ roomToken, enabled, metrics = {} }) {
  const metricsRef = useRef(metrics);
  metricsRef.current = metrics;

  useEffect(() => {
    if (!roomToken || !enabled) return undefined;

    const tokenEnc = encodeURIComponent(roomToken);
    const tick = () => {
      api.post(`/rooms/${tokenEnc}/session/ping`, { metrics: metricsRef.current || {} }).catch(() => {});
    };

    tick();
    const id = setInterval(tick, 45000);

    return () => {
      clearInterval(id);
      api.post(`/rooms/${tokenEnc}/session/leave`, {}).catch(() => {});
    };
  }, [roomToken, enabled]);
}
