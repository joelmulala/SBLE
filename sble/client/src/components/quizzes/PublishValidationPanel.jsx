import React, { useMemo } from 'react';
import { buildPublishReadiness } from '../../utils/quizIntegrity';
import { AssessmentMeta } from '../assessment/AssessmentPrimitives';
import s from './AssessmentQuiz.module.css';

export default function PublishValidationPanel({ questions, form, showWhenValid = false }) {
  const readiness = useMemo(
    () => buildPublishReadiness(questions, form),
    [questions, form]
  );

  if (readiness.valid && !showWhenValid) {
    return (
      <div className={s.validationOk}>
        Ready to publish — {readiness.totalMarks} total points across {questions.filter((q) => q.question_text?.trim()).length} questions.
      </div>
    );
  }

  if (readiness.valid) {
    return (
      <div className={s.validationOk}>
        Ready to publish — {readiness.totalMarks} total points.
      </div>
    );
  }

  return (
    <div role="alert">
      <AssessmentMeta strong style={{ color: 'var(--color-danger)' }}>
        Publishing blocked — fix the following:
      </AssessmentMeta>
      <ul className={s.validationList}>
        {readiness.errors.map((err) => (
          <li key={err}>{err}</li>
        ))}
      </ul>
    </div>
  );
}
