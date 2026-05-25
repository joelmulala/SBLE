import React, { useEffect, useRef } from 'react';
import { Track } from 'livekit-client';
import useRoomMediaVersion from '../../hooks/useRoomMediaVersion';
import styles from './PresentationStage.module.css';

/**
 * Full-bleed shared content only (no camera mixed into this surface).
 * @param {{
 *   room: import('livekit-client').Room,
 *   presenter: import('livekit-client').Participant,
 *   activeSpeakerId?: string | null
 * }} props
 */
export default function PresentationStage({ room, presenter, activeSpeakerId = null }) {
  const videoRef = useRef(null);
  const version = useRoomMediaVersion(room, presenter);

  useEffect(() => {
    const el = videoRef.current;
    const pub = presenter?.getTrackPublication(Track.Source.ScreenShare);
    const track = pub?.track;
    if (!el || !track) return undefined;

    let cancelled = false;
    const bind = () => {
      if (cancelled || !videoRef.current || !track) return;
      try {
        track.detach(videoRef.current);
        track.attach(videoRef.current);
        const p = videoRef.current.play?.();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      } catch (_) { /* ignore */ }
    };

    bind();
    const rafId = requestAnimationFrame(bind);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      try {
        track.detach(el);
      } catch (_) { /* ignore */ }
    };
  }, [presenter, version]);

  const speaking = activeSpeakerId && presenter && activeSpeakerId === presenter.identity;
  const hasTrack = Boolean(presenter?.getTrackPublication(Track.Source.ScreenShare)?.track);

  return (
    <div
      className={[
        styles.surface,
        speaking && styles.surfaceSpeaker
      ].filter(Boolean).join(' ')}
      role="region"
      aria-label="Shared presentation"
    >
      <video ref={videoRef} className={styles.video} playsInline muted />
      {!hasTrack ? (
        <div className={styles.waiting}>Preparing shared content…</div>
      ) : null}
    </div>
  );
}
