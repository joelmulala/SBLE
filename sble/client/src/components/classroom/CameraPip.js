import React, { useEffect, useReducer, useRef } from 'react';
import { RoomEvent, Track, isLocalParticipant } from 'livekit-client';
import styles from './CameraPip.module.css';

function matchesParticipant(participant, p) {
  return p && participant && p.identity === participant.identity;
}

/**
 * Instructor camera picture-in-picture while slides or student share are primary.
 * @param {{ room: import('livekit-client').Room, participant: import('livekit-client').Participant }} props
 */
export default function CameraPip({ room, participant }) {
  const videoRef = useRef(null);
  const [, version] = useReducer((n) => n + 1, 0);

  useEffect(() => {
    if (!room || !participant) return undefined;
    const bump = () => version();
    const onTrackSubscribed = (_t, _pub, p) => {
      if (matchesParticipant(participant, p)) bump();
    };
    const onTrackUnsubscribed = (_t, _pub, p) => {
      if (matchesParticipant(participant, p)) bump();
    };
    const onLocalPublished = (_pub, p) => {
      if (matchesParticipant(participant, p)) bump();
    };
    const onLocalUnpublished = (_pub, p) => {
      if (matchesParticipant(participant, p)) bump();
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
  }, [room, participant]);

  useEffect(() => {
    const el = videoRef.current;
    const pub = participant?.getTrackPublication(Track.Source.Camera);
    const track = pub?.track;
    if (!el || !track) return undefined;
    track.attach(el);
    return () => {
      try {
        track.detach(el);
      } catch (_) { /* ignore */ }
    };
  }, [participant, version]);

  if (!participant?.getTrackPublication(Track.Source.Camera)?.track) {
    return null;
  }

  const name = participant.name || participant.identity || 'Instructor';

  return (
    <div className={styles.pip} role="complementary" aria-label={`Instructor camera · ${name}`}>
      <video
        ref={videoRef}
        className={styles.pipVideo}
        playsInline
        muted={isLocalParticipant(participant)}
      />
      <div className={styles.pipLabel}>{name}</div>
    </div>
  );
}
