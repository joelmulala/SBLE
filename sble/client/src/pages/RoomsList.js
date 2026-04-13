import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useKeycloak } from '../auth/AuthProvider';
import api from '../config/api';

export default function RoomsList() {
  const navigate = useNavigate();
  const { keycloak } = useKeycloak();
  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [activeRooms, setActiveRooms] = useState([]);
  const [createdRoom, setCreatedRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isLecturer = keycloak.hasRealmRole('lecturer') || keycloak.hasRealmRole('admin');
  const userName = keycloak.tokenParsed?.name || 'User';

  const helperText = useMemo(() => (
    isLecturer
      ? 'Select a course and start a live class linked to that course.'
      : 'Join active live classes from courses where you are enrolled.'
  ), [isLecturer]);

  const activeCourseIds = useMemo(() => {
    const ids = new Set();
    activeRooms.forEach((room) => {
      if (room?.courseId !== undefined && room?.courseId !== null) {
        ids.add(String(room.courseId));
      }
    });
    return ids;
  }, [activeRooms]);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      setLoading(true);
      setError('');

      try {
        const requests = [api.get('/rooms/active')];
        if (isLecturer) {
          requests.push(api.get('/courses'));
        }

        const [roomsRes, coursesRes] = await Promise.all(requests);

        if (cancelled) return;

        setActiveRooms(Array.isArray(roomsRes.data) ? roomsRes.data : []);

        if (isLecturer) {
          const nextCourses = Array.isArray(coursesRes?.data) ? coursesRes.data : [];
          setCourses(nextCourses);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.response?.data?.error || err.message || 'Failed to load room data.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadData();
    return () => { cancelled = true; };
  }, [isLecturer]);

  const handleCreateRoom = async () => {
    if (!selectedCourseId) {
      setError('Select a course before starting a live class.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const response = await api.post('/rooms/create', {
        courseId: Number(selectedCourseId)
      });
      const nextRoom = response.data;
      setCreatedRoom(nextRoom);
      navigate(`/room/${encodeURIComponent(nextRoom.roomId)}`);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to create room.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoinRoom = (roomId) => {
    navigate(`/room/${encodeURIComponent(roomId)}`);
  };

  return (
    <div style={{ display: 'grid', gap: 18, maxWidth: 860 }}>
      <section style={heroCardStyle}>
        <div>
          <p style={eyebrowStyle}>LIVE CLASSES</p>
          <h1 style={{ margin: '6px 0 8px', fontSize: '1.9rem', color: '#0f172a' }}>Video conferencing rooms</h1>
          <p style={{ margin: 0, color: '#64748b', maxWidth: 620 }}>
            {helperText}
          </p>
        </div>
        <div style={badgeStyle}>{userName}</div>
      </section>

      {error && (
        <div style={{ ...noticeStyle, background: '#fef3f2', color: '#b42318', border: '1px solid #fecdca' }}>
          {error}
        </div>
      )}

      <section style={gridStyle}>
        {isLecturer && (
          <article style={panelStyle}>
            <div>
              <p style={eyebrowStyle}>LECTURER</p>
              <h2 style={{ margin: '6px 0 8px', fontSize: '1.2rem', color: '#0f172a' }}>Start Live Class</h2>
              <p style={{ margin: 0, color: '#64748b' }}>
                Select one of your courses and create an active room for enrolled students.
              </p>
            </div>

            <select
              value={selectedCourseId}
              onChange={(event) => setSelectedCourseId(event.target.value)}
              style={inputStyle}
              disabled={loading || courses.length === 0}
            >
              <option value="">Select Course</option>
              {courses.length === 0 ? (
                <option value="">No managed courses available</option>
              ) : (
                courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}{activeCourseIds.has(String(course.id)) ? ' - Live Now' : ''}
                  </option>
                ))
              )}
            </select>

            {courses.length > 0 && (
              <div style={{ display: 'grid', gap: 8 }}>
                {courses.map((course) => (
                  <div key={`status-${course.id}`} style={{ ...infoCardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px' }}>
                    <span style={{ color: '#0f172a', fontWeight: 600 }}>{course.title}</span>
                    {activeCourseIds.has(String(course.id)) ? (
                      <span style={liveNowBadgeStyle}>Live Now</span>
                    ) : (
                      <span style={{ color: '#64748b', fontSize: '0.82rem' }}>Offline</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            <button type="button" onClick={handleCreateRoom} style={primaryButtonStyle} disabled={submitting || loading || !selectedCourseId}>
              {submitting ? 'Starting...' : 'Start Live Class'}
            </button>

            <div style={infoCardStyle}>
              <div style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: 6 }}>Latest room ID</div>
              <div style={{ fontWeight: 700, color: '#0f172a', wordBreak: 'break-word' }}>
                {createdRoom?.roomId || 'A new room ID will appear here after you create one.'}
              </div>
            </div>
          </article>
        )}

        <article style={panelStyle}>
          <div>
            <p style={eyebrowStyle}>{isLecturer ? 'PARTICIPANTS' : 'STUDENT'}</p>
            <h2 style={{ margin: '6px 0 8px', fontSize: '1.2rem', color: '#0f172a' }}>Active Rooms</h2>
            <p style={{ margin: 0, color: '#64748b' }}>
              {isLecturer
                ? 'These are active rooms for your managed courses.'
                : 'Join any active room from your enrolled courses.'}
            </p>
          </div>

          {loading ? (
            <div style={{ color: '#64748b' }}>Loading active rooms...</div>
          ) : activeRooms.length === 0 ? (
            <div style={infoCardStyle}>
              <div style={{ color: '#334155' }}>
                No active rooms available right now.
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {activeRooms.map((room) => (
                <div key={room.roomId} style={infoCardStyle}>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>{room.course?.title || `Course #${room.courseId}`}</div>
                  <div style={{ fontSize: '0.88rem', color: '#64748b', margin: '4px 0 10px' }}>
                    Room ID: {room.roomId}
                  </div>
                  <button type="button" onClick={() => handleJoinRoom(room.roomId)} style={primaryButtonStyle}>
                    Join Room
                  </button>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>
    </div>
  );
}

const heroCardStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 16,
  padding: '24px 26px',
  borderRadius: 16,
  background: 'linear-gradient(135deg, #eff6ff 0%, #f8fafc 55%, #ecfeff 100%)',
  border: '1px solid #dbeafe',
  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)'
};

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: 18
};

const panelStyle = {
  display: 'grid',
  gap: 16,
  padding: '22px 24px',
  borderRadius: 14,
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  boxShadow: '0 1px 4px rgba(0,0,0,0.08)'
};

const infoCardStyle = {
  padding: '14px 16px',
  borderRadius: 12,
  background: '#f8fafc',
  border: '1px solid #e2e8f0'
};

const primaryButtonStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 46,
  padding: '0 18px',
  borderRadius: 10,
  border: 'none',
  background: '#2563eb',
  color: '#ffffff',
  fontWeight: 700,
  fontSize: '0.95rem',
  cursor: 'pointer'
};

const inputStyle = {
  width: '100%',
  minHeight: 46,
  padding: '0 14px',
  borderRadius: 10,
  border: '1px solid #cbd5e1',
  outline: 'none',
  fontSize: '0.95rem',
  color: '#0f172a',
  background: '#ffffff'
};

const noticeStyle = {
  borderRadius: 8,
  padding: '10px 12px',
  fontSize: '0.92rem'
};

const eyebrowStyle = {
  margin: 0,
  fontSize: '0.72rem',
  fontWeight: 700,
  letterSpacing: '0.08em',
  color: '#2563eb'
};

const badgeStyle = {
  padding: '8px 12px',
  borderRadius: 999,
  background: '#ffffff',
  border: '1px solid #dbeafe',
  color: '#1d4ed8',
  fontWeight: 600,
  whiteSpace: 'nowrap'
};

const liveNowBadgeStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '4px 10px',
  borderRadius: 999,
  background: '#dcfce7',
  border: '1px solid #86efac',
  color: '#166534',
  fontSize: '0.78rem',
  fontWeight: 700,
  letterSpacing: '0.03em'
};