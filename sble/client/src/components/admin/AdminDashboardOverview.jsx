import React from 'react';
import { Link } from 'react-router-dom';
import useAdminOverview from '../../hooks/useAdminOverview';
import {
  WorkspacePageShell,
  KpiStatGrid,
  StatCard,
  Panel,
  LoadingState
} from '../ui';
import ui from '../ui/system.module.css';

export default function AdminDashboardOverview() {
  const { liveRooms, upcoming, summary, loading, error } = useAdminOverview();

  const alerts = upcoming
    .filter((e) => e.type === 'assignment' || e.type === 'quiz' || e.type === 'exam')
    .slice(0, 5);

  const announcements = upcoming
    .filter((e) => e.type === 'announcement' || e.kind === 'announcement')
    .slice(0, 4);

  return (
    <WorkspacePageShell lead="Overview of users, courses, live instruction, and upcoming academic deadlines.">
      {error ? <div className={`${ui.notice} ${ui.noticeError}`}>{error}</div> : null}

      <KpiStatGrid>
        <StatCard
          label="Users"
          value={loading ? '—' : summary.totalUsers}
          hint={loading ? '' : `${summary.lecturers} lecturers · ${summary.students} students`}
        />
        <StatCard
          label="Courses"
          value={loading ? '—' : summary.totalCourses}
          hint="Active catalog"
        />
        <StatCard
          label="Live now"
          value={loading ? '—' : summary.liveNow}
          hint="Open classrooms"
        />
        <StatCard
          label="Upcoming deadlines"
          value={loading ? '—' : summary.upcomingDeadlines}
          hint="Assignments, quizzes, and exams"
        />
      </KpiStatGrid>

      <Panel title="Institutional oversight" lead="Live sessions and academic alerts.">
        {loading ? (
          <LoadingState label="Loading oversight data…" />
        ) : (
          <>
            <h3 className={ui.subsectionTitle}>Active live sessions</h3>
            {liveRooms.length === 0 ? (
              <p className={ui.cellMuted}>No live classrooms at the moment.</p>
            ) : (
              <ul className={ui.oversightList}>
                {liveRooms.map((room) => {
                  const id = room.roomId || room.room_id || room.id;
                  return (
                    <li key={id} className={ui.oversightItem}>
                      <div>
                        <strong>{room.title || room.courseTitle || 'Live class'}</strong>
                        <p className={ui.oversightMeta}>{room.courseTitle || 'In session'}</p>
                      </div>
                      <Link to={`/room/${encodeURIComponent(id)}`} className={ui.oversightLink}>
                        Open
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}

            <h3 className={ui.subsectionTitle}>Academic alerts</h3>
            {alerts.length === 0 ? (
              <p className={ui.cellMuted}>No pending assessments in the upcoming window.</p>
            ) : (
              <ul className={ui.oversightList}>
                {alerts.map((event) => (
                  <li key={event.id} className={ui.oversightItem}>
                    <div>
                      <strong>{event.title}</strong>
                      <p className={ui.oversightMeta}>
                        {event.typeLabel || event.type}
                        {event.courseTitle ? ` · ${event.courseTitle}` : ''}
                      </p>
                    </div>
                    {event.href ? (
                      <Link to={event.href} className={ui.oversightLink}>View</Link>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}

            {announcements.length > 0 ? (
              <>
                <h3 className={ui.subsectionTitle}>Recent announcements</h3>
                <ul className={ui.oversightList}>
                  {announcements.map((event) => (
                    <li key={event.id} className={ui.oversightItem}>
                      <div>
                        <strong>{event.title}</strong>
                        <p className={ui.oversightMeta}>{event.courseTitle || 'Institution'}</p>
                      </div>
                      {event.href ? (
                        <Link to={event.href} className={ui.oversightLink}>Open</Link>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </>
        )}
      </Panel>
    </WorkspacePageShell>
  );
}
