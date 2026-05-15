import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../config/api';
import { useAssessmentRoles } from '../../assessment';
import { AssessmentMeta, AssessmentEmpty } from '../assessment/AssessmentPrimitives';
import { CalendarEventRow } from './CalendarEventList';
import { calendarBasePath } from './calendarUtils';
import s from './AcademicCalendar.module.css';

export default function CalendarUpcomingPanel({
  courseId = '',
  title = 'Upcoming deadlines',
  limit = 5,
  compact = true
}) {
  const { isLecturer } = useAssessmentRoles();
  const [upcoming, setUpcoming] = useState([]);
  const [overdue, setOverdue] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ limit: String(limit) });
        if (courseId) params.set('courseId', courseId);
        const res = await api.get(`/calendar/upcoming?${params.toString()}`);
        if (!cancelled) {
          setUpcoming(Array.isArray(res.data?.upcoming) ? res.data.upcoming : []);
          setOverdue(Array.isArray(res.data?.overdue) ? res.data.overdue : []);
        }
      } catch (_) {
        if (!cancelled) {
          setUpcoming([]);
          setOverdue([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [courseId, limit]);

  const calendarLink = `${calendarBasePath(isLecturer)}${courseId ? `?courseId=${courseId}` : ''}`;

  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)', background: 'var(--color-surface)' }}>
      <h2 style={{ margin: '0 0 var(--space-3)', fontSize: 'var(--fs-2)', fontWeight: 600 }}>{title}</h2>

      {loading ? <AssessmentMeta>Loading schedule...</AssessmentMeta> : null}

      {!loading && overdue.length > 0 ? (
        <>
          <AssessmentMeta strong>Overdue</AssessmentMeta>
          <ul className={s.eventList} style={{ marginBottom: 'var(--space-4)' }}>
            {overdue.map((event) => (
              <CalendarEventRow key={event.id} event={event} compact={compact} />
            ))}
          </ul>
        </>
      ) : null}

      {!loading && upcoming.length === 0 && overdue.length === 0 ? (
        <AssessmentEmpty>No upcoming academic events.</AssessmentEmpty>
      ) : null}

      {!loading && upcoming.length > 0 ? (
        <ul className={`${s.eventList} ${compact ? s.compactList : ''}`}>
          {upcoming.map((event) => (
            <CalendarEventRow key={event.id} event={event} compact={compact} />
          ))}
        </ul>
      ) : null}

      <p className={s.panelFooter}>
        <Link to={calendarLink}>View full calendar</Link>
      </p>
    </div>
  );
}
