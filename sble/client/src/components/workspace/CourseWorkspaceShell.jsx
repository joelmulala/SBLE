import React, { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import api from '../../config/api';
import { getCourseNavItems, coursePath, detectActiveSegment } from './courseWorkspaceConfig';
import CourseContextBar from './CourseContextBar';
import s from './Workspace.module.css';

export default function CourseWorkspaceShell({ children }) {
  const { courseId } = useParams();
  const location = useLocation();
  const [course, setCourse] = useState(null);
  const [loadingCourse, setLoadingCourse] = useState(Boolean(courseId));
  const activeSegment = detectActiveSegment(location.pathname, courseId);

  const isLecturer = location.pathname.startsWith('/lecturer');
  const rolePrefix = isLecturer ? 'lecturer' : 'student';
  const navItems = getCourseNavItems(isLecturer);

  useEffect(() => {
    if (!courseId) {
      setCourse(null);
      setLoadingCourse(false);
      return;
    }

    let cancelled = false;
    setLoadingCourse(true);
    api.get(`/courses/${courseId}`)
      .then((res) => {
        if (!cancelled) setCourse(res.data);
      })
      .catch(() => {
        if (!cancelled) setCourse(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingCourse(false);
      });

    return () => { cancelled = true; };
  }, [courseId]);

  if (!courseId) {
    return <div className={s.workspaceShell}>{children}</div>;
  }

  return (
    <div className={s.workspaceShell}>
      <CourseContextBar course={course} loading={loadingCourse} />

      <nav className={s.courseNav} aria-label="Course sections">
        {navItems.map((item) => {
          const to = coursePath(rolePrefix, courseId, item.segment);
          const isActive = item.segment === activeSegment
            || (item.segment === '' && activeSegment === 'home');
          return (
            <Link
              key={item.id}
              to={to}
              className={`${s.courseNavLink} ${isActive ? s.courseNavLinkActive : ''}`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
