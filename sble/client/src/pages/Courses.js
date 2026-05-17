import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useKeycloak } from '../auth/AuthProvider';
import api from '../config/api';
import styles from './Courses.module.css';

export default function Courses() {
  const { keycloak } = useKeycloak();
  const isLecturer = keycloak.hasRealmRole('lecturer') || keycloak.hasRealmRole('admin');
  const courseBasePath = isLecturer ? '/lecturer/courses' : '/student/courses';
  const [courses, setCourses] = useState([]);
  const [activeRoomCourseIds, setActiveRoomCourseIds] = useState(new Set());
  const [assignmentCountByCourse, setAssignmentCountByCourse] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadCourses = async () => {
      setLoading(true);
      setError('');
      try {
        const [coursesRes, roomsRes, assignmentsRes] = await Promise.all([
          api.get('/courses'),
          api.get('/rooms/active').catch(() => ({ data: [] })),
          api.get('/assignments').catch(() => ({ data: [] }))
        ]);
        const nextCourses = Array.isArray(coursesRes.data) ? coursesRes.data : [];
        const activeRooms = Array.isArray(roomsRes.data) ? roomsRes.data : [];
        const assignments = Array.isArray(assignmentsRes.data) ? assignmentsRes.data : [];

        const nextAssignmentCount = assignments.reduce((acc, assignment) => {
          const key = String(assignment.course_id || assignment.courseId || '');
          if (!key) return acc;
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {});

        setCourses(nextCourses);
        setActiveRoomCourseIds(new Set(activeRooms.map((room) => String(room.courseId || room.course_id || ''))));
        setAssignmentCountByCourse(nextAssignmentCount);
      } catch (err) {
        setError(err?.response?.data?.error || 'Failed to load courses.');
      } finally {
        setLoading(false);
      }
    };

    loadCourses();
  }, []);

  if (loading) return <p className="app-meta">Loading courses...</p>;

  return (
    <div className="app-page">
      <div className="app-container app-stack">
        <section className={`app-surface ${styles.hero}`}>
          <div className="app-surface-body">
            <p className="app-kicker">{isLecturer ? 'Teaching workspace' : 'Learning workspace'}</p>
            <p className="page-lead" style={{ marginTop: '0.35rem' }}>Only courses you can access are shown here.</p>
          </div>
        </section>
      {error && <p style={{ color: '#c0392b' }}>{error}</p>}

      <section className={styles.courseGrid}>
        {courses.map((course) => (
          <article key={course.id} className={`app-surface ${styles.courseCard}`}>
            <div className={styles.badge}>{isLecturer ? 'Course Management' : 'Course Progress'}</div>
            <h3 className={styles.title}>{course.title}</h3>
            <p className={styles.description}>{course.description || 'No description available.'}</p>
            <p className={styles.meta}>
              Lecturer: {course.lecturer?.full_name || 'Not assigned'}
            </p>
            <div className={styles.indicatorRow}>
              <span className={`${styles.indicator} ${activeRoomCourseIds.has(String(course.id)) ? styles.indicatorLive : ''}`}>
                {activeRoomCourseIds.has(String(course.id)) ? 'Live session active' : 'No live session'}
              </span>
              <span className={styles.indicator}>
                {assignmentCountByCourse[String(course.id)] || 0} assignment{(assignmentCountByCourse[String(course.id)] || 0) === 1 ? '' : 's'}
              </span>
            </div>
            <div className={styles.footer}>
              <span className="app-meta">{isLecturer ? 'Workflow ready' : 'Continue learning'}</span>
              <Link to={`${courseBasePath}/${course.id}`} className="app-button app-button--primary">Open Course</Link>
            </div>
          </article>
        ))}
        {courses.length === 0 && <p className="app-meta">No courses found.</p>}
      </section>
      </div>
    </div>
  );
}
