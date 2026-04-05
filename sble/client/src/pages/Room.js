import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';

const ICE_SERVERS = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

export default function Room() {
  const { token } = useParams();
  const wsRef = useRef(null);
  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peersRef = useRef({}); // peerId -> RTCPeerConnection
  const [remoteStreams, setRemoteStreams] = useState({}); // peerId -> MediaStream
  const [myId, setMyId] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);

  useEffect(() => {
    const wsUrl = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws/?room=${token}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    // Get local media
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    });

    ws.onmessage = async (event) => {
      const msg = JSON.parse(event.data);

      switch (msg.type) {
        case 'connected':
          setMyId(msg.peerId);
          break;

        case 'peer-joined':
          await createOffer(msg.peerId);
          break;

        case 'offer':
          await handleOffer(msg);
          break;

        case 'answer':
          await peersRef.current[msg.from]?.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          break;

        case 'ice-candidate':
          await peersRef.current[msg.from]?.addIceCandidate(new RTCIceCandidate(msg.candidate));
          break;

        case 'peer-left':
          removePeer(msg.peerId);
          break;

        case 'chat':
          setChatMessages(prev => [...prev, { from: msg.from, text: msg.text }]);
          break;

        default: break;
      }
    };

    return () => {
      ws.close();
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      Object.values(peersRef.current).forEach(pc => pc.close());
    };
  }, [token]);

  const createPeerConnection = (peerId) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    peersRef.current[peerId] = pc;

    localStreamRef.current?.getTracks().forEach(t => pc.addTrack(t, localStreamRef.current));

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        wsRef.current.send(JSON.stringify({ type: 'ice-candidate', to: peerId, candidate: e.candidate }));
      }
    };

    pc.ontrack = (e) => {
      setRemoteStreams(prev => ({ ...prev, [peerId]: e.streams[0] }));
    };

    return pc;
  };

  const createOffer = async (peerId) => {
    const pc = createPeerConnection(peerId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    wsRef.current.send(JSON.stringify({ type: 'offer', to: peerId, sdp: offer }));
  };

  const handleOffer = async ({ from, sdp }) => {
    const pc = createPeerConnection(from);
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    wsRef.current.send(JSON.stringify({ type: 'answer', to: from, sdp: answer }));
  };

  const removePeer = (peerId) => {
    peersRef.current[peerId]?.close();
    delete peersRef.current[peerId];
    setRemoteStreams(prev => { const s = { ...prev }; delete s[peerId]; return s; });
  };

  const sendChat = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    wsRef.current.send(JSON.stringify({ type: 'chat', text: chatInput }));
    setChatMessages(prev => [...prev, { from: 'me', text: chatInput }]);
    setChatInput('');
  };

  const toggleMute = () => {
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = muted; });
    setMuted(!muted);
  };

  const toggleVideo = () => {
    localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = videoOff; });
    setVideoOff(!videoOff);
  };

  return (
    <div style={{ display: 'flex', gap: 16, height: '80vh' }}>
      {/* Video grid */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <video ref={localVideoRef} autoPlay muted playsInline
            style={{ width: 240, borderRadius: 8, background: '#000' }} />
          {Object.entries(remoteStreams).map(([peerId, stream]) => (
            <RemoteVideo key={peerId} stream={stream} />
          ))}
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: 10, marginTop: 'auto' }}>
          <button onClick={toggleMute}
            style={{ padding: '10px 20px', borderRadius: 6, border: 'none', background: muted ? '#dc3545' : '#28a745', color: '#fff', cursor: 'pointer' }}>
            {muted ? 'Unmute' : 'Mute'}
          </button>
          <button onClick={toggleVideo}
            style={{ padding: '10px 20px', borderRadius: 6, border: 'none', background: videoOff ? '#dc3545' : '#28a745', color: '#fff', cursor: 'pointer' }}>
            {videoOff ? 'Start Video' : 'Stop Video'}
          </button>
        </div>
      </div>

      {/* Chat panel */}
      <div style={{ width: 280, display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 8, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        <h3 style={{ marginBottom: 12 }}>Chat</h3>
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {chatMessages.map((m, i) => (
            <div key={i} style={{ fontSize: '0.9rem' }}>
              <strong>{m.from === 'me' ? 'You' : m.from.slice(0, 6)}:</strong> {m.text}
            </div>
          ))}
        </div>
        <form onSubmit={sendChat} style={{ display: 'flex', gap: 6, marginTop: 12 }}>
          <input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Message..."
            style={{ flex: 1, padding: '8px', borderRadius: 6, border: '1px solid #ddd' }} />
          <button type="submit" style={{ background: '#4f8ef7', color: '#fff', padding: '8px 12px', borderRadius: 6, border: 'none', cursor: 'pointer' }}>
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

// Attach remote stream to video element
function RemoteVideo({ stream }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.srcObject = stream; }, [stream]);
  return <video ref={ref} autoPlay playsInline style={{ width: 240, borderRadius: 8, background: '#000' }} />;
}
