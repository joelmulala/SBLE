import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useKeycloak } from '../auth/AuthProvider';
import api from '../config/api';

const JITSI_API_SCRIPT = 'https://meet.jit.si/external_api.js';

export default function Room() {
  const { roomId, token } = useParams();
  const { keycloak } = useKeycloak();
  const jitsiContainerRef = useRef(null);
  const jitsiApiRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [roomDetails, setRoomDetails] = useState(null);
  const presenceTimerRef = useRef(null);
  const activeRoomId = decodeURIComponent(roomId || token || '').trim();

  const user = useMemo(() => ({
    name: keycloak.tokenParsed?.name || 'User',
    role: keycloak.hasRealmRole('lecturer') || keycloak.hasRealmRole('admin') ? 'lecturer' : 'student'
  }), [keycloak]);

  useEffect(() => {
    if (!activeRoomId || !jitsiContainerRef.current) return undefined;

    let disposed = false;

    const createMeeting = () => {
      if (disposed || !window.JitsiMeetExternalAPI) return;

      const isLecturer = user.role === 'lecturer';
      const domain = 'meet.jit.si';
      const options = {
        roomName: activeRoomId,
        parentNode: jitsiContainerRef.current,
        userInfo: {
          displayName: user.name,
          role: isLecturer ? 'moderator' : 'participant'
        },
        configOverwrite: {
          enableUserRolesBasedOnToken: false,
          prejoinPageEnabled: false,
          startWithAudioMuted: false,
          startWithVideoMuted: false,
          disableRemoteMute: !isLecturer,
          localRecording: {
            enabled: isLecturer
          },
          fileRecordingsEnabled: isLecturer
        },
        interfaceConfigOverwrite: {
          TOOLBAR_BUTTONS: isLecturer
            ? [
                'microphone',
                'camera',
                'desktop',
                'fullscreen',
                'fodeviceselection',
                'hangup',
                'chat',
                'participants-pane',
                'recording',
                'raisehand',
                'tileview',
                'settings',
                'security'
              ]
            : [
                'microphone',
                'camera',
                'fullscreen',
                'hangup',
                'chat',
                'raisehand',
                'tileview',
                'settings'
              ]
        }
      };

      const api = new window.JitsiMeetExternalAPI(domain, options);
      jitsiApiRef.current = api;

      api.addEventListener('videoConferenceJoined', () => {
        if (!disposed) setIsLoading(false);
      });

      api.addEventListener('readyToClose', () => {
        if (!disposed) setIsLoading(false);
      });
    };

    const loadScript = () => new Promise((resolve, reject) => {
      if (window.JitsiMeetExternalAPI) {
        resolve();
        return;
      }

      const existingScript = document.querySelector(`script[src="${JITSI_API_SCRIPT}"]`);
      if (existingScript) {
        existingScript.addEventListener('load', resolve, { once: true });
        existingScript.addEventListener('error', reject, { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = JITSI_API_SCRIPT;
      script.async = true;
      script.onload = resolve;
      script.onerror = reject;
      document.body.appendChild(script);
    });

    const initMeeting = async () => {
      setIsLoading(true);
      setLoadError('');

      try {
        const accessResponse = await api.get(`/rooms/${encodeURIComponent(activeRoomId)}/access`);
        if (disposed) return;
        setRoomDetails(accessResponse.data);

        if (user.role === 'lecturer') {
          await api.post(`/rooms/${encodeURIComponent(activeRoomId)}/presence`, { active: true });
          presenceTimerRef.current = window.setInterval(() => {
            api.post(`/rooms/${encodeURIComponent(activeRoomId)}/presence`, { active: true }).catch(() => {});
          }, 20000);
        }

        await loadScript();
        if (disposed) return;
        createMeeting();
      } catch (error) {
        if (!disposed) {
          const apiError = error?.response?.data?.error;
          setLoadError(apiError || 'You do not have access to this room.');
          setIsLoading(false);
        }
      }
    };

    initMeeting();

    return () => {
      disposed = true;
      if (presenceTimerRef.current) {
        clearInterval(presenceTimerRef.current);
        presenceTimerRef.current = null;
      }

      if (user.role === 'lecturer' && activeRoomId) {
        api.post(`/rooms/${encodeURIComponent(activeRoomId)}/presence`, { active: false }).catch(() => {});
      }

      if (jitsiApiRef.current) {
        jitsiApiRef.current.dispose();
        jitsiApiRef.current = null;
      }
    };
  }, [activeRoomId, user.name, user.role]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: 'calc(100vh - 140px)', minHeight: 520 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a' }}>Live Room</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 10, fontSize: '0.9rem', color: '#475569' }}>
          {roomDetails?.course?.title ? <span>Course: {roomDetails.course.title}</span> : null}
          <span>Room ID: {activeRoomId}</span>
          <span>Role: {user.role === 'lecturer' ? 'Lecturer (moderator tools enabled)' : 'Student'}</span>
        </div>
      </div>

      {isLoading && (
        <div style={{ padding: '10px 14px', borderRadius: 10, background: '#e0f2fe', color: '#0c4a6e', fontSize: '0.92rem' }}>
          {user.role === 'student' ? 'Waiting for lecturer to start class...' : 'Loading meeting room...'}
        </div>
      )}

      {loadError && (
        <div style={{ padding: '10px 14px', borderRadius: 10, background: '#fee2e2', color: '#991b1b', fontSize: '0.92rem' }}>
          {loadError}
        </div>
      )}

      <div
        ref={jitsiContainerRef}
        id="jitsi-container"
        style={{
          width: '100%',
          height: '100%',
          minHeight: 420,
          borderRadius: 14,
          overflow: 'hidden',
          background: '#020617',
          boxShadow: '0 10px 30px rgba(2, 6, 23, 0.15)'
        }}
      />
    </div>
  );
}
