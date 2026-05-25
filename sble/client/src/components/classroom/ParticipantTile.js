import React, { useEffect, useRef } from 'react';
import { Track, isLocalParticipant } from 'livekit-client';
import useRoomMediaVersion from '../../hooks/useRoomMediaVersion';
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

function attachVideoTrack(track, el) {
  if (!track || !el) return;
  try {
    track.detach(el);
    track.attach(el);
    const playPromise = el.play?.();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {});
    }
  } catch (_) { /* ignore */ }
}

/**
 * @param {{
 *   room: import('livekit-client').Room,
 *   participant: import('livekit-client').Participant,
 *   variant?: 'grid' | 'main' | 'strip' | 'dock' | 'cinema',
 *   isPrimarySpeaker?: boolean,
 *   isLecturerRole?: boolean,
 *   dimmed?: boolean,
 *   hideLabel?: boolean,
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
  hideLabel = false,
  signals = null
}) {
  const camRef = useRef(null);
  const screenRef = useRef(null);
  const audioMountRef = useRef(null);
  const version = useRoomMediaVersion(room, participant);

  const camPub = participant.getTrackPublication(Track.Source.Camera);
  const screenPub = participant.getTrackPublication(Track.Source.ScreenShare);
  const cameraTrack = camPub?.track;
  const hasCameraTrack = Boolean(cameraTrack);
  const hasScreen = Boolean(screenPub?.track);
  const showAvatar = !hasCameraTrack && !participant.isCameraEnabled;

  useEffect(() => {
    const camEl = camRef.current;
    const screenEl = screenRef.current;
    const camPublication = participant.getTrackPublication(Track.Source.Camera);
    const screenPubInner = participant.getTrackPublication(Track.Source.ScreenShare);
    const attached = [];
    let rafId = 0;
    let cancelled = false;

    const bind = () => {
      if (cancelled) return;
      const camTrack = camPublication?.track;
      const screenTrack = screenPubInner?.track;
      if (camTrack && camEl) {
        attachVideoTrack(camTrack, camEl);
        attached.push({ track: camTrack, el: camEl });
      }
      if (screenTrack && screenEl) {
        attachVideoTrack(screenTrack, screenEl);
        attached.push({ track: screenTrack, el: screenEl });
      }
    };

    bind();
    rafId = requestAnimationFrame(bind);

    const onPublicationUpdate = () => {
      if (!cancelled) bind();
    };
    camPublication?.on?.('subscribed', onPublicationUpdate);
    screenPubInner?.on?.('subscribed', onPublicationUpdate);

    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      camPublication?.off?.('subscribed', onPublicationUpdate);
      screenPubInner?.off?.('subscribed', onPublicationUpdate);
      attached.forEach(({ track, el }) => {
        try {
          track.detach(el);
        } catch (_) { /* ignore */ }
      });
    };
  }, [participant, version, cameraTrack, screenPub?.track]);

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
  const showTileLabel = !hideLabel && variant !== 'cinema' && variant !== 'main';

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
      {showAvatar ? (
        <div className={styles.tileAvatar} aria-hidden>
          {avatarInitial}
        </div>
      ) : null}
      <video
        ref={camRef}
        className={styles.tileVideo}
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
          participationAck={signals.participationAck || null}
        />
      ) : null}
      {showTileLabel ? (
        <div className={styles.tileLabel}>
          <div className={styles.tileName}>{name}</div>
          {rLabel && !isLecturerRole ? <div className={styles.tileRole}>{rLabel}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
