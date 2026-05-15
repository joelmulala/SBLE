import React from 'react';
import { Link } from 'react-router-dom';
import { useKeycloak } from '../auth/AuthProvider';
import useAuthSync from '../hooks/useAuthSync';
import useAcademicActivity from '../hooks/useAcademicActivity';
import AcademicActivityStream from '../components/workspace/AcademicActivityStream';
import CalendarUpcomingPanel from '../components/calendar/CalendarUpcomingPanel';
import styles from './Dashboard.module.css';

export default function Dashboard() {
  const { keycloak } = useKeycloak();
  useAuthSync();

  const name = keycloak.tokenParsed?.name || 'User';
  const isAdmin = keycloak.hasRealmRole('admin');
  const isLecturer = keycloak.hasRealmRole('lecturer') || isAdmin;
  const roleMode = isAdmin ? 'admin' : isLecturer ? 'lecturer' : 'student';
  const { items, liveSessions, loading, error } = useAcademicActivity({
    limit: 14,
    isLecturer
  });

  const roleHeader = {
    admin: 'Institutional overview — users, live classes, and platform readiness.',
    lecturer: 'Your teaching responsibilities, deadlines, and live sessions in one place.',
    student: 'Your learning path — deadlines, live classes, and course updates.'
  };

  const quickLinks = isAdmin
    ? [
      { label: 'User management', to: '/users' },
      { label: 'Live classrooms', to: '/rooms' }
    ]
    : isLecturer
      ? [
        { label: 'My courses', to: '/lecturer/courses' },
        { label: 'Academic calendar', to: '/lecturer/calendar' },
        { label: 'Gradebook', to: '/lecturer/gradebook' }
      ]
      : [
        { label: 'My courses', to: '/student/courses' },
        { label: 'Academic calendar', to: '/student/calendar' },
        { label: 'My grades', to: '/student/gradebook' }
      ];

  return (
    <div className={`${styles.page} ${styles[`page${roleMode[0].toUpperCase()}${roleMode.slice(1)}`]}`}>
      <section className={styles.intro}>
        <div className={styles.roleKicker}>{roleMode}</div>
        <h1 className="page-title">Welcome back, {name}</h1>
        <p className="page-lead">{roleHeader[roleMode]}</p>
      </section>

      {error ? <div className={styles.notice}>{error}</div> : null}

      {liveSessions.length > 0 ? (
        <section className={styles.liveStrip}>
          <div>
            <strong>{liveSessions.length} live session{liveSessions.length === 1 ? '' : 's'} now</strong>
            <p className={styles.surfaceLead}>Join your class to stay in sync with instruction.</p>
          </div>
          <Link to="/rooms" className={styles.actionLink}>View live classes</Link>
        </section>
      ) : null}

      <section className={styles.dashboardGrid}>
        <Surface title="Academic activity" lead="Recent deadlines, announcements, and session notices.">
          <AcademicActivityStream
            items={items}
            loading={loading}
            emptyMessage="No upcoming activity. Check your courses or calendar."
          />
        </Surface>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          <Surface title="Quick access" lead="Frequent workflows for your role.">
            <div className={styles.actionList}>
              {quickLinks.map((link) => (
                <Link key={link.to} to={link.to} className={styles.actionLink}>
                  {link.label}
                  <span className={styles.arrow}>→</span>
                </Link>
              ))}
            </div>
          </Surface>

          {!isAdmin ? (
            <CalendarUpcomingPanel title="Upcoming deadlines" limit={5} />
          ) : null}
        </div>
      </section>
    </div>
  );
}

function Surface({ title, lead, children }) {
  return (
    <article className={styles.surface}>
      <div className={styles.surfaceHeader}>
        <h2 className={styles.surfaceTitle}>{title}</h2>
        {lead ? <p className={styles.surfaceLead}>{lead}</p> : null}
      </div>
      <div className={styles.surfaceBody}>{children}</div>
    </article>
  );
}
