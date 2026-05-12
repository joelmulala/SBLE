import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useKeycloak } from '../auth/AuthProvider';
import api from '../config/api';
import CourseViewPage from '../components/student/CourseViewPage';
import styles from './CourseDetail.module.css';

export default function CourseDetail() {
  const params = useParams();
  const courseId = params.courseId || params.id;
  const { keycloak } = useKeycloak();
  const isLecturer = keycloak.hasRealmRole('lecturer') || keycloak.hasRealmRole('admin');
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [liveRoomError, setLiveRoomError] = useState('');
  const [startingLiveRoom, setStartingLiveRoom] = useState(false);

  useEffect(() => {
    if (!isLecturer || !courseId) return;
    api.get(`/courses/${courseId}`).then((r) => setCourse(r.data)).catch(() => setCourse(null));
  }, [courseId, isLecturer]);

  if (!isLecturer) {
    return <CourseViewPage courseId={courseId} />;
  }

  const sections = [
    { label: 'Enrollment', path: 'enrollment', color: '#0f766e' },
    { label: 'Materials', path: 'materials', color: '#4f8ef7' },
    { label: 'Assignments', path: 'assignments', color: '#28a745' },
    { label: 'Quizzes', path: 'quizzes', color: '#e67e22' },
    { label: 'Exams', path: 'exams', color: '#dc3545' },
    { label: 'Performance', path: 'performance', color: '#7c3aed' }
  ];

  const handleStartLiveRoom = async () => {
    if (!courseId) return;
    setStartingLiveRoom(true);
    setLiveRoomError('');

    try {
      const res = await api.post('/rooms/create', { courseId: Number(courseId) });
      const roomId = res?.data?.roomId || res?.data?.room_id;
      if (!roomId) throw new Error('Room creation succeeded but room id is missing.');
      navigate(`/room/${encodeURIComponent(roomId)}`);
    } catch (err) {
      // If one active room already exists, route lecturer to the latest room for this course.
      if (err?.response?.status === 409) {
        try {
          const active = await api.get(`/rooms/course/${encodeURIComponent(courseId)}`);
          const items = Array.isArray(active?.data) ? active.data : [];
          const existing = items.find((room) => String(room.createdBy) === String(keycloak.tokenParsed?.sub)) || items[0];
          const existingRoomId = existing?.roomId || existing?.room_id;
          if (existingRoomId) {
            navigate(`/room/${encodeURIComponent(existingRoomId)}`);
            return;
          }
        } catch (_) {
          // fall through to normal error display
        }
      }

      setLiveRoomError(err?.response?.data?.error || err?.message || 'Failed to start live room.');
    } finally {
      setStartingLiveRoom(false);
    }
  };

  return (
    <div className="app-page">
      <div className="app-container app-stack">
        <section className="app-surface">
          <div className="app-surface-body">
            <p className="app-kicker">Lecturer Course Hub</p>
            <h1 className="page-title" style={{ marginTop: '0.35rem' }}>{course?.title || `Course #${courseId}`}</h1>
            {course?.description && <p className="page-lead">{course.description}</p>}
            {course?.lecturer && <p className="app-meta" style={{ marginTop: '0.5rem' }}>Lecturer: {course.lecturer.full_name}</p>}
          </div>
        </section>

        <section className="app-grid-2">
          <article className="app-surface">
            <div className="app-surface-header">
              <h2 style={{ fontSize: '1.05rem', fontWeight: 600 }}>Academic Workflows</h2>
            </div>
            <div className={`app-surface-body ${styles.sectionGrid}`}>
        {sections.map((section) => (
          <Link
            key={section.path}
            to={`/lecturer/courses/${courseId}/${section.path}`}
            className={styles.sectionLink}
            style={{ borderLeft: `3px solid ${section.color}` }}
          >
            <span className={styles.sectionTitle}>{section.label}</span>
            <span className={styles.sectionMeta}>Open Workspace</span>
          </Link>
        ))}
            </div>
          </article>
          <aside className="app-surface">
            <div className="app-surface-header">
              <h2 style={{ fontSize: '1.05rem', fontWeight: 600 }}>Live Classroom</h2>
            </div>
            <div className="app-surface-body app-stack">
              <p className="app-meta">Launch a session with Jitsi for enrolled students.</p>
              <button type="button" onClick={handleStartLiveRoom} disabled={startingLiveRoom} className="app-button app-button--primary">
                {startingLiveRoom ? 'Opening...' : 'Open Live Room'}
              </button>
              {liveRoomError ? <p style={{ color: '#c0392b' }}>{liveRoomError}</p> : null}
            </div>
          </aside>
        </section>
      </div>
    </div>
  );
}
