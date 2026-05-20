import React, { useMemo } from 'react';
import { buildPublishReadiness } from '../../utils/quizIntegrity';
import s from './AssessmentQuiz.module.css';

export default function PublishValidationPanel({ questions, form, showWhenValid = false, compact = false }) {
  const readiness = useMemo(
    () => buildPublishReadiness(questions, form),
    [questions, form]
  );

  const questionCount = questions.filter((q) => q.question_text?.trim()).length;

  if (readiness.valid) {
    if (!showWhenValid) return null;
    return (
      <div className={s.validationOk} role="status">
        <strong>Ready to publish.</strong>
        {' '}
        {readiness.totalMarks} points across {questionCount} question{questionCount === 1 ? '' : 's'}.
        {form ? ` Duration: ${form.duration_hours || 0}h ${form.duration_minutes ?? 0}m.` : null}
      </div>
    );
  }

  return (
    <div className={compact ? s.validationBlockedCompact : s.validationBlocked} role="alert">
      <p className={s.validationHeading}>Publishing is blocked until the following are resolved:</p>
      <ul className={s.validationList}>
        {readiness.errors.map((err) => (
          <li key={err}>{err}</li>
        ))}
      </ul>
    </div>
  );
}
