import { useEffect, useState } from 'react';
import api from '../config/api';
import { getEventStatus } from '../components/calendar/calendarUtils';

function mapEventToTask(event, { isLecturer }) {
  const status = getEventStatus(event);
  const overdue = status === 'overdue';
  const prefix = isLecturer ? '/lecturer' : '/student';
  const courseId = event.courseId || event.course_id;

  let category = 'deadline';
  if (event.type === 'assignment_due') category = isLecturer ? 'grading' : 'assignment';
  else if (event.type === 'quiz_open' || event.type === 'quiz_close') category = 'quiz';
  else if (event.type === 'exam') category = 'exam';
  else if (event.type === 'live_class') category = 'live';

  let title = event.title;
  if (isLecturer && event.type === 'assignment_due') {
    title = `Submissions due — ${event.title}`;
  }

  return {
    id: `task-${event.id}`,
    category,
    title,
    subtitle: event.courseTitle || 'Course',
    at: event.startsAt || event.endsAt,
    href: event.href || (courseId ? `${prefix}/courses/${courseId}` : null),
    overdue,
    urgent: overdue || status === 'live'
  };
}

function mapLiveRoomToTask(room, { isLecturer }) {
  const id = room.roomId || room.room_id || room.id;
  return {
    id: `live-room-${id}`,
    category: 'live',
    title: room.title || 'Live class in session',
    subtitle: room.courseTitle || (isLecturer ? 'Join or manage session' : 'Join now'),
    at: room.startedAt || new Date().toISOString(),
    href: `/room/${id}`,
    overdue: false,
    urgent: true
  };
}

export default function useUpcomingTasks({ isLecturer, limit = 8 } = {}) {
  const [tasks, setTasks] = useState([]);
  const [firstCourseId, setFirstCourseId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams({ limit: String(Math.max(limit, 12)) });
        const [calendarRes, roomsRes, coursesRes] = await Promise.all([
          api.get(`/calendar/upcoming?${params.toString()}`),
          api.get('/rooms/active').catch(() => ({ data: [] })),
          api.get('/courses').catch(() => ({ data: [] }))
        ]);

        const courses = Array.isArray(coursesRes.data) ? coursesRes.data : [];
        const upcoming = Array.isArray(calendarRes.data?.upcoming) ? calendarRes.data.upcoming : [];
        const overdue = Array.isArray(calendarRes.data?.overdue) ? calendarRes.data.overdue : [];
        const rooms = Array.isArray(roomsRes.data) ? roomsRes.data : [];

        const merged = [
          ...overdue.map((e) => mapEventToTask(e, { isLecturer })),
          ...rooms.map((r) => mapLiveRoomToTask(r, { isLecturer })),
          ...upcoming.map((e) => mapEventToTask(e, { isLecturer }))
        ];

        const seen = new Set();
        const unique = merged.filter((t) => {
          if (seen.has(t.id)) return false;
          seen.add(t.id);
          return true;
        });

        unique.sort((a, b) => {
          if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
          return new Date(a.at || 0) - new Date(b.at || 0);
        });

        if (!cancelled) {
          setTasks(unique.slice(0, limit));
          setFirstCourseId(courses[0]?.id ? String(courses[0].id) : null);
        }
      } catch (err) {
        if (!cancelled) {
          setTasks([]);
          setError(err?.response?.data?.error || 'Failed to load tasks');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [isLecturer, limit]);

  return { tasks, firstCourseId, loading, error };
}
