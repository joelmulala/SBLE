import React from 'react';
import CourseworkEmptyIllustration from './CourseworkEmptyIllustration';
import s from './Assignments.module.css';

export default function AssignmentsEmptyState({ title, lead, isLecturer }) {
  return (
    <div className={s.emptyState}>
      <CourseworkEmptyIllustration />
      <h3 className={s.emptyTitle}>{title}</h3>
      <p className={s.emptyLead}>
        {lead || (isLecturer
          ? 'Create an assignment with a clear brief and due date. Students will submit work here for grading.'
          : 'When your lecturer publishes assignments, they will appear here with due dates and submission status.')}
      </p>
    </div>
  );
}
