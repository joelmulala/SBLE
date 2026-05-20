import React from 'react';
import StatusPill from '../ui/StatusPill';
import ui from '../ui/system.module.css';

/**
 * Single course identity row — Layout owns page title; this owns course context only.
 */
export default function CourseContextBar({ course, loading = false, pills = null }) {
  if (loading && !course) {
    return (
      <div className={ui.courseContextBar} aria-busy="true" aria-label="Loading course">
        <div className={ui.courseContextSkeleton} />
      </div>
    );
  }

  if (!course) return null;

  const isActive = course.is_active !== false;
  const lecturerName = course.lecturer?.full_name;

  return (
    <div className={ui.courseContextBar}>
      <div className={ui.courseContextMain}>
        <p className={ui.courseContextTitle}>{course.title}</p>
        <div className={ui.courseContextMeta}>
          <span className={ui.courseContextCode}>CRS-{course.id}</span>
          {lecturerName ? (
            <>
              <span className={ui.courseContextSep} aria-hidden>·</span>
              <span>{lecturerName}</span>
            </>
          ) : null}
        </div>
      </div>
      <div className={ui.courseContextAside}>
        {pills}
        <StatusPill variant={isActive ? 'active' : 'inactive'}>
          {isActive ? 'Active' : 'Inactive'}
        </StatusPill>
      </div>
    </div>
  );
}
