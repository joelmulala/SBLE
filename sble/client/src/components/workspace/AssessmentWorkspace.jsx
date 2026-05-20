import React from 'react';
import CoursePageFrame from './CoursePageFrame';
import { WorkspacePageShell } from '../ui';

/**
 * Unified assessment page wrapper — replaces AssessmentShell + fragmented course chrome.
 * Course-scoped routes use CoursePageFrame (CourseContextBar + nav).
 * Global assessment views use WorkspacePageShell.
 */
export default function AssessmentWorkspace({ courseId = null, children }) {
  if (courseId) {
    return <CoursePageFrame courseId={courseId}>{children}</CoursePageFrame>;
  }
  return <WorkspacePageShell>{children}</WorkspacePageShell>;
}
