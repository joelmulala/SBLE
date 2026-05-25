import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Track } from 'livekit-client';
import useRoomMediaVersion from '../../hooks/useRoomMediaVersion';
import styles from './FloatingSelfView.module.css';

/**
 * Draggable local camera preview when the main stage focuses on others.
 */
export default function FloatingSelfView({
  room,
  participantCount,
  spotlightIdentity = null,
  layoutMode = 'discussion'
}) {
  const videoRef = useRef(null);
  const dragRef = useRef(null);
  const version = useRoomMediaVersion(room, room?.localParticipant);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragState = useRef({ active: false, startX: 0, startY: 0, ox: 0, oy: 0 });
  const offsetRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    offsetRef.current = offset;
  }, [offset]);

  const local = room?.localParticipant;
  const show = Boolean(
    layoutMode === 'discussion'
    && room
    && local
    && participantCount >= 2
    && spotlightIdentity
    && spotlightIdentity !== local.identity
    && local.getTrackPublication(Track.Source.Camera)?.track
  );

  useEffect(() => {
    const el = videoRef.current;
    const pub = local?.getTrackPublication(Track.Source.Camera);
    const track = pub?.track;
    if (!el || !track || !show) return undefined;

    let cancelled = false;
    const bind = () => {
      if (cancelled || !videoRef.current) return;
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
  }, [local, show, version]);

  const onPointerDown = useCallback((e) => {
    if (e.button !== 0) return;
    dragState.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      ox: offsetRef.current.x,
      oy: offsetRef.current.y
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e) => {
    if (!dragState.current.active) return;
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;
    setOffset({ x: dragState.current.ox + dx, y: dragState.current.oy + dy });
  }, []);

  const onPointerUp = useCallback((e) => {
    dragState.current.active = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (_) { /* ignore */ }
  }, []);

  if (!show) return null;

  return (
    <div
      ref={dragRef}
      className={styles.pip}
      style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      role="img"
      aria-label="Your camera preview"
    >
      <video ref={videoRef} className={styles.video} autoPlay playsInline muted />
      <span className={styles.label}>You</span>
    </div>
  );
}
