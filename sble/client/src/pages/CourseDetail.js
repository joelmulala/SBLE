import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useKeycloak } from '../auth/AuthProvider';
import api from '../config/api';
import CourseViewPage from '../components/student/CourseViewPage';
import CourseLearningHome from '../components/courseModules/CourseLearningHome';

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
          /* fall through */
        }
      }

      setLiveRoomError(err?.response?.data?.error || err?.message || 'Failed to start live room.');
    } finally {
      setStartingLiveRoom(false);
    }
  };

  return (
    <div className="app-page">
      <div className="app-container">
        <CourseLearningHome
          courseId={courseId}
          course={course}
          isLecturer
          onStartLiveRoom={handleStartLiveRoom}
          startingLiveRoom={startingLiveRoom}
          liveRoomError={liveRoomError}
        />
      </div>
    </div>
  );
}
