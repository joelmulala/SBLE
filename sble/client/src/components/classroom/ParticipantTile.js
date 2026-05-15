import React, { useEffect, useReducer, useRef } from 'react';
import { RoomEvent, Track, isLocalParticipant } from 'livekit-client';
import ReactionBadgeOverlay from './ReactionBadgeOverlay';
import styles from './ParticipantTile.module.css';

function roleLabel(metadata) {
  if (!metadata || typeof metadata !== 'string') return '';
  try {
    const m = JSON.parse(metadata);
    if (m.role === 'admin') return 'Admin';
    if (m.role === 'lecturer') return 'Instructor';
    if (m.role === 'student') return 'Student';
  } catch (_) { /* ignore */ }
  return '';
}

function matchesParticipant(participant, p) {
  return p && participant && p.identity === participant.identity;
}

/**
 * @param {{
 *   room: import('livekit-client').Room,
 *   participant: import('livekit-client').Participant,
 *   variant?: 'grid' | 'main' | 'strip' | 'dock' | 'cinema',
 *   isPrimarySpeaker?: boolean,
 *   isLecturerRole?: boolean,
 *   dimmed?: boolean,
 *   signals?: { raisedHand?: boolean, hasQuestion?: boolean, participationAck?: string | null }
 * }} props
 */
export default function ParticipantTile({
  room,
  participant,
  variant = 'grid',
  isPrimarySpeaker = false,
  isLecturerRole = false,
  dimmed = false,
  signals = null
}) {
  const camRef = useRef(null);
  const screenRef = useRef(null);
  const audioMountRef = useRef(null);
  const [, version] = useReducer((n) => n + 1, 0);

  const camPub = participant.getTrackPublication(Track.Source.Camera);
  const screenPub = participant.getTrackPublication(Track.Source.ScreenShare);
  const hasCameraTrack = Boolean(camPub?.track);
  const hasScreen = Boolean(screenPub?.track);

  useEffect(() => {
    if (!room) return undefined;
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
    const onMeta = (_prev, p) => {
      if (matchesParticipant(participant, p)) bump();
    };
    const onName = (_name, p) => {
      if (matchesParticipant(participant, p)) bump();
    };

    room.on(RoomEvent.TrackSubscribed, onTrackSubscribed);
    room.on(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);
    room.on(RoomEvent.LocalTrackPublished, onLocalPublished);
    room.on(RoomEvent.LocalTrackUnpublished, onLocalUnpublished);
    room.on(RoomEvent.ParticipantMetadataChanged, onMeta);
    room.on(RoomEvent.ParticipantNameChanged, onName);

    return () => {
      room.off(RoomEvent.TrackSubscribed, onTrackSubscribed);
      room.off(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);
      room.off(RoomEvent.LocalTrackPublished, onLocalPublished);
      room.off(RoomEvent.LocalTrackUnpublished, onLocalUnpublished);
      room.off(RoomEvent.ParticipantMetadataChanged, onMeta);
      room.off(RoomEvent.ParticipantNameChanged, onName);
    };
  }, [room, participant]);

  useEffect(() => {
    const camEl = camRef.current;
    const screenEl = screenRef.current;
    const camPublication = participant.getTrackPublication(Track.Source.Camera);
    const screenPubInner = participant.getTrackPublication(Track.Source.ScreenShare);
    const attached = [];

    if (camPublication?.track && camEl) {
      camPublication.track.attach(camEl);
      attached.push({ track: camPublication.track, el: camEl });
    }
    if (screenPubInner?.track && screenEl) {
      screenPubInner.track.attach(screenEl);
      attached.push({ track: screenPubInner.track, el: screenEl });
    }

    return () => {
      attached.forEach(({ track, el }) => {
        try {
          track.detach(el);
        } catch (_) { /* ignore */ }
      });
    };
  }, [participant, version]);

  useEffect(() => {
    const host = audioMountRef.current;
    if (!host) return undefined;
    const attached = [];

    participant.audioTrackPublications.forEach((pub) => {
      const t = pub.track;
      if (!t) return;
      const a = document.createElement('audio');
      a.autoplay = true;
      if (isLocalParticipant(participant)) {
        a.muted = true;
      }
      t.attach(a);
      host.appendChild(a);
      attached.push({ track: t, el: a });
    });

    return () => {
      attached.forEach(({ track, el }) => {
        try {
          track.detach(el);
        } catch (_) { /* ignore */ }
        el.remove();
      });
    };
  }, [participant, version]);

  const name = participant.name || participant.identity || 'Participant';
  const rLabel = roleLabel(participant.metadata);
  const avatarInitial = (name.trim().charAt(0) || '?').toUpperCase();

  const rootClass = [
    styles.tile,
    variant === 'main' && styles.tileMain,
    variant === 'cinema' && styles.tileCinema,
    variant === 'strip' && styles.tileStrip,
    variant === 'dock' && styles.tileDock,
    isPrimarySpeaker && styles.tileSpeaking,
    isLecturerRole && styles.tileLecturer,
    dimmed && styles.tileDimmed
  ].filter(Boolean).join(' ');

  return (
    <div className={rootClass}>
      {isLecturerRole && (variant === 'grid' || variant === 'strip' || variant === 'dock') ? (
        <span className={styles.lecturerBadge} title="Instructor">
          Instructor
        </span>
      ) : null}
      {!hasCameraTrack ? (
        <div className={styles.tileAvatar} aria-hidden>
          {avatarInitial}
        </div>
      ) : null}
      <video
        ref={camRef}
        className={[styles.tileVideo, !hasCameraTrack && styles.tileVideoHidden].filter(Boolean).join(' ')}
        autoPlay
        playsInline
        muted={isLocalParticipant(participant)}
      />
      <video
        ref={screenRef}
        className={hasScreen ? styles.tileScreen : styles.tileScreenHidden}
        playsInline
        muted
      />
      <div ref={audioMountRef} className={styles.audioMount} aria-hidden />
      {signals ? (
        <ReactionBadgeOverlay
          raisedHand={Boolean(signals.raisedHand)}
          hasQuestion={Boolean(signals.hasQuestion)}
          participationAck={signals.participationAck || null}
        />
      ) : null}
      <div className={styles.tileLabel}>
        <div className={styles.tileName}>{name}</div>
        {rLabel && !isLecturerRole ? <div className={styles.tileRole}>{rLabel}</div> : null}
      </div>
    </div>
  );
}
