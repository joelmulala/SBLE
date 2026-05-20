import React, { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../config/api';
import { formatSeconds } from '../../assessment';
import useQuizAttemptTimer from '../../hooks/useQuizAttemptTimer';
import { Button, ConfirmDialog } from '../ui';
import StatusPill from '../ui/StatusPill';
import ui from '../ui/system.module.css';
import qs from './AssessmentQuiz.module.css';

function AnswerOption({ name, value, label, checked, onChange }) {
  return (
    <label className={[qs.optionRow, checked ? qs.optionRowSelected : ''].filter(Boolean).join(' ')}>
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className={qs.optionInput}
      />
      <span className={qs.optionText}>{label}</span>
    </label>
  );
}

function saveStatusLabel(saveState) {
  if (saveState === 'saving') return 'Saving your answers…';
  if (saveState === 'saved') return 'All changes saved';
  if (saveState === 'error') return 'Save issue — answers kept on this device';
  return 'Autosave active';
}

export default function QuizTakingWorkspace({
  activeQuiz,
  answers,
  setAnswers,
  result,
  setResult,
  submitting,
  setSubmitting,
  setError,
  error = '',
  updateQuizAttempt,
  onExit
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [saveState, setSaveState] = useState('idle');
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const autoSaveTimerRef = useRef(null);
  const autoSubmittingRef = useRef(false);

  const questions = activeQuiz?.QuizQuestions || [];
  const hasQuestions = questions.length > 0;

  const handleAutoSubmit = useCallback(async () => {
    if (autoSubmittingRef.current || result || !activeQuiz?.id) return;
    autoSubmittingRef.current = true;
    setSubmitting(true);
    setError('');
    try {
      const res = await api.post(`/quizzes/${activeQuiz.id}/attempt`, { answers });
      const score = Number(res.data?.score ?? 0);
      const totalMarks = Number(res.data?.totalMarks ?? questions.reduce((sum, q) => sum + (Number(q.marks) || 1), 0));
      updateQuizAttempt(activeQuiz.id, {
        id: res.data?.attempt?.id || activeQuiz.attempt_id,
        score,
        submitted_at: res.data?.attempt?.submitted_at || new Date().toISOString()
      });
      setResult({
        ...res.data,
        score,
        totalMarks,
        correctAnswers: res.data?.correctAnswers || [],
        feedback: res.data?.feedback || [],
        auto_submitted: Boolean(res.data?.auto_submitted)
      });
    } catch (err) {
      const payload = err?.response?.data;
      if (payload?.score != null || payload?.attempt_id) {
        setResult({
          ...payload,
          score: Number(payload.score ?? 0),
          totalMarks: Number(payload.totalMarks ?? 0),
          auto_submitted: true
        });
      } else {
        setError(payload?.error || 'Time expired — submission could not be completed.');
      }
    } finally {
      setSubmitting(false);
    }
  }, [activeQuiz, answers, questions, result, setError, setResult, setSubmitting, updateQuizAttempt]);

  const { secondsLeft, syncFromServer } = useQuizAttemptTimer({
    expiresAt: activeQuiz?.attempt_expires_at,
    secondsRemaining: activeQuiz?.seconds_remaining,
    enabled: Boolean(activeQuiz?.attempt_id && !result),
    onExpire: handleAutoSubmit
  });

  useEffect(() => {
    if (activeQuiz?.attempt_answers && typeof activeQuiz.attempt_answers === 'object') {
      setAnswers((prev) => ({ ...activeQuiz.attempt_answers, ...prev }));
    }
  }, [activeQuiz?.id, activeQuiz?.attempt_answers, setAnswers]);

  useEffect(() => {
    if (!activeQuiz?.attempt_id || result) return undefined;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(async () => {
      setSaveState('saving');
      try {
        const res = await api.put(`/quizzes/${activeQuiz.id}/attempt`, { answers });
        syncFromServer(res.data);
        setSaveState('saved');
      } catch (err) {
        const payload = err?.response?.data;
        if (payload?.auto_submitted) {
          setResult({
            ...payload,
            score: Number(payload.score ?? 0),
            totalMarks: Number(payload.totalMarks ?? 0),
            auto_submitted: true
          });
        } else {
          setSaveState('error');
        }
      }
    }, 1200);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [answers, activeQuiz?.attempt_id, activeQuiz?.id, result, syncFromServer, setResult]);

  const submitQuiz = async () => {
    if (!hasQuestions) {
      setError('This quiz is not available yet');
      return;
    }
    const totalMarks = questions.reduce((sum, q) => sum + (Number(q.marks) || 1), 0);
    setSubmitting(true);
    setError('');
    try {
      const res = await api.post(`/quizzes/${activeQuiz.id}/attempt`, { answers });
      const score = Number(res.data?.score ?? 0);
      updateQuizAttempt(activeQuiz.id, {
        id: res.data?.attempt?.id || activeQuiz.attempt_id,
        score,
        submitted_at: res.data?.attempt?.submitted_at || new Date().toISOString()
      });
      setResult({
        ...res.data,
        score,
        totalMarks: Number(res.data?.totalMarks ?? totalMarks),
        correctAnswers: Array.isArray(res.data?.correctAnswers) ? res.data.correctAnswers : [],
        feedback: Array.isArray(res.data?.feedback) ? res.data.feedback : []
      });
      setShowSubmitConfirm(false);
    } catch (err) {
      const payload = err?.response?.data;
      if (payload?.attempt_id || payload?.score != null) {
        setResult({
          ...payload,
          score: Number(payload.score ?? 0),
          totalMarks: Number(payload.totalMarks ?? totalMarks),
          auto_submitted: Boolean(payload?.auto_submitted)
        });
        setShowSubmitConfirm(false);
      } else {
        setError(payload?.error || 'Failed to submit quiz.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const answeredCount = questions.filter((q) => {
    const a = answers[q.id];
    return a !== undefined && a !== null && String(a).trim() !== '';
  }).length;
  const remainingCount = Math.max(0, questions.length - answeredCount);
  const currentQ = questions[currentIndex];

  const timerTone = secondsLeft == null
    ? 'neutral'
    : secondsLeft < 60
      ? 'critical'
      : secondsLeft < 300
        ? 'warn'
        : 'ok';

  const timerBarClass = [
    qs.timerBar,
    timerTone === 'warn' ? qs.timerBarWarn : '',
    timerTone === 'critical' ? qs.timerBarCritical : '',
    timerTone === 'ok' ? qs.timerBarOk : ''
  ].filter(Boolean).join(' ');

  const timerValueClass = [
    qs.timerValue,
    timerTone === 'warn' ? qs.timerWarn : '',
    timerTone === 'critical' ? qs.timerUrgent : '',
    timerTone === 'ok' ? qs.timerOk : ''
  ].filter(Boolean).join(' ');

  const percentScore = result?.totalMarks
    ? Math.round((Number(result.score || 0) / Number(result.totalMarks)) * 100)
    : 0;
  const passState = percentScore >= 50;

  if (result) {
    return (
      <div className={qs.attemptWorkspace}>
        <header className={qs.attemptHeader}>
          <p className={qs.attemptKicker}>Quiz complete</p>
          <h1 className={qs.attemptTitle}>{activeQuiz.title}</h1>
          <p className={qs.attemptLead}>Your attempt has been recorded and saved.</p>
        </header>

        <section className={qs.resultHero} aria-label="Quiz score">
          <div className={qs.resultScoreBlock}>
            <p className={qs.resultScoreLabel}>Your score</p>
            <p className={qs.resultScoreValue}>
              {result.score}
              <span className={qs.resultScoreDenom}> / {result.totalMarks ?? 0}</span>
            </p>
            <p className={qs.resultPercent}>{percentScore}%</p>
          </div>
          <StatusPill variant={passState ? 'active' : 'inactive'}>
            {passState ? 'Pass' : 'Below 50%'}
          </StatusPill>
        </section>

        {result.auto_submitted ? (
          <div className={ui.notice}>
            Time expired — your answers were submitted automatically.
          </div>
        ) : (
          <div className={`${ui.notice} ${ui.noticeSuccess}`}>
            Submission successful. You may review your results below.
          </div>
        )}

        {result.message ? (
          <p className={qs.resultMessage}>{result.message}</p>
        ) : null}

        {Array.isArray(result.feedback) && result.feedback.length > 0 ? (
          <section className={qs.feedbackReview} aria-label="Question feedback">
            <h2 className={qs.feedbackReviewTitle}>Answer review</h2>
            <ul className={qs.feedbackList}>
              {result.feedback.map((item, index) => (
                <li
                  key={item.question_id || index}
                  className={item.status === 'correct' ? qs.feedbackItemOk : qs.feedbackItemMiss}
                >
                  {item.message}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className={qs.attemptFooter}>
          <Button type="button" variant="primary" onClick={onExit}>
            Back to quizzes
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={qs.attemptWorkspace}>
      <header className={qs.attemptHeader}>
        <p className={qs.attemptKicker}>Quiz in progress</p>
        <h1 className={qs.attemptTitle}>{activeQuiz.title}</h1>
      </header>

      {error ? <div className={`${ui.notice} ${ui.noticeError}`}>{error}</div> : null}

      {hasQuestions ? (
        <p className={qs.progressSummary} aria-live="polite">
          Question {currentIndex + 1} of {questions.length}
          <span className={qs.progressSep}> · </span>
          {answeredCount} answered
          <span className={qs.progressSep}> · </span>
          {remainingCount} remaining
        </p>
      ) : null}

      {secondsLeft != null ? (
        <div className={timerBarClass} role="status" aria-live="polite">
          <div className={qs.timerMain}>
            <span className={qs.timerLabel}>Time remaining</span>
            <span className={timerValueClass}>{formatSeconds(secondsLeft)}</span>
          </div>
          <div className={qs.timerAside}>
            <span className={[qs.saveStatus, saveState === 'saved' ? qs.saveStatusOk : '', saveState === 'error' ? qs.saveStatusError : ''].filter(Boolean).join(' ')}>
              {saveStatusLabel(saveState)}
            </span>
          </div>
        </div>
      ) : null}

      {!hasQuestions ? (
        <div className={ui.notice}>This quiz is not available yet.</div>
      ) : null}

      {hasQuestions ? (
        <>
          <nav className={qs.progressNav} aria-label="Question navigation">
            {questions.map((q, i) => {
              const answered = answers[q.id] !== undefined && String(answers[q.id] ?? '').trim() !== '';
              return (
                <button
                  key={q.id}
                  type="button"
                  className={[
                    qs.progressDot,
                    answered ? qs.progressDotAnswered : '',
                    i === currentIndex ? qs.progressDotActive : ''
                  ].filter(Boolean).join(' ')}
                  onClick={() => setCurrentIndex(i)}
                  aria-label={`Question ${i + 1}${answered ? ', answered' : ', unanswered'}`}
                  aria-current={i === currentIndex ? 'step' : undefined}
                >
                  {i + 1}
                </button>
              );
            })}
          </nav>

          {currentQ ? (
            <article className={qs.questionPanel}>
              <div className={qs.questionHead}>
                <span className={qs.questionNumber}>Q{currentIndex + 1}</span>
                <span className={qs.questionMarks}>
                  {currentQ.marks} mark{Number(currentQ.marks) === 1 ? '' : 's'}
                </span>
              </div>
              <p className={qs.questionPrompt}>{currentQ.question_text}</p>

              <div className={qs.optionsGroup}>
                {currentQ.question_type === 'mcq' && currentQ.options?.map((opt, oi) => (
                  <AnswerOption
                    key={oi}
                    name={`q_${currentQ.id}`}
                    value={opt}
                    label={opt}
                    checked={answers[currentQ.id] === opt}
                    onChange={() => setAnswers((prev) => ({ ...prev, [currentQ.id]: opt }))}
                  />
                ))}

                {currentQ.question_type === 'true_false' && ['True', 'False'].map((opt) => (
                  <AnswerOption
                    key={opt}
                    name={`q_${currentQ.id}`}
                    value={opt}
                    label={opt}
                    checked={answers[currentQ.id] === opt}
                    onChange={() => setAnswers((prev) => ({ ...prev, [currentQ.id]: opt }))}
                  />
                ))}

                {currentQ.question_type === 'short_answer' ? (
                  <input
                    type="text"
                    className={`${ui.input} ${qs.shortAnswerInput}`}
                    value={answers[currentQ.id] || ''}
                    onChange={(e) => setAnswers((prev) => ({ ...prev, [currentQ.id]: e.target.value }))}
                    placeholder="Type your answer"
                    aria-label={`Answer for question ${currentIndex + 1}`}
                  />
                ) : null}
              </div>

              <div className={qs.questionNav}>
                <Button type="button" variant="ghost" disabled={currentIndex === 0} onClick={() => setCurrentIndex((i) => i - 1)}>
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={currentIndex >= questions.length - 1}
                  onClick={() => setCurrentIndex((i) => i + 1)}
                >
                  Next
                </Button>
              </div>
            </article>
          ) : null}

          <footer className={qs.attemptFooter}>
            <Button
              type="button"
              variant="primary"
              onClick={() => setShowSubmitConfirm(true)}
              disabled={submitting || secondsLeft === 0}
            >
              {submitting ? 'Submitting…' : secondsLeft === 0 ? 'Time expired' : 'Submit quiz'}
            </Button>
            <Button type="button" variant="ghost" onClick={onExit}>
              Exit without submitting
            </Button>
          </footer>
        </>
      ) : null}

      <ConfirmDialog
        open={showSubmitConfirm}
        title="Submit this quiz?"
        message={
          remainingCount > 0
            ? `You have answered ${answeredCount} of ${questions.length} questions. ${remainingCount} question${remainingCount === 1 ? ' is' : 's are'} still blank. After submission, you cannot change your answers.`
            : `You have answered all ${questions.length} questions. After submission, you cannot change your answers.`
        }
        confirmLabel="Submit now"
        cancelLabel="Continue quiz"
        busy={submitting}
        onConfirm={submitQuiz}
        onCancel={() => setShowSubmitConfirm(false)}
      />
    </div>
  );
}
