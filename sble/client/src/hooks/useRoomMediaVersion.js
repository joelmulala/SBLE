import { useEffect, useReducer } from 'react';
import { RoomEvent } from 'livekit-client';

/**
 * Bump render when room tracks, participants, or connection recover.
 * @param {import('livekit-client').Room | null} room
 * @param {import('livekit-client').Participant | null | undefined} [participant] optional filter
 */
export default function useRoomMediaVersion(room, participant = null) {
  const [, version] = useReducer((n) => n + 1, 0);

  useEffect(() => {
    if (!room) return undefined;
    const bump = () => version();

    const match = (p) => !participant || (p && participant && p.identity === participant.identity);

    const onTrackSubscribed = (_t, _pub, p) => {
      if (match(p)) bump();
    };
    const onTrackUnsubscribed = (_t, _pub, p) => {
      if (match(p)) bump();
    };
    const onLocalPublished = (_pub, p) => {
      if (match(p)) bump();
    };
    const onLocalUnpublished = (_pub, p) => {
      if (match(p)) bump();
    };
    const onMeta = (_prev, p) => {
      if (match(p)) bump();
    };
    const onName = (_name, p) => {
      if (match(p)) bump();
    };

    const globalBumpEvents = participant
      ? []
      : [
        RoomEvent.ParticipantConnected,
        RoomEvent.ParticipantDisconnected,
        RoomEvent.ActiveSpeakersChanged,
        RoomEvent.Reconnected
      ];

    const onTrackMuted = (_pub, p) => {
      if (match(p)) bump();
    };
    const onTrackUnmuted = (_pub, p) => {
      if (match(p)) bump();
    };

    room.on(RoomEvent.TrackSubscribed, onTrackSubscribed);
    room.on(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);
    room.on(RoomEvent.TrackMuted, onTrackMuted);
    room.on(RoomEvent.TrackUnmuted, onTrackUnmuted);
    room.on(RoomEvent.LocalTrackPublished, onLocalPublished);
    room.on(RoomEvent.LocalTrackUnpublished, onLocalUnpublished);
    room.on(RoomEvent.ParticipantMetadataChanged, onMeta);
    room.on(RoomEvent.ParticipantNameChanged, onName);
    globalBumpEvents.forEach((e) => room.on(e, bump));
    if (participant) {
      room.on(RoomEvent.Reconnected, bump);
    }

    return () => {
      room.off(RoomEvent.TrackSubscribed, onTrackSubscribed);
      room.off(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);
      room.off(RoomEvent.TrackMuted, onTrackMuted);
      room.off(RoomEvent.TrackUnmuted, onTrackUnmuted);
      room.off(RoomEvent.LocalTrackPublished, onLocalPublished);
      room.off(RoomEvent.LocalTrackUnpublished, onLocalUnpublished);
      room.off(RoomEvent.ParticipantMetadataChanged, onMeta);
      room.off(RoomEvent.ParticipantNameChanged, onName);
      globalBumpEvents.forEach((e) => room.off(e, bump));
      if (participant) {
        room.off(RoomEvent.Reconnected, bump);
      }
    };
  }, [room, participant]);

  return version;
}
