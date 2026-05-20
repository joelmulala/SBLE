import { useEffect, useMemo, useState } from 'react';
import api from '../config/api';

/**
 * Lightweight institutional overview from existing APIs (no new backend).
 */
export default function useAdminOverview() {
  const [users, setUsers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [liveRooms, setLiveRooms] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [usersRes, coursesRes, roomsRes, calRes] = await Promise.all([
          api.get('/users'),
          api.get('/courses'),
          api.get('/rooms/active').catch(() => ({ data: [] })),
          api.get('/calendar/upcoming?limit=12').catch(() => ({ data: { upcoming: [], overdue: [] } }))
        ]);
        if (cancelled) return;
        setUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
        setCourses(Array.isArray(coursesRes.data) ? coursesRes.data : []);
        setLiveRooms(Array.isArray(roomsRes.data) ? roomsRes.data : []);
        const up = calRes.data?.upcoming || [];
        const od = calRes.data?.overdue || [];
        setUpcoming([...od, ...up].slice(0, 10));
      } catch (err) {
        if (!cancelled) {
          setError(err?.response?.data?.error || 'Could not load institutional overview');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  const summary = useMemo(() => {
    const lecturers = users.filter((u) => u.role === 'lecturer').length;
    const students = users.filter((u) => u.role === 'student').length;
    const admins = users.filter((u) => u.role === 'admin').length;
    const inactive = users.filter((u) => u.is_active === false).length;
    const deadlines = upcoming.filter((e) => e.type !== 'live_class').length;
    const liveClasses = upcoming.filter((e) => e.type === 'live_class').length;
    return {
      totalUsers: users.length,
      lecturers,
      students,
      admins,
      inactive,
      totalCourses: courses.length,
      liveNow: liveRooms.length,
      upcomingDeadlines: deadlines,
      scheduledLive: liveClasses
    };
  }, [users, courses, liveRooms, upcoming]);

  return {
    users,
    courses,
    liveRooms,
    upcoming,
    summary,
    loading,
    error
  };
}
