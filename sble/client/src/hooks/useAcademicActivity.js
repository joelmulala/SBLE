import { useEffect, useState } from 'react';
import api from '../config/api';

function normalizeActivityItem(item) {
  return {
    id: item.id,
    kind: item.kind,
    title: item.title,
    subtitle: item.subtitle || '',
    at: item.at,
    href: item.href || null,
    urgent: Boolean(item.urgent)
  };
}

export default function useAcademicActivity({ courseId, limit = 12, isLecturer } = {}) {
  const [items, setItems] = useState([]);
  const [liveSessions, setLiveSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams({ limit: String(limit) });
        if (courseId) params.set('courseId', courseId);

        const [upcomingRes, roomsRes, coursesRes] = await Promise.all([
          api.get(`/calendar/upcoming?${params.toString()}`),
          api.get('/rooms/active').catch(() => ({ data: [] })),
          courseId ? Promise.resolve({ data: [] }) : api.get('/courses').catch(() => ({ data: [] }))
        ]);

        const feed = [];
        const now = Date.now();

        const upcoming = Array.isArray(upcomingRes.data?.upcoming) ? upcomingRes.data.upcoming : [];
        const overdue = Array.isArray(upcomingRes.data?.overdue) ? upcomingRes.data.overdue : [];

        [...overdue, ...upcoming].forEach((event) => {
          if (courseId && String(event.courseId) !== String(courseId)) return;
          const at = event.startsAt || event.endsAt;
          const endTs = new Date(event.endsAt || event.startsAt).getTime();
          feed.push(normalizeActivityItem({
            id: `cal-${event.id}`,
            kind: event.type === 'live_class' ? 'live' : 'deadline',
            title: event.title,
            subtitle: `${event.typeLabel || event.type} · ${event.courseTitle || 'Course'}`,
            at,
            href: event.href,
            urgent: endTs < now
          }));
        });

        const rooms = Array.isArray(roomsRes.data) ? roomsRes.data : [];
        const filteredRooms = courseId
          ? rooms.filter((r) => String(r.courseId || r.course_id) === String(courseId))
          : rooms;

        filteredRooms.forEach((room) => {
          const id = room.roomId || room.room_id || room.id;
          feed.push(normalizeActivityItem({
            id: `live-${id}`,
            kind: 'live',
            title: room.title || 'Live class in session',
            subtitle: room.courseTitle || 'Join now',
            at: room.startedAt || new Date().toISOString(),
            href: `/room/${id}`,
            urgent: true
          }));
        });

        if (!courseId) {
          const courses = Array.isArray(coursesRes.data) ? coursesRes.data : [];
          const hubCourses = courses.slice(0, 4);
          const hubs = await Promise.all(
            hubCourses.map((c) => api.get(`/communication/course/${c.id}/hub`).catch(() => ({ data: null })))
          );

          hubs.forEach((res, index) => {
            const hub = res?.data;
            const course = hubCourses[index];
            (hub?.announcements || []).slice(0, 2).forEach((a) => {
              feed.push(normalizeActivityItem({
                id: `ann-${course.id}-${a.id}`,
                kind: 'announcement',
                title: a.title,
                subtitle: course.title || hub?.course?.title,
                at: a.publish_at || a.created_at,
                href: `/${isLecturer ? 'lecturer' : 'student'}/courses/${course.id}/communications`
              }));
            });
          });

          if (!isLecturer) {
            try {
              const gb = await api.get('/gradebook');
              const gbCourses = Array.isArray(gb.data?.courses) ? gb.data.courses : [];
              gbCourses.forEach((entry) => {
                const summary = entry.summary || entry.rows?.find((r) => r.summary)?.summary;
                if (summary?.overallPercent == null) return;
                feed.push(normalizeActivityItem({
                  id: `grade-${entry.courseId}`,
                  kind: 'grade',
                  title: `Gradebook updated — ${entry.courseTitle}`,
                  subtitle: `Overall: ${summary.overallPercent}%`,
                  at: new Date().toISOString(),
                  href: `/student/courses/${entry.courseId}/gradebook`
                }));
              });
            } catch (_) {
              /* optional */
            }
          }
        }

        feed.sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));

        if (!cancelled) {
          setItems(feed.slice(0, limit));
          setLiveSessions(filteredRooms);
        }
      } catch (err) {
        if (!cancelled) {
          setItems([]);
          setLiveSessions([]);
          setError(err?.response?.data?.error || 'Failed to load activity');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [courseId, limit, isLecturer]);

  return { items, liveSessions, loading, error };
}
