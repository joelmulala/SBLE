import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useKeycloak } from '../auth/AuthProvider';
import useAuthSync from '../hooks/useAuthSync';
import useAcademicActivity from '../hooks/useAcademicActivity';
import useUpcomingTasks from '../hooks/useUpcomingTasks';
import AcademicActivityStream from '../components/workspace/AcademicActivityStream';
import AcademicCalendarPanel from '../components/productivity/AcademicCalendarPanel';
import UpcomingTasksWidget from '../components/productivity/UpcomingTasksWidget';
import QuickActions from '../components/productivity/QuickActions';
import WorkspaceAwareness from '../components/productivity/WorkspaceAwareness';
import DashboardHeroIllustration from '../components/layout/DashboardHeroIllustration';
import { calendarBasePath } from '../components/calendar/calendarUtils';
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

  const {
    tasks,
    firstCourseId,
    loading: tasksLoading,
    error: tasksError
  } = useUpcomingTasks({ isLecturer, limit: 8 });

  const calendarPath = calendarBasePath(isLecturer);

  const roleHeader = {
    admin: 'Institutional overview — users, live classes, and platform readiness.',
    lecturer: 'Your teaching responsibilities, deadlines, and live sessions in one place.',
    student: 'Your learning path — deadlines, live classes, and course updates.'
  };

  const summary = useMemo(() => {
    const deadlines = items.filter((i) => i.kind === 'deadline').length;
    const courseIds = new Set(
      items
        .map((i) => {
          const match = i.href?.match(/\/courses\/([^/]+)/);
          return match?.[1];
        })
        .filter(Boolean)
    );
    return {
      courses: courseIds.size || '—',
      deadlines: deadlines || tasks.length,
      live: liveSessions.length
    };
  }, [items, liveSessions, tasks.length]);

  return (
    <div className={`${styles.page} ${styles[`page${roleMode[0].toUpperCase()}${roleMode.slice(1)}`]}`}>
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <span className={styles.roleKicker}>{roleMode}</span>
          <h2 className={styles.heroTitle}>Welcome back, {name}</h2>
          <p className={styles.heroLead}>{roleHeader[roleMode]}</p>
          <div className={styles.heroStats}>
            <div className={styles.heroStat}>
              <span className={styles.heroStatLabel}>Active courses</span>
              <span className={styles.heroStatValue}>{summary.courses}</span>
            </div>
            <div className={styles.heroStat}>
              <span className={styles.heroStatLabel}>Upcoming items</span>
              <span className={styles.heroStatValue}>{summary.deadlines}</span>
            </div>
            <div className={styles.heroStat}>
              <span className={styles.heroStatLabel}>Live now</span>
              <span className={styles.heroStatValue}>{summary.live}</span>
            </div>
          </div>
        </div>
        <div className={styles.heroVisual} aria-hidden>
          <DashboardHeroIllustration />
        </div>
      </section>

      {error || tasksError ? (
        <div className={styles.notice}>{error || tasksError}</div>
      ) : null}

      {liveSessions.length > 0 ? (
        <section className={styles.liveStrip}>
          <div>
            <strong>{liveSessions.length} live session{liveSessions.length === 1 ? '' : 's'} now</strong>
            <p className={styles.surfaceLead}>Join your class to stay in sync with instruction.</p>
          </div>
          <Link to="/rooms" className={styles.actionLink}>View live classes</Link>
        </section>
      ) : null}

      <section className={styles.productivityGrid} aria-label="Academic productivity">
        {!isAdmin ? (
          <>
            <UpcomingTasksWidget
              tasks={tasks}
              loading={tasksLoading}
              isLecturer={isLecturer}
              footerLink={calendarPath}
            />
            <AcademicCalendarPanel title="Academic schedule" limit={6} />
          </>
        ) : null}
        <QuickActions
          isAdmin={isAdmin}
          isLecturer={isLecturer}
          firstCourseId={firstCourseId}
          hasLiveSession={liveSessions.length > 0}
        />
      </section>

      <section className={styles.dashboardGrid}>
        <Surface title="Academic activity" lead="Recent deadlines, announcements, and session notices.">
          <AcademicActivityStream
            items={items}
            loading={loading}
            emptyMessage="No upcoming activity. Check your courses or calendar."
          />
        </Surface>

        <Surface title="Needs your attention" lead="What changed recently and what to do next.">
          <WorkspaceAwareness items={items} loading={loading} />
          {!loading && !items.length ? (
            <p className={styles.surfaceLead} style={{ marginTop: 'var(--space-3)' }}>
              You are up to date. Check the calendar for upcoming academic events.
            </p>
          ) : null}
        </Surface>
      </section>
    </div>
  );
}

function Surface({ title, lead, children }) {
  return (
    <article className={`${styles.surface} wk-card`}>
      <div className={styles.surfaceHeader}>
        <h3 className={styles.surfaceTitle}>{title}</h3>
        {lead ? <p className={styles.surfaceLead}>{lead}</p> : null}
      </div>
      <div className={styles.surfaceBody}>{children}</div>
    </article>
  );
}
