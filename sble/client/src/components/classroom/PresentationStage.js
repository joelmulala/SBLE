import React, { useEffect, useReducer, useRef } from 'react';
import { RoomEvent, Track } from 'livekit-client';
import styles from './PresentationStage.module.css';

function matchesParticipant(participant, p) {
  return p && participant && p.identity === participant.identity;
}

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
  const [, version] = useReducer((n) => n + 1, 0);

  useEffect(() => {
    if (!room || !presenter) return undefined;
    const bump = () => version();
    const onTrackSubscribed = (_t, _pub, p) => {
      if (matchesParticipant(presenter, p)) bump();
    };
    const onTrackUnsubscribed = (_t, _pub, p) => {
      if (matchesParticipant(presenter, p)) bump();
    };
    const onLocalPublished = (_pub, p) => {
      if (matchesParticipant(presenter, p)) bump();
    };
    const onLocalUnpublished = (_pub, p) => {
      if (matchesParticipant(presenter, p)) bump();
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
  }, [room, presenter]);

  useEffect(() => {
    const el = videoRef.current;
    const pub = presenter?.getTrackPublication(Track.Source.ScreenShare);
    const track = pub?.track;
    if (!el || !track) return undefined;
    track.attach(el);
    return () => {
      try {
        track.detach(el);
      } catch (_) { /* ignore */ }
    };
  }, [presenter, version]);

  const speaking = activeSpeakerId && presenter && activeSpeakerId === presenter.identity;

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
      {!presenter?.getTrackPublication(Track.Source.ScreenShare)?.track ? (
        <div className={styles.waiting}>Preparing shared content…</div>
      ) : null}
    </div>
  );
}
