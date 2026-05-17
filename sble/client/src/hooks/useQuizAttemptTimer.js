import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Server-authoritative countdown. Calls onExpire once when time reaches zero.
 */
export default function useQuizAttemptTimer({ expiresAt, secondsRemaining, enabled, onExpire }) {
  const [secondsLeft, setSecondsLeft] = useState(null);
  const expiredRef = useRef(false);

  const syncFromServer = useCallback((payload = {}) => {
    if (Number.isFinite(payload.seconds_remaining)) {
      setSecondsLeft(Math.max(0, Math.floor(payload.seconds_remaining)));
      expiredRef.current = false;
      return;
    }
    const exp = payload.attempt_expires_at || expiresAt;
    if (exp) {
      setSecondsLeft(Math.max(0, Math.floor((new Date(exp).getTime() - Date.now()) / 1000)));
      expiredRef.current = false;
    }
  }, [expiresAt]);

  useEffect(() => {
    if (Number.isFinite(secondsRemaining)) {
      syncFromServer({ seconds_remaining: secondsRemaining });
    }
  }, [secondsRemaining, syncFromServer]);

  useEffect(() => {
    if (!enabled) return undefined;
    const exp = expiresAt ? new Date(expiresAt).getTime() : null;
    if (!exp) return undefined;

    const tick = () => {
      const left = Math.max(0, Math.floor((exp - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpire?.();
      }
    };

    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [enabled, expiresAt, onExpire]);

  return { secondsLeft, syncFromServer };
}
