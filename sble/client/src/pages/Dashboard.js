import React, { useMemo, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useKeycloak } from '../auth/AuthProvider';
import useAuthSync from '../hooks/useAuthSync';
import api from '../config/api';
import styles from './Dashboard.module.css';

export default function Dashboard() {
  const { keycloak } = useKeycloak();
  useAuthSync();

  const name = keycloak.tokenParsed?.name || 'User';
  const isAdmin = keycloak.hasRealmRole('admin');
  const isLecturer = keycloak.hasRealmRole('lecturer') || isAdmin;
  const roleMode = isAdmin ? 'admin' : isLecturer ? 'lecturer' : 'student';
  const [stats, setStats] = useState({
    courses: 0,
    students: 0,
    assignments: 0,
    quizzes: 0,
    materials: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeRooms, setActiveRooms] = useState([]);

  useEffect(() => {
    let cancelled = false;

    const loadSummary = async () => {
      setLoading(true);
      setError('');

      try {
        const [coursesRes, assignmentsRes, quizzesRes, materialsRes, roomsRes] = await Promise.all([
          api.get('/courses'),
          api.get('/assignments').catch(() => ({ data: [] })),
          api.get('/quizzes').catch(() => ({ data: [] })),
          api.get('/materials').catch(() => ({ data: [] })),
          api.get('/rooms/active').catch(() => ({ data: [] }))
        ]);

        const courses = Array.isArray(coursesRes.data) ? coursesRes.data : [];
        const assignments = Array.isArray(assignmentsRes.data) ? assignmentsRes.data : [];
        const quizzes = Array.isArray(quizzesRes.data) ? quizzesRes.data : [];
        const materials = Array.isArray(materialsRes.data) ? materialsRes.data : [];
        const rooms = Array.isArray(roomsRes.data) ? roomsRes.data : [];

        const enrollmentResults = isLecturer
          ? await Promise.all(courses.map((course) => api.get(`/courses/${course.id}/enrollments`).catch(() => ({ data: [] }))))
          : [];

        const students = enrollmentResults.reduce((total, response) => {
          const rows = Array.isArray(response.data) ? response.data : [];
          return total + rows.length;
        }, 0);

        if (!cancelled) {
          setStats({
            courses: courses.length,
            students,
            assignments: assignments.length,
            quizzes: quizzes.length,
            materials: materials.length
          });
          setActiveRooms(rooms);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.response?.data?.error || 'Failed to load dashboard summary.');
          setStats({ courses: 0, students: 0, assignments: 0, quizzes: 0, materials: 0 });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadSummary();
    return () => { cancelled = true; };
  }, [isLecturer]);

  const keySignals = [
    { label: 'Courses', value: stats.courses },
    { label: isLecturer ? 'Learners' : 'Live Rooms', value: isLecturer ? stats.students : activeRooms.length },
    { label: 'Assessments', value: stats.assignments + stats.quizzes }
  ];

  const quickActions = [
    { label: 'Create Course', to: '/lecturer/courses' },
    { label: 'Upload Material', to: '/lecturer/materials' },
    { label: 'Create Assignment', to: '/lecturer/assignments' },
    { label: 'Create Quiz', to: '/lecturer/quizzes' }
  ];

  const roleHeader = {
    admin: 'Institutional operations and system performance overview for SBLE.',
    lecturer: 'Here is your teaching overview for SBLE.',
    student: 'Here is your learning overview for SBLE.'
  };

  const activityFeed = useMemo(() => {
    const items = [
      `${stats.assignments} assignments currently published`,
      `${stats.quizzes} quizzes configured`,
      `${stats.materials} materials in circulation`,
      `${activeRooms.length} live classroom session${activeRooms.length === 1 ? '' : 's'} active`
    ];
    if (isAdmin) {
      items.unshift(`${stats.students} active enrollment records across managed courses`);
    }
    return items;
  }, [stats, activeRooms.length, isAdmin]);

  return (
    <div className={`${styles.page} ${styles[`page${roleMode[0].toUpperCase()}${roleMode.slice(1)}`]}`}>
      <section className={styles.intro}>
        <div className={styles.roleKicker}>{roleMode}</div>
        <h1 className="page-title">Welcome back, {name}</h1>
        <p className="page-lead">
          {roleHeader[roleMode]}
        </p>
      </section>

      {error && <div className={styles.notice}>{error}</div>}
      {loading && <p className={styles.loading}>Loading dashboard...</p>}

      {!loading && (
        <>
          <section className={styles.signalRow}>
            {keySignals.map((signal) => (
              <StatCard key={signal.label} label={signal.label} value={signal.value} />
            ))}
          </section>

          <section className={styles.workspaceLayout}>
            {isAdmin ? (
              <Surface
                title="Institutional Snapshot"
                lead="Monitor operational reliability, user governance, and platform readiness."
                element="article"
              >
                <ul className={styles.feedList}>
                  {activityFeed.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </Surface>
            ) : (
              <Surface
                title="Academic Activity"
                lead="Keep course delivery, assessments, and resources synchronized."
                element="article"
              >
                <ul className={styles.feedList}>
                  {activityFeed.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </Surface>
            )}

            {isAdmin ? (
              <Surface
                title="System Management"
                lead="High-impact controls for institutional administration."
                element="aside"
              >
                <div className={styles.actionList}>
                  <Link to="/users" className={styles.actionLink}>
                    Manage users and roles
                    <span className={styles.arrow}>→</span>
                  </Link>
                  <Link to="/rooms" className={styles.actionLink}>
                    Monitor active live classrooms
                    <span className={styles.arrow}>→</span>
                  </Link>
                </div>
              </Surface>
            ) : isLecturer ? (
              <Surface
                title="Quick Actions"
                lead="Jump to high-frequency lecturer workflows."
                element="aside"
              >
                <div className={styles.actionList}>
                  {quickActions.map((action) => (
                    <Link key={action.label} to={action.to} className={styles.actionLink}>
                      {action.label}
                      <span className={styles.arrow}>→</span>
                    </Link>
                  ))}
                </div>
              </Surface>
            ) : (
              <Surface
                title="Learning Continuity"
                lead="Keep momentum through materials, assignments, and quizzes."
                element="aside"
              >
                <ul className={styles.feedList}>
                  <li>Review newly uploaded material before starting graded tasks.</li>
                  <li>Submit assignments before quizzes to preserve sequence quality.</li>
                  <li>Join active live classrooms to maintain instructional continuity.</li>
                </ul>
              </Surface>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <article className={styles.signalItem}>
      <p className={styles.signalLabel}>{label}</p>
      <p className={styles.signalValue}>{value}</p>
    </article>
  );
}

function Surface({ title, lead, children, element = 'section' }) {
  const Element = element;
  return (
    <Element className={styles.surface}>
      <div className={styles.surfaceHeader}>
        <h2 className={styles.surfaceTitle}>{title}</h2>
        {lead ? <p className={styles.surfaceLead}>{lead}</p> : null}
      </div>
      <div className={styles.surfaceBody}>
        {children}
      </div>
    </Element>
  );
}
