import React from 'react';
import { Link } from 'react-router-dom';
import { getQuickActions } from '../../utils/quickActions';
import s from './Productivity.module.css';

export default function QuickActions({
  isAdmin,
  isLecturer,
  firstCourseId,
  hasLiveSession
}) {
  const actions = getQuickActions({ isAdmin, isLecturer, firstCourseId, hasLiveSession });

  return (
    <div className={`${s.panel} wk-card`}>
      <div className={s.panelHeader}>
        <h2 className={s.panelTitle}>Quick actions</h2>
        <p className={s.panelLead}>Common academic workflows for your role.</p>
      </div>
      <div className={s.panelBody}>
        <div className={s.actionGrid}>
          {actions.map((action) => (
            <Link
              key={action.id}
              to={action.to}
              className={[
                s.actionCard,
                action.primary ? s.actionCardPrimary : '',
                action.highlight ? s.actionCardHighlight : ''
              ].filter(Boolean).join(' ')}
            >
              <span className={s.actionLabel}>{action.label}</span>
              <span className={s.actionDesc}>{action.description}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
