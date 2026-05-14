import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { RoomEvent, Track } from 'livekit-client';
import styles from './FloatingSelfView.module.css';

function matchesParticipant(participant, p) {
  return p && participant && p.identity === participant.identity;
}

/**
 * Draggable local camera preview when the main stage focuses on others.
 * @param {{
 *   room: import('livekit-client').Room | null,
 *   participantCount: number,
 *   spotlightIdentity?: string | null,
 *   layoutMode?: string
 * }} props
 */
export default function FloatingSelfView({
  room,
  participantCount,
  spotlightIdentity = null,
  layoutMode = 'discussion'
}) {
  const videoRef = useRef(null);
  const dragRef = useRef(null);
  const [, version] = useReducer((n) => n + 1, 0);
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
    if (!room || !local) return undefined;
    const bump = () => version();
    const onTrackSubscribed = (_t, _pub, p) => {
      if (matchesParticipant(local, p)) bump();
    };
    const onTrackUnsubscribed = (_t, _pub, p) => {
      if (matchesParticipant(local, p)) bump();
    };
    const onLocalPublished = (_pub, p) => {
      if (matchesParticipant(local, p)) bump();
    };
    const onLocalUnpublished = (_pub, p) => {
      if (matchesParticipant(local, p)) bump();
    };

    room.on(RoomEvent.TrackSubscribed, onTrackSubscribed);
    room.on(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);
    room.on(RoomEvent.LocalTrackPublished, onLocalPublished);
    room.on(RoomEvent.LocalTrackUnpublished, onLocalUnpublished);

    return () => {
      room.off(RoomEvent.TrackSubscribed, onTrackSubscribed);
      room.off(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);
      room.off(RoomEvent.LocalTrackPublished, onLocalPublished);
      room.off(RoomEvent.LocalTrackUnpublished, onLocalUnpublished);
    };
  }, [room, local]);

  useEffect(() => {
    const el = videoRef.current;
    const pub = local?.getTrackPublication(Track.Source.Camera);
    const track = pub?.track;
    if (!el || !track || !show) return undefined;
    track.attach(el);
    return () => {
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
    const t = e.target;
    if (typeof t.setPointerCapture === 'function') {
      t.setPointerCapture(e.pointerId);
    }
  }, []);

  useEffect(() => {
    const onMove = (e) => {
      if (!dragState.current.active) return;
      const dx = e.clientX - dragState.current.startX;
      const dy = e.clientY - dragState.current.startY;
      setOffset({
        x: dragState.current.ox + dx,
        y: dragState.current.oy + dy
      });
    };
    const onUp = () => {
      dragState.current.active = false;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, []);

  if (!show) return null;

  const name = local.name || 'You';

  return (
    <div
      className={styles.selfWrap}
      style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
    >
      <div
        ref={dragRef}
        className={styles.dragHandle}
        onPointerDown={onPointerDown}
        role="button"
        tabIndex={0}
        aria-label="Move self view"
      >
        You
      </div>
      <div className={styles.videoFrame}>
        <video ref={videoRef} className={styles.video} playsInline muted />
      </div>
      <div className={styles.label}>{name}</div>
    </div>
  );
}
