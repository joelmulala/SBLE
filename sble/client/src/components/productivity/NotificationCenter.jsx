import React, { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  groupNotificationsByCategory,
  getNotificationCategory,
  getNotificationTitle,
  getNotificationMessage,
  resolveNotificationPath
} from '../../utils/notificationUtils';
import s from './Productivity.module.css';

const ICON_CLASS = {
  live: s.notifIconLive,
  academic: s.notifIconAcademic,
  communication: s.notifIconComm,
  other: s.notifIconOther
};

const ICON_GLYPH = {
  live: '●',
  academic: '✓',
  communication: '◆',
  other: '•'
};

export default function NotificationCenter({
  notifications,
  dismiss,
  dismissAll,
  onClose,
  isLecturer
}) {
  const navigate = useNavigate();
  const panelRef = useRef(null);
  const groups = useMemo(() => groupNotificationsByCategory(notifications), [notifications]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return undefined;
    const focusable = panel.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    focusable?.focus();
    return undefined;
  }, []);

  const handleOpen = (notification) => {
    const path = resolveNotificationPath(notification, { isLecturer });
    if (path) navigate(path);
    dismiss(notification.id);
    onClose?.();
  };

  return (
    <div
      ref={panelRef}
      id="workspace-notifications-panel"
      className={s.notifCenter}
      role="dialog"
      aria-modal="true"
      aria-label="Academic notifications"
    >
      <div className={s.notifCenterHeader}>
        <div>
          <h2 className={s.notifCenterTitle}>Notifications</h2>
          {notifications.length > 0 ? (
            <p className={s.notifCenterMeta}>{notifications.length} unread</p>
          ) : null}
        </div>
        {notifications.length > 0 ? (
          <button type="button" className={s.notifClearBtn} onClick={dismissAll}>
            Clear all
          </button>
        ) : null}
      </div>

      <div className={s.notifScroll}>
        {notifications.length === 0 ? (
          <p className={s.notifEmpty}>No new academic notifications.</p>
        ) : (
          groups.map((group) => (
            <section key={group.id} className={s.notifCategory} aria-label={group.label}>
              <h3 className={s.notifCategoryLabel}>{group.label}</h3>
              {group.items.map((n) => {
                const cat = getNotificationCategory(n.type);
                return (
                  <article key={n.id} className={`${s.notifItem} ${s.notifItemUnread}`}>
                    <span className={`${s.notifIcon} ${ICON_CLASS[cat]}`} aria-hidden>
                      {ICON_GLYPH[cat]}
                    </span>
                    <button type="button" className={s.notifBody} onClick={() => handleOpen(n)}>
                      <span className={s.notifItemTitle}>{getNotificationTitle(n)}</span>
                      <span className={s.notifItemMessage}>{getNotificationMessage(n)}</span>
                    </button>
                    <button
                      type="button"
                      className={s.notifDismiss}
                      onClick={() => dismiss(n.id)}
                      aria-label="Dismiss notification"
                    >
                      ×
                    </button>
                  </article>
                );
              })}
            </section>
          ))
        )}
      </div>
    </div>
  );
}
