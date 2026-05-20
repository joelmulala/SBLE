import React from 'react';
import { Link } from 'react-router-dom';
import CalendarUpcomingPanel from '../calendar/CalendarUpcomingPanel';
import { getCourseNavItems, coursePath } from './courseWorkspaceConfig';
import s from '../courseModules/CourseModules.module.css';

/**
 * Secondary course aside — calendar and optional links.
 * Primary section navigation lives in CourseWorkspaceShell tabs when embeddedInShell.
 */
export default function CourseContextSidebar({
  courseId,
  isLecturer,
  showNavLinks = true,
  showManageContent = true
}) {
  const rolePrefix = isLecturer ? 'lecturer' : 'student';
  const navItems = getCourseNavItems(isLecturer).filter((item) => item.segment);

  return (
    <aside className={s.sidebar}>
      {showNavLinks ? (
        <div className={s.sidebarCard}>
          <h2 className={s.sidebarTitle}>Course navigation</h2>
          {navItems.map((item) => (
            <Link
              key={item.id}
              to={coursePath(rolePrefix, courseId, item.segment)}
              className={s.sidebarLink}
            >
              {item.label}
            </Link>
          ))}
          <Link to={isLecturer ? '/lecturer/calendar' : '/student/calendar'} className={s.sidebarLink}>
            Academic calendar
          </Link>
        </div>
      ) : null}

      {showManageContent && isLecturer ? (
        <div className={s.sidebarCard}>
          <h2 className={s.sidebarTitle}>Manage content</h2>
          <Link to={coursePath(rolePrefix, courseId, 'materials')} className={s.sidebarLink}>Materials</Link>
          <Link to={coursePath(rolePrefix, courseId, 'assignments')} className={s.sidebarLink}>Assignments</Link>
          <Link to={coursePath(rolePrefix, courseId, 'quizzes')} className={s.sidebarLink}>Quizzes</Link>
          <Link to={coursePath(rolePrefix, courseId, 'exams')} className={s.sidebarLink}>Exams</Link>
        </div>
      ) : null}

      <CalendarUpcomingPanel courseId={courseId} title="Upcoming in this course" limit={4} />

      {!showNavLinks ? (
        <div className={s.sidebarCard}>
          <Link to={isLecturer ? '/lecturer/calendar' : '/student/calendar'} className={s.sidebarLink}>
            View full academic calendar
          </Link>
        </div>
      ) : null}
    </aside>
  );
}
