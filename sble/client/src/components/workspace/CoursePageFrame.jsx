import React from 'react';
import CourseWorkspaceShell from './CourseWorkspaceShell';

export default function CoursePageFrame({ courseId, children }) {
  if (!courseId) return children;
  return (
    <CourseWorkspaceShell>
      {children}
    </CourseWorkspaceShell>
  );
}
