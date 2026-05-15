import React, { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import api from '../../config/api';
import { useAssessmentRoles } from '../../assessment';
import { AssessmentMeta } from '../assessment/AssessmentPrimitives';
import { getCourseNavItems, coursePath, detectActiveSegment } from './courseWorkspaceConfig';
import s from './Workspace.module.css';

export default function CourseWorkspaceShell({ children, pageTitle }) {
  const { courseId } = useParams();
  const location = useLocation();
  const { isLecturer } = useAssessmentRoles();
  const rolePrefix = isLecturer ? 'lecturer' : 'student';
  const [course, setCourse] = useState(null);
  const activeSegment = detectActiveSegment(location.pathname, courseId);
  const navItems = getCourseNavItems(isLecturer);

  useEffect(() => {
    if (!courseId) return;
    api.get(`/courses/${courseId}`)
      .then((res) => setCourse(res.data))
      .catch(() => setCourse(null));
  }, [courseId]);

  if (!courseId) {
    return <div className={s.workspaceShell}>{children}</div>;
  }

  return (
    <div className={s.workspaceShell}>
      <nav className={s.breadcrumb} aria-label="Breadcrumb">
        <Link to={`/${rolePrefix}/dashboard`}>Dashboard</Link>
        <span className={s.breadcrumbSep}>/</span>
        <Link to={`/${rolePrefix}/courses`}>Courses</Link>
        <span className={s.breadcrumbSep}>/</span>
        <Link to={coursePath(rolePrefix, courseId, '')}>{course?.title || `Course ${courseId}`}</Link>
        {pageTitle && activeSegment !== 'home' ? (
          <>
            <span className={s.breadcrumbSep}>/</span>
            <span>{pageTitle}</span>
          </>
        ) : null}
      </nav>

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
        <Link
          to={isLecturer ? '/lecturer/calendar' : '/student/calendar'}
          className={s.courseNavLink}
          style={{ marginLeft: 'auto' }}
        >
          Calendar
        </Link>
      </nav>

      {course?.lecturer && pageTitle ? (
        <AssessmentMeta>
          {course.title} · {pageTitle} · Lecturer: {course.lecturer.full_name}
        </AssessmentMeta>
      ) : null}

      {children}
    </div>
  );
}
