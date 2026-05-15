import React from 'react';
import { Link } from 'react-router-dom';
import { StatusBadge } from '../assessment/AssessmentPrimitives';
import {
  TYPE_LABELS,
  TYPE_CSS,
  badgeVariant,
  getEventStatus,
  formatEventTime,
  formatEventDate
} from './calendarUtils';
import s from './AcademicCalendar.module.css';

export function groupEventsByDay(events) {
  const map = new Map();
  events.forEach((event) => {
    const day = formatEventDate(event.startsAt || event.endsAt);
    if (!map.has(day)) map.set(day, []);
    map.get(day).push(event);
  });
  return [...map.entries()];
}

export default function CalendarEventList({ events, compact = false }) {
  const grouped = groupEventsByDay(events);

  if (!events.length) return null;

  return (
    <div className={compact ? s.compactList : undefined}>
      {grouped.map(([day, dayEvents]) => (
        <section key={day} className={s.dayGroup}>
          <h3 className={s.dayHeading}>{day}</h3>
          <ul className={s.eventList}>
            {dayEvents.map((event) => (
              <CalendarEventRow key={event.id} event={event} compact={compact} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function CalendarEventRow({ event, compact = false }) {
  const status = getEventStatus(event);
  const typeClass = s[TYPE_CSS[event.type]] || '';
  const statusClass = status === 'overdue'
    ? s.statusOverdue
    : status === 'live'
      ? s.statusLive
      : status === 'upcoming'
        ? s.statusUpcoming
        : '';

  const content = (
    <>
      <div className={s.eventTime}>{formatEventTime(event)}</div>
      <div className={s.eventBody}>
        <StatusBadge variant={badgeVariant(event.type)}>
          {event.typeLabel || TYPE_LABELS[event.type] || event.type}
        </StatusBadge>
        {status === 'overdue' ? <StatusBadge variant="danger">Overdue</StatusBadge> : null}
        {status === 'live' ? <StatusBadge variant="info">Live now</StatusBadge> : null}
        <h3>{event.title}</h3>
        <p className={s.eventMeta}>{event.courseTitle}</p>
        {event.lecturerName ? <p className={s.eventMeta}>Lecturer: {event.lecturerName}</p> : null}
      </div>
    </>
  );

  const className = [
    s.eventItem,
    typeClass,
    statusClass,
    event.href ? s.eventItemLink : ''
  ].filter(Boolean).join(' ');

  if (event.href) {
    const external = event.href.startsWith('http');
    if (external) {
      return (
        <li>
          <a href={event.href} className={className} target="_blank" rel="noopener noreferrer">
            {content}
          </a>
        </li>
      );
    }
    return (
      <li>
        <Link to={event.href} className={className}>{content}</Link>
      </li>
    );
  }

  return <li className={className}>{content}</li>;
}
