import React from 'react';
import { Button } from '../ui';
import StatusPill from '../ui/StatusPill';
import {
  getStudentQuizPrimaryStatus,
  getStudentQuizMetaStrip,
  getStudentQuizPrimaryAction,
  QuizStudentPhase,
  getStudentQuizUiState
} from '../../assessment/quizStudentWorkflow';
import qstyles from './AssessmentQuiz.module.css';

export default function StudentQuizCard({ quiz, availability, onOpenQuiz }) {
  const workflow = getStudentQuizUiState(quiz, availability);
  const primary = getStudentQuizPrimaryStatus(quiz, availability);
  const meta = getStudentQuizMetaStrip(quiz, availability);
  const action = getStudentQuizPrimaryAction(quiz, availability);
  const isQuiet = workflow.phase === QuizStudentPhase.CLOSED
    || workflow.phase === QuizStudentPhase.SCHEDULED
    || workflow.phase === QuizStudentPhase.UNAVAILABLE
    || workflow.phase === QuizStudentPhase.DRAFT_UNPUBLISHED;

  const handleOpen = () => {
    if (!action.disabled) onOpenQuiz(quiz.id);
  };

  return (
    <article className={`${qstyles.studentQuizCard} ${isQuiet ? qstyles.studentQuizCardQuiet : ''}`}>
      <div className={qstyles.studentQuizTop}>
        <h3 className={qstyles.studentQuizTitle}>{quiz.title}</h3>
        <StatusPill variant={primary.variant}>{primary.label}</StatusPill>
      </div>

      {meta.length > 0 ? (
        <p className={qstyles.studentQuizMeta}>
          {meta.map((part, i) => (
            <span key={`${part.text}-${i}`}>
              {i > 0 ? <span className={qstyles.metaSep}> · </span> : null}
              <span className={part.emphasis ? qstyles.metaEmphasis : undefined}>{part.text}</span>
            </span>
          ))}
        </p>
      ) : null}

      <div className={qstyles.studentQuizActions}>
        <Button
          type="button"
          variant={action.variant}
          disabled={action.disabled}
          onClick={handleOpen}
        >
          {action.label}
        </Button>
        {workflow.phase === QuizStudentPhase.CHECKING ? (
          <span className={qstyles.studentQuizHint}>Confirming availability…</span>
        ) : null}
      </div>
    </article>
  );
}
