import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../config/api';
import { useAssessmentRoles } from '../../assessment';
import { AssessmentEmpty, AssessmentMeta } from '../assessment/AssessmentPrimitives';
import { TYPE_LABELS, calendarBasePath, formatEventDate } from '../calendar/calendarUtils';
import s from './Productivity.module.css';

function MiniEvent({ event, overdue }) {
  const label = event.typeLabel || TYPE_LABELS[event.type] || event.type;
  const dateLabel = formatEventDate(event.startsAt || event.endsAt);
  const content = (
    <>
      <span className={s.calMiniDate}>{dateLabel}</span>
      <span>
        <strong style={{ display: 'block', fontWeight: 600, fontSize: 'var(--fs-0)' }}>{event.title}</strong>
        <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--fs-00)' }}>
          {label} · {event.courseTitle}
        </span>
      </span>
    </>
  );

  const className = `${s.calMiniItem} ${overdue ? s.calMiniOverdue : ''} ${event.href ? s.calMiniItemLink : ''}`;
  if (event.href) {
    return (
      <li>
        <Link to={event.href} className={className}>
          {content}
        </Link>
      </li>
    );
  }
  return <li className={className}>{content}</li>;
}

export default function AcademicCalendarPanel({
  courseId = '',
  title = 'Academic schedule',
  limit = 6
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
    <div className={`${s.panel} wk-card`}>
      <div className={s.panelHeader}>
        <h2 className={s.panelTitle}>{title}</h2>
        <p className={s.panelLead}>Deadlines, exams, quizzes, and live sessions.</p>
      </div>
      <div className={s.panelBody}>
        {loading ? <AssessmentMeta>Loading schedule...</AssessmentMeta> : null}

        {!loading && overdue.length > 0 ? (
          <section className={s.calSection} aria-label="Overdue">
            <h3 className={s.calSectionLabel}>Overdue</h3>
            <ul className={s.calMiniList}>
              {overdue.map((event) => (
                <MiniEvent key={event.id} event={event} overdue />
              ))}
            </ul>
          </section>
        ) : null}

        {!loading && upcoming.length === 0 && overdue.length === 0 ? (
          <AssessmentEmpty>No upcoming academic events.</AssessmentEmpty>
        ) : null}

        {!loading && upcoming.length > 0 ? (
          <section className={s.calSection} aria-label="Upcoming">
            {overdue.length > 0 ? <h3 className={s.calSectionLabel}>Upcoming</h3> : null}
            <ul className={s.calMiniList}>
              {upcoming.map((event) => (
                <MiniEvent key={event.id} event={event} overdue={false} />
              ))}
            </ul>
          </section>
        ) : null}
      </div>
      <p className={s.panelFooter}>
        <Link to={calendarLink}>View full calendar</Link>
      </p>
    </div>
  );
}
