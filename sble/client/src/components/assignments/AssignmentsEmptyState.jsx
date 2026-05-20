import React from 'react';
import s from './Assignments.module.css';

/** Lightweight academic empty state — no illustration */
export default function AssignmentsEmptyState({ title, lead, isLecturer }) {
  return (
    <div className={s.emptyStateLite}>
      <h3 className={s.emptyTitle}>{title}</h3>
      <p className={s.emptyLead}>
        {lead || (isLecturer
          ? 'Create an assignment with a clear brief and due date. Student submissions will appear here for review and grading.'
          : 'When your lecturer publishes assignments, they will appear here with due dates and submission status.')}
      </p>
    </div>
  );
}
