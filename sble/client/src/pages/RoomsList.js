import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useKeycloak } from '../auth/AuthProvider';
import api from '../config/api';
import {
  WorkspacePageShell,
  PageActions,
  Panel,
  Button,
  FilterSelect,
  EmptyState,
  LoadingState,
  StatusPill
} from '../components/ui';
import ui from '../components/ui/system.module.css';

function cleanLecturerName(name) {
  if (name == null) return '';
  const s = String(name).trim();
  if (!s) return '';
  return s.replace(/\s*[-–—]\s*$/u, '').trim() || '';
}

export default function RoomsList() {
  const navigate = useNavigate();
  const location = useLocation();
  const { keycloak } = useKeycloak();
  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [activeRooms, setActiveRooms] = useState([]);
  const [createdRoom, setCreatedRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [liveClassNotice, setLiveClassNotice] = useState('');
  const [selectedCourseEnrollments, setSelectedCourseEnrollments] = useState([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);

  const isLecturer = keycloak.hasRealmRole('lecturer') || keycloak.hasRealmRole('admin');

  const helperText = useMemo(() => (
    isLecturer
      ? 'Select a course and start a live class linked to that course.'
      : 'Join active live classes from courses where you are enrolled.'
  ), [isLecturer]);

  useEffect(() => {
    if (location.state?.liveClassEnded) {
      setLiveClassNotice(location.state.liveClassMessage || 'Class ended');
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate]);

  const activeCourseIds = useMemo(() => {
    const ids = new Set();
    activeRooms.forEach((room) => {
      if (room?.courseId !== undefined && room?.courseId !== null) {
        ids.add(String(room.courseId));
      }
    });
    return ids;
  }, [activeRooms]);

  const selectedCourse = useMemo(
    () => courses.find((course) => String(course.id) === String(selectedCourseId)) || null,
    [courses, selectedCourseId]
  );

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

  useEffect(() => {
    if (!isLecturer || !selectedCourseId) {
      setSelectedCourseEnrollments([]);
      return;
    }

    let cancelled = false;
    setLoadingParticipants(true);
    api.get(`/courses/${encodeURIComponent(selectedCourseId)}/enrollments`)
      .then((res) => {
        if (cancelled) return;
        const rows = Array.isArray(res.data) ? res.data : [];
        setSelectedCourseEnrollments(rows);
      })
      .catch(() => {
        if (!cancelled) setSelectedCourseEnrollments([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingParticipants(false);
      });

    return () => { cancelled = true; };
  }, [isLecturer, selectedCourseId]);

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
    <WorkspacePageShell lead={helperText}>
      {liveClassNotice ? (
        <div className={`${ui.notice} ${ui.noticeSuccess}`}>{liveClassNotice}</div>
      ) : null}
      {error ? <div className={`${ui.notice} ${ui.noticeError}`}>{error}</div> : null}

      {isLecturer ? (
        <>
          <PageActions
            filters={(
              <FilterSelect
                className={ui.filterSelectWide}
                value={selectedCourseId}
                onChange={(event) => setSelectedCourseId(event.target.value)}
                disabled={loading || courses.length === 0}
                aria-label="Select course for live class"
              >
                <option value="">Select course</option>
                {courses.length === 0 ? (
                  <option value="">No managed courses</option>
                ) : (
                  courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title}{activeCourseIds.has(String(course.id)) ? ' · Live' : ''}
                    </option>
                  ))
                )}
              </FilterSelect>
            )}
            actions={(
              <Button
                type="button"
                variant="primary"
                onClick={handleCreateRoom}
                disabled={submitting || loading || !selectedCourseId}
              >
                {submitting ? 'Starting…' : 'Start live class'}
              </Button>
            )}
          />

          <div className={ui.stackTight}>
            <Panel title="Selected course">
              <div className={ui.courseCard}>
                <div className={ui.courseCardHeader}>
                  <span className={ui.cellMuted}>Course</span>
                  {activeRooms.length > 0 ? (
                    <StatusPill variant="info">Live session active</StatusPill>
                  ) : null}
                </div>
                <p className={ui.courseCardTitle}>{selectedCourse?.title || 'No course selected'}</p>
                <p className={ui.courseCardMeta}>
                  {selectedCourse
                    ? 'One live room per course. Starting opens the room for enrolled students.'
                    : 'Choose a course above to begin.'}
                </p>
              </div>
              {createdRoom?.roomId ? (
                <p className={`${ui.cellMuted} ${ui.spacedTop}`}>
                  Latest room ID: <strong className={ui.cellPrimary}>{createdRoom.roomId}</strong>
                </p>
              ) : null}
            </Panel>

            <Panel title="Course participants">
              {!selectedCourseId ? (
                <EmptyState message="Select a course to view participants." />
              ) : loadingParticipants ? (
                <LoadingState label="Loading participants…" />
              ) : selectedCourseEnrollments.length === 0 ? (
                <EmptyState message="No students enrolled in this course yet." />
              ) : (
                <ul className={ui.oversightList}>
                  {selectedCourseEnrollments.map((row) => (
                    <li key={row.id || row.student?.id || row.student_id} className={ui.oversightItem}>
                      <div>
                        <strong>{row.student?.full_name || row.student_id || 'Student'}</strong>
                        <p className={ui.oversightMeta}>
                          {row.student?.student_id ? `ID: ${row.student.student_id}` : ''}
                          {row.student?.email ? ` · ${row.student.email}` : ''}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </>
      ) : (
        <Panel title="Active rooms">
          {loading ? (
            <LoadingState label="Loading active rooms…" />
          ) : activeRooms.length === 0 ? (
            <EmptyState message="There is no active room right now." />
          ) : (
            <ul className={ui.oversightList}>
              {activeRooms.map((room) => (
                <li key={room.roomId} className={ui.oversightItem}>
                  <div>
                    <strong>{room.course?.title || `Course #${room.courseId}`}</strong>
                    <p className={ui.oversightMeta}>
                      {(() => {
                        const ln = cleanLecturerName(room.course?.lecturerName);
                        const parts = [];
                        if (ln) parts.push(`Lecturer: ${ln}`);
                        parts.push(`Room ID: ${room.roomId}`);
                        return parts.join(' · ');
                      })()}
                    </p>
                  </div>
                  <Button type="button" variant="primary" onClick={() => handleJoinRoom(room.roomId)}>
                    Join room
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}
    </WorkspacePageShell>
  );
}
