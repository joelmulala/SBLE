import React, { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../config/api';
import { formatSeconds } from '../../assessment';
import useQuizAttemptTimer from '../../hooks/useQuizAttemptTimer';
import {
  AssessmentPageHeader,
  AssessmentAlert,
  AssessmentSectionTitle,
  AssessmentToolbar,
  AssessmentCard,
  AssessmentMeta,
  BtnAccent,
  BtnSecondary,
  BtnPrimary,
  CardTitleRow,
  StatusBadge,
  TextInput
} from '../assessment/AssessmentPrimitives';
import s from '../assessment/AssessmentPrimitives.module.css';
import qs from './AssessmentQuiz.module.css';

export default function QuizTakingWorkspace({
  activeQuiz,
  answers,
  setAnswers,
  result,
  setResult,
  submitting,
  setSubmitting,
  setError,
  updateQuizAttempt,
  onExit
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [saveState, setSaveState] = useState('idle');
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
    } catch (err) {
      const payload = err?.response?.data;
      if (payload?.attempt_id || payload?.score != null) {
        setResult({
          ...payload,
          score: Number(payload.score ?? 0),
          totalMarks: Number(payload.totalMarks ?? totalMarks),
          auto_submitted: Boolean(payload?.auto_submitted)
        });
      }
      setError(payload?.error || 'Failed to submit quiz.');
    } finally {
      setSubmitting(false);
    }
  };

  const timerClass = secondsLeft == null
    ? ''
    : secondsLeft < 60
      ? qs.timerUrgent
      : secondsLeft < 300
        ? qs.timerWarn
        : qs.timerOk;

  const answeredCount = questions.filter((q) => {
    const a = answers[q.id];
    return a !== undefined && a !== null && String(a).trim() !== '';
  }).length;

  const currentQ = questions[currentIndex];

  if (result) {
    return (
      <div className={qs.attemptWorkspace}>
        <AssessmentPageHeader kicker="Quiz results" title={activeQuiz.title} lead="Your attempt has been recorded." />
        <div className={s.resultPanel}>
          <CardTitleRow
            title={`Score · ${result.score}/${result.totalMarks ?? 0}`}
            aside={
              <StatusBadge variant="info">
                {result.totalMarks
                  ? `${Math.round((Number(result.score || 0) / Number(result.totalMarks)) * 100)}%`
                  : '0%'}
              </StatusBadge>
            }
          />
          {result.auto_submitted ? (
            <AssessmentAlert type="warn">Time expired — your answers were submitted automatically by the server.</AssessmentAlert>
          ) : null}
          {result.message ? <AssessmentAlert type="success">{result.message}</AssessmentAlert> : null}
          {Array.isArray(result.feedback) && result.feedback.length > 0 ? (
            <>
              <AssessmentSectionTitle>Feedback</AssessmentSectionTitle>
              <div className={s.formGrid}>
                {result.feedback.map((item, index) => (
                  <AssessmentAlert key={item.question_id || index} type={item.status === 'correct' ? 'success' : 'error'}>
                    {item.message}
                  </AssessmentAlert>
                ))}
              </div>
            </>
          ) : null}
          <AssessmentToolbar>
            <BtnPrimary type="button" onClick={onExit}>Back to quizzes</BtnPrimary>
          </AssessmentToolbar>
        </div>
      </div>
    );
  }

  return (
    <div className={qs.attemptWorkspace}>
      <AssessmentPageHeader
        kicker="Quiz attempt"
        title={activeQuiz.title}
        lead={`${answeredCount} of ${questions.length} answered · server-enforced timer`}
      />

      {secondsLeft != null ? (
        <div className={qs.timerBar}>
          <div>
            <AssessmentMeta>Time remaining</AssessmentMeta>
            <p className={`${qs.timerValue} ${timerClass}`}>{formatSeconds(secondsLeft)}</p>
          </div>
          <div>
            <p className={qs.saveStatus}>
              {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : saveState === 'error' ? 'Save failed' : 'Autosave on'}
            </p>
            <AssessmentMeta>{answeredCount}/{questions.length} complete</AssessmentMeta>
          </div>
        </div>
      ) : null}

      {!hasQuestions ? <AssessmentAlert type="warn">This quiz is not available yet.</AssessmentAlert> : null}

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
                  aria-label={`Question ${i + 1}${answered ? ', answered' : ''}`}
                >
                  {i + 1}
                </button>
              );
            })}
          </nav>

          {currentQ ? (
            <article className={qs.questionPanel}>
              <p className={s.questionTitle}>
                {currentIndex + 1}. {currentQ.question_text}{' '}
                <span className={s.meta}>({currentQ.marks} mark{currentQ.marks > 1 ? 's' : ''})</span>
              </p>

              {currentQ.question_type === 'mcq' && currentQ.options?.map((opt, oi) => (
                <label key={oi} className={s.optionLabel}>
                  <input
                    type="radio"
                    name={`q_${currentQ.id}`}
                    value={opt}
                    checked={answers[currentQ.id] === opt}
                    onChange={() => setAnswers((prev) => ({ ...prev, [currentQ.id]: opt }))}
                  />
                  {' '}
                  {opt}
                </label>
              ))}

              {currentQ.question_type === 'true_false' && ['True', 'False'].map((opt) => (
                <label key={opt} className={s.optionLabel}>
                  <input
                    type="radio"
                    name={`q_${currentQ.id}`}
                    value={opt}
                    checked={answers[currentQ.id] === opt}
                    onChange={() => setAnswers((prev) => ({ ...prev, [currentQ.id]: opt }))}
                  />
                  {' '}
                  {opt}
                </label>
              ))}

              {currentQ.question_type === 'short_answer' && (
                <TextInput
                  value={answers[currentQ.id] || ''}
                  onChange={(e) => setAnswers((prev) => ({ ...prev, [currentQ.id]: e.target.value }))}
                  placeholder="Type your answer…"
                  style={{ marginTop: 8 }}
                />
              )}

              <div className={qs.questionNav}>
                <BtnSecondary type="button" disabled={currentIndex === 0} onClick={() => setCurrentIndex((i) => i - 1)}>
                  Previous
                </BtnSecondary>
                <BtnSecondary
                  type="button"
                  disabled={currentIndex >= questions.length - 1}
                  onClick={() => setCurrentIndex((i) => i + 1)}
                >
                  Next
                </BtnSecondary>
              </div>
            </article>
          ) : null}

          <AssessmentToolbar>
            <BtnAccent
              type="button"
              onClick={submitQuiz}
              disabled={submitting || secondsLeft === 0}
            >
              {submitting ? 'Submitting…' : secondsLeft === 0 ? 'Time expired' : 'Submit quiz'}
            </BtnAccent>
            <BtnSecondary type="button" onClick={onExit}>Exit</BtnSecondary>
          </AssessmentToolbar>
        </>
      ) : null}
    </div>
  );
}
