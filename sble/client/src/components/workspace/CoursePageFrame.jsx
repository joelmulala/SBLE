import React from 'react';
import CourseWorkspaceShell from './CourseWorkspaceShell';

export default function CoursePageFrame({ courseId, pageTitle, children }) {
  if (!courseId) return children;
  return (
    <CourseWorkspaceShell pageTitle={pageTitle}>
      {children}
    </CourseWorkspaceShell>
  );
}
