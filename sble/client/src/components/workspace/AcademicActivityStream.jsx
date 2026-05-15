import React from 'react';
import { Link } from 'react-router-dom';
import { AssessmentEmpty, AssessmentMeta } from '../assessment/AssessmentPrimitives';
import s from './Workspace.module.css';

const ICON_CLASS = {
  deadline: s.iconDeadline,
  live: s.iconLive,
  announcement: s.iconAnnouncement,
  grade: s.iconGrade,
  discussion: s.iconDiscussion
};

const ICON_LABEL = {
  deadline: 'Due',
  live: 'Live',
  announcement: 'News',
  grade: 'Grade',
  discussion: 'Talk'
};

function formatRelativeTime(value) {
  if (!value) return '';
  const ts = new Date(value).getTime();
  const diff = Date.now() - ts;
  const abs = Math.abs(diff);
  if (abs < 60000) return 'Just now';
  if (abs < 3600000) return `${Math.round(abs / 60000)}m`;
  if (abs < 86400000) return `${Math.round(abs / 3600000)}h`;
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function AcademicActivityStream({ items, loading, emptyMessage = 'No recent academic activity.' }) {
  if (loading) return <AssessmentMeta>Loading activity...</AssessmentMeta>;
  if (!items.length) return <AssessmentEmpty>{emptyMessage}</AssessmentEmpty>;

  return (
    <ul className={s.activityStream}>
      {items.map((item) => {
        const inner = (
          <>
            <div className={`${s.activityIcon} ${ICON_CLASS[item.kind] || s.iconDiscussion}`}>
              {ICON_LABEL[item.kind] || '•'}
            </div>
            <div className={s.activityBody}>
              <strong>{item.title}</strong>
              {item.subtitle ? <span>{item.subtitle}</span> : null}
            </div>
            <span className={s.activityTime}>{formatRelativeTime(item.at)}</span>
          </>
        );

        if (item.href) {
          return (
            <li key={item.id}>
              <Link
                to={item.href}
                className={`${s.activityItem} ${s.activityItemLink}`}
                style={item.urgent ? { borderLeft: '3px solid #dc3545' } : undefined}
              >
                {inner}
              </Link>
            </li>
          );
        }

        return (
          <li key={item.id} className={s.activityItem}>
            {inner}
          </li>
        );
      })}
    </ul>
  );
}
