import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import api from '../config/api';
import { validateQuizQuestionsForPublishClient, buildPublishReadiness, totalDurationMinutesFromForm } from '../utils/quizIntegrity';
import {
  resolveCourseAccessMessage,
  getStudentQuizUiState,
  useAssessmentRoles
} from '../assessment';
import {
  AssessmentShell,
  AssessmentPageHeader,
  AssessmentCard,
  AssessmentSectionTitle,
  AssessmentMeta,
  AssessmentAlert,
  AssessmentEmpty,
  AssessmentList,
  AssessmentToolbar,
  AssessmentDivider,
  BtnPrimary,
  BtnSecondary,
  BtnAccent,
  BtnDanger,
  Field,
  TextInput,
  TextArea,
  CardTitleRow,
  StatusBadge,
  SelectInput,
  QueueItem
} from '../components/assessment/AssessmentPrimitives';
import CoursePageFrame from '../components/workspace/CoursePageFrame';
import QuizTakingWorkspace from '../components/quizzes/QuizTakingWorkspace';
import PublishValidationPanel from '../components/quizzes/PublishValidationPanel';
import QuizEmptyIllustration from '../components/quizzes/QuizEmptyIllustration';
import qstyles from '../components/quizzes/AssessmentQuiz.module.css';
import s from '../components/assessment/AssessmentPrimitives.module.css';

function computeQuizParticipantStats(participants = []) {
  const submitted = participants.filter((p) => p.submitted_at).length;
  const scores = participants.filter((p) => p.score != null).map((p) => Number(p.score));
  const avg = scores.length
    ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
    : null;
  return { submitted, total: participants.length, avg };
}

const ensureFourOptions = (options = []) => {
  const normalized = Array.isArray(options) ? options.map((option) => String(option ?? '')) : [];
  while (normalized.length < 4) normalized.push('');
  return normalized.slice(0, 4);
};

const createEmptyQuestion = () => ({
  id: null,
  question_text: '',
  question_type: 'mcq',
  options: ['', '', '', ''],
  correct_answer: '',
  marks: 1
});

const toQuestionFormState = (question = {}) => ({
  id: question.id || null,
  question_text: question.question_text || '',
  question_type: question.question_type || 'mcq',
  options: question.question_type === 'mcq' ? ensureFourOptions(question.options) : ['', '', '', ''],
  correct_answer: question.correct_answer || '',
  marks: Number(question.marks) || 1
});

const normalizeQuestionPayload = (question = {}) => ({
  ...(question.id ? { id: question.id } : {}),
  question_text: String(question.question_text || '').trim(),
  question_type: question.question_type || 'mcq',
  options: question.question_type === 'mcq'
    ? ensureFourOptions(question.options).map((option) => option.trim()).filter(Boolean)
    : (question.question_type === 'true_false' ? ['True', 'False'] : null),
  correct_answer: String(question.correct_answer || '').trim(),
  marks: Math.max(1, Number.parseInt(question.marks ?? 1, 10) || 1)
});

export default function Quizzes() {
  const { courseId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isLecturer, isStudent } = useAssessmentRoles();

  const [quizzes, setQuizzes] = useState([]);
  const [quizAvailabilityById, setQuizAvailabilityById] = useState({});
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: '', time_limit_minutes: 30, duration_hours: 0, duration_minutes: 30 });
  const [questions, setQuestions] = useState([createEmptyQuestion()]);
  const [openParticipantsQuizId, setOpenParticipantsQuizId] = useState(null);
  const [participantsByQuiz, setParticipantsByQuiz] = useState({});
  const [participantsError, setParticipantsError] = useState('');
  const [loadingParticipantsId, setLoadingParticipantsId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const draftQuizId = searchParams.get('draftQuizId');
  const createMode = searchParams.get('create') === '1';
  const draftQuizTarget = useMemo(
    () => quizzes.find((quiz) => String(quiz.id) === String(draftQuizId)) || null,
    [quizzes, draftQuizId]
  );

  useEffect(() => {
    if (!isLecturer || !draftQuizId) {
      return;
    }

    let cancelled = false;

    const loadQuizQuestions = async () => {
      setCreating(true);
      setLoadingQuestions(true);
      setError('');

      try {
        const res = await api.get(`/quizzes/${draftQuizId}/questions`);
        if (cancelled) return;

        const loadedQuestions = Array.isArray(res.data) ? res.data : [];
        setQuestions(loadedQuestions.length ? loadedQuestions.map(toQuestionFormState) : [createEmptyQuestion()]);
      } catch (err) {
        if (!cancelled) {
          setQuestions([createEmptyQuestion()]);
          setError(err?.response?.data?.error || 'Failed to load quiz questions.');
        }
      } finally {
        if (!cancelled) {
          setLoadingQuestions(false);
        }
      }
    };

    loadQuizQuestions();

    return () => {
      cancelled = true;
    };
  }, [draftQuizId, isLecturer]);

  useEffect(() => {
    if (isLecturer && createMode && !draftQuizId) {
      setCreating(true);
      setQuestions((prev) => prev.length ? prev : [createEmptyQuestion()]);
    }
  }, [createMode, draftQuizId, isLecturer]);

  useEffect(() => {
    const loadQuizzes = async () => {
      setLoading(true);
      setError('');

      try {
        if (courseId && isStudent) {
          const coursesRes = await api.get('/courses');
          const visibleCourses = Array.isArray(coursesRes.data) ? coursesRes.data : [];
          const hasAccess = visibleCourses.some((course) => String(course.id) === String(courseId));

          if (!hasAccess) {
            setQuizzes([]);
            setError('Access denied: you are not enrolled in this course or the course does not exist.');
            return;
          }
        }

        const endpoint = courseId ? `/quizzes/course/${courseId}` : '/quizzes';
        const res = await api.get(endpoint);
        setQuizzes(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        setQuizzes([]);
        setError(resolveCourseAccessMessage(err, 'Failed to load quizzes.'));
      } finally {
        setLoading(false);
      }
    };

    loadQuizzes();
  }, [courseId, isStudent]);

  useEffect(() => {
    if (!isStudent) {
      setQuizAvailabilityById({});
      return;
    }

    if (!quizzes.length) {
      setQuizAvailabilityById({});
      return;
    }

    let cancelled = false;

    const loadQuizAvailability = async () => {
      const entries = await Promise.all(quizzes.map(async (quiz) => {
        if (!quiz.is_published) {
          return [quiz.id, { canStart: false, label: 'This quiz is not available yet' }];
        }

        try {
          const res = await api.get(`/quizzes/${quiz.id}/questions`);
          const questionCount = Array.isArray(res.data) ? res.data.length : 0;

          return [
            quiz.id,
            questionCount > 0
              ? { canStart: true, questionCount }
              : { canStart: false, label: 'This quiz is not available yet' }
          ];
        } catch (err) {
          return [
            quiz.id,
            {
              canStart: false,
              label: err?.response?.data?.error || 'This quiz is not available yet'
            }
          ];
        }
      }));

      if (!cancelled) {
        setQuizAvailabilityById(Object.fromEntries(entries));
      }
    };

    loadQuizAvailability();

    return () => {
      cancelled = true;
    };
  }, [isStudent, quizzes]);

  const addQuestion = () =>
    setQuestions((prev) => [...prev, createEmptyQuestion()]);

  const updateQuestion = (i, field, value) =>
    setQuestions((prev) => prev.map((q, idx) => {
      if (idx !== i) return q;
      if (field === 'question_type') {
        return {
          ...q,
          question_type: value,
          options: value === 'mcq' ? ensureFourOptions(q.options) : ['', '', '', ''],
          correct_answer: ''
        };
      }
      return { ...q, [field]: value };
    }));

  const openQuestionManager = (quizId) => {
    setError('');
    setCreating(true);
    setSearchParams({ draftQuizId: String(quizId) });
  };

  const deleteQuestion = async (questionIndex) => {
    const targetQuestion = questions[questionIndex];
    if (!targetQuestion) return;

    if (!targetQuestion.id) {
      setQuestions((prev) => {
        const next = prev.filter((_, idx) => idx !== questionIndex);
        return next.length ? next : [createEmptyQuestion()];
      });
      return;
    }

    setError('');
    try {
      const res = await api.delete(`/quizzes/questions/${targetQuestion.id}`);
      setQuestions((prev) => {
        const next = prev.filter((_, idx) => idx !== questionIndex);
        return next.length ? next : [createEmptyQuestion()];
      });
      setQuizzes((prev) => prev.map((quiz) => (
        quiz.id === res.data?.quiz_id
          ? { ...quiz, question_count: res.data?.question_count ?? Math.max((quiz.question_count || 1) - 1, 0) }
          : quiz
      )));
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to delete question.');
    }
  };

  const createQuiz = async (e) => {
    e.preventDefault();
    setError('');

    const normalizedQuestions = questions
      .map(normalizeQuestionPayload)
      .filter((q) => q.question_text);

    try {
      if (draftQuizTarget) {
        if (normalizedQuestions.length === 0) {
          setError('Add at least one question before saving.');
          return;
        }

        const res = await api.post(`/quizzes/${draftQuizTarget.id}/questions`, { questions: normalizedQuestions });
        setQuizzes((prev) => prev.map((quiz) => (quiz.id === draftQuizTarget.id ? { ...quiz, ...res.data } : quiz)));
        setQuestions([createEmptyQuestion()]);
        setCreating(false);
        setSearchParams({});
        return;
      }

      if (normalizedQuestions.length === 0) {
        setError('Add at least one question before saving.');
        return;
      }

      const totalMin = totalDurationMinutesFromForm(form);
      const payload = {
        ...form,
        time_limit_minutes: totalMin,
        course_id: courseId,
        questions: normalizedQuestions
      };
      const res = await api.post('/quizzes', payload);
      setQuizzes((prev) => [...prev, res.data]);

      setCreating(false);
      setSearchParams({});
      setForm({ title: '', time_limit_minutes: 30, duration_hours: 0, duration_minutes: 30 });
      setQuestions([createEmptyQuestion()]);
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to save quiz.');
    }
  };

  const publishQuiz = async (quizId) => {
    setError('');
    try {
      const qRes = await api.get(`/quizzes/${quizId}/questions`);
      const list = Array.isArray(qRes.data) ? qRes.data : [];
      const check = validateQuizQuestionsForPublishClient(list);
      if (!check.valid) {
        setError(`Cannot publish until fixed: ${check.errors.join(' ')}`);
        return;
      }
      const res = await api.patch(`/quizzes/${quizId}/publish`, {});
      setQuizzes((prev) => prev.map((quiz) => (quiz.id === quizId ? { ...quiz, ...res.data, is_published: true } : quiz)));
    } catch (err) {
      const payload = err?.response?.data;
      const msg = Array.isArray(payload?.validation_errors)
        ? payload.validation_errors.join(' ')
        : (payload?.error || 'Failed to publish quiz.');
      setError(msg);
    }
  };

  const updateQuizAttempt = (quizId, attemptData) => {
    setQuizzes((prev) => prev.map((quiz) => (
      quiz.id === quizId
        ? { ...quiz, myAttempt: attemptData }
        : quiz
    )));
  };

  const openQuiz = async (quizId) => {
    setError('');
    try {
      if (isStudent) {
        const questionsRes = await api.get(`/quizzes/${quizId}/questions`);
        const questionList = Array.isArray(questionsRes.data) ? questionsRes.data : [];

        if (questionList.length === 0) {
          setQuizAvailabilityById((prev) => ({
            ...prev,
            [quizId]: { canStart: false, label: 'This quiz is not available yet' }
          }));
          setError('This quiz is not available yet');
          return;
        }

        setQuizAvailabilityById((prev) => ({
          ...prev,
          [quizId]: { canStart: true, questionCount: questionList.length }
        }));
      }

      const res = await api.get(`/quizzes/${quizId}`);
      setActiveQuiz(res.data);
      setAnswers(res.data?.attempt_answers && typeof res.data.attempt_answers === 'object' ? res.data.attempt_answers : {});
      setResult(null);
    } catch (err) {
      const payload = err?.response?.data;
      if (isStudent) {
        setQuizAvailabilityById((prev) => ({
          ...prev,
          [quizId]: {
            canStart: false,
            label: payload?.error || 'This quiz is not available yet'
          }
        }));
      }
      if (payload?.attempt_id || Number.isFinite(Number(payload?.score))) {
        updateQuizAttempt(quizId, {
          id: payload?.attempt_id || null,
          score: payload?.score === null || payload?.score === undefined ? null : Number(payload.score),
          submitted_at: payload?.submitted_at || new Date().toISOString()
        });
      }
      setError(resolveCourseAccessMessage(err, payload?.error || 'Cannot open this quiz right now.'));
    }
  };

  const toggleParticipants = async (quizId) => {
    if (openParticipantsQuizId === quizId) {
      setOpenParticipantsQuizId(null);
      setParticipantsError('');
      return;
    }

    setOpenParticipantsQuizId(quizId);
    setParticipantsError('');

    if (participantsByQuiz[quizId]) {
      return;
    }

    setLoadingParticipantsId(quizId);
    try {
      const res = await api.get(`/quizzes/${quizId}/participants`);
      setParticipantsByQuiz((prev) => ({
        ...prev,
        [quizId]: Array.isArray(res.data) ? res.data : []
      }));
    } catch (err) {
      setParticipantsError(err?.response?.data?.error || 'Failed to load quiz participants.');
    } finally {
      setLoadingParticipantsId(null);
    }
  };

  if (activeQuiz) {
    return (
      <AssessmentShell>
        <QuizTakingWorkspace
          activeQuiz={activeQuiz}
          answers={answers}
          setAnswers={setAnswers}
          result={result}
          setResult={setResult}
          submitting={submitting}
          setSubmitting={setSubmitting}
          setError={setError}
          updateQuizAttempt={updateQuizAttempt}
          onExit={() => {
            setActiveQuiz(null);
            setResult(null);
            setAnswers({});
          }}
        />
      </AssessmentShell>
    );
  }
  return (
    <AssessmentShell wide={isLecturer}>
      <CoursePageFrame courseId={courseId} pageTitle="Quizzes">
      <AssessmentPageHeader
        kicker={isLecturer ? 'Teaching · quizzes' : 'Learning · quizzes'}
        title="Quizzes"
        lead={
          isLecturer
            ? 'Configure timing, build the question bank, publish when validated, and review attempt activity for this course.'
            : 'Start or resume timed attempts here. Availability, windows, and scores follow your instructor’s rules.'
        }
        toolbar={
          isLecturer && !creating ? (
            <BtnPrimary type="button" onClick={() => setCreating(true)}>New quiz</BtnPrimary>
          ) : null
        }
      />

      {loading ? <AssessmentMeta>Loading quizzes…</AssessmentMeta> : null}
      {error ? <AssessmentAlert type="error">{error}</AssessmentAlert> : null}

      {isLecturer && creating && (
        <AssessmentCard>
          <AssessmentSectionTitle>
            {draftQuizTarget ? `Question bank · ${draftQuizTarget.title}` : 'Create quiz'}
          </AssessmentSectionTitle>

          <form onSubmit={createQuiz} className={s.formGrid}>
            {!draftQuizTarget && (
              <>
                <Field label="Quiz title">
                  <TextInput value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Quiz title" required />
                </Field>
                <div className={s.flexRow} style={{ alignItems: 'flex-end', gap: '1rem' }}>
                  <Field label="Hours">
                    <TextInput
                      type="number"
                      min={0}
                      max={336}
                      value={form.duration_hours}
                      onChange={(e) => setForm({ ...form, duration_hours: e.target.value })}
                      style={{ maxWidth: '6.5rem' }}
                    />
                  </Field>
                  <Field label="Minutes">
                    <TextInput
                      type="number"
                      min={0}
                      max={59}
                      value={form.duration_minutes}
                      onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
                      style={{ maxWidth: '6.5rem' }}
                    />
                  </Field>
                  <AssessmentMeta strong>Total: {totalDurationMinutesFromForm(form)} min</AssessmentMeta>
                </div>
              </>
            )}

            {draftQuizTarget ? (
              <AssessmentMeta>
                {draftQuizTarget.is_published
                  ? 'Update questions below, then save. Published quizzes should be changed carefully while attempts are open.'
                  : 'Draft quiz — add at least one valid question, then save and publish when ready.'}
              </AssessmentMeta>
            ) : null}

            {loadingQuestions ? (
              <AssessmentMeta>Loading question editor…</AssessmentMeta>
            ) : (
              questions.map((q, i) => (
                <AssessmentCard key={q.id || i} muted>
                  <CardTitleRow
                    title={`Question ${i + 1}`}
                    aside={
                      <BtnDanger type="button" onClick={() => deleteQuestion(i)}>
                        Remove
                      </BtnDanger>
                    }
                  />
                  <Field label="Prompt">
                    <TextArea
                      value={q.question_text}
                      onChange={(e) => updateQuestion(i, 'question_text', e.target.value)}
                      placeholder="Question text"
                      rows={2}
                    />
                  </Field>
                  <div className={s.flexRow}>
                    <Field label="Type">
                      <SelectInput value={q.question_type} onChange={(e) => updateQuestion(i, 'question_type', e.target.value)}>
                        <option value="mcq">Multiple choice</option>
                        <option value="true_false">True / false</option>
                        <option value="short_answer">Short answer</option>
                      </SelectInput>
                    </Field>
                    <Field label="Marks">
                      <TextInput
                        type="number"
                        min={1}
                        value={q.marks}
                        onChange={(e) => updateQuestion(i, 'marks', e.target.value)}
                        style={{ maxWidth: '6.5rem' }}
                      />
                    </Field>
                  </div>
                  {q.question_type === 'mcq' && ensureFourOptions(q.options).map((opt, oi) => (
                    <Field key={oi} label={`Option ${oi + 1}`}>
                      <TextInput
                        value={opt}
                        onChange={(e) => {
                          const opts = ensureFourOptions(q.options);
                          opts[oi] = e.target.value;
                          updateQuestion(i, 'options', opts);
                        }}
                        placeholder={`Option ${oi + 1}`}
                      />
                    </Field>
                  ))}
                  {q.question_type === 'true_false' ? (
                    <p className={s.inlineHint}>Students choose between True and False.</p>
                  ) : null}
                  <Field label={q.question_type === 'short_answer' ? 'Expected answer' : 'Correct answer'}>
                    <TextInput
                      value={q.correct_answer}
                      onChange={(e) => updateQuestion(i, 'correct_answer', e.target.value)}
                      placeholder={q.question_type === 'short_answer' ? 'Expected answer' : 'Correct answer'}
                    />
                  </Field>
                </AssessmentCard>
              ))
            )}

            <PublishValidationPanel questions={questions} form={draftQuizTarget ? null : form} showWhenValid />

            <AssessmentToolbar>
              <BtnSecondary type="button" onClick={addQuestion}>Add question</BtnSecondary>
              <BtnPrimary type="submit" disabled={loadingQuestions}>
                {draftQuizTarget ? 'Save changes' : 'Save quiz'}
              </BtnPrimary>
              <BtnSecondary
                type="button"
                onClick={() => {
                  setCreating(false);
                  setSearchParams({});
                  setQuestions([createEmptyQuestion()]);
                }}
              >
                Cancel
              </BtnSecondary>
            </AssessmentToolbar>
          </form>
        </AssessmentCard>
      )}

      <AssessmentSectionTitle>Course quizzes</AssessmentSectionTitle>

      <AssessmentList>
        {quizzes.map((quiz) => {
          const participants = participantsByQuiz[quiz.id] || [];
          const isParticipantsOpen = openParticipantsQuizId === quiz.id;
          const studentState = getStudentQuizUiState(quiz, quizAvailabilityById[quiz.id]);

          return (
            <li key={quiz.id}>
              <AssessmentCard as="article">
                <CardTitleRow
                  title={quiz.title}
                  aside={
                    <div className={s.flexRow}>
                      {isLecturer ? (
                        <StatusBadge variant={quiz.is_published ? 'success' : 'warning'}>
                          {quiz.is_published ? 'Published' : 'Draft'}
                        </StatusBadge>
                      ) : (
                        <StatusBadge variant={studentState.badgeVariant}>{studentState.label}</StatusBadge>
                      )}
                    </div>
                  }
                />

                {isLecturer ? (
                  <AssessmentToolbar>
                    {!quiz.is_published ? (
                      <BtnAccent
                        type="button"
                        onClick={() => publishQuiz(quiz.id)}
                        title="All questions must pass integrity checks before publishing"
                      >
                        Publish
                      </BtnAccent>
                    ) : null}
                    <BtnSecondary type="button" onClick={() => openQuestionManager(quiz.id)}>Manage questions</BtnSecondary>
                    <BtnSecondary type="button" onClick={() => toggleParticipants(quiz.id)}>
                      {isParticipantsOpen ? 'Hide attempts' : 'View attempts'}
                    </BtnSecondary>
                  </AssessmentToolbar>
                ) : (
                  <AssessmentToolbar>
                    <BtnPrimary type="button" onClick={() => openQuiz(quiz.id)} disabled={!studentState.canStart}>
                      {studentState.buttonLabel}
                    </BtnPrimary>
                  </AssessmentToolbar>
                )}

                {isLecturer && isParticipantsOpen ? (
                  <div className={s.queue}>
                    <p className={s.queueTitle}>Attempt monitoring</p>
                    {participants.length > 0 ? (
                      <div className={qstyles.lecturerStats}>
                        {(() => {
                          const stats = computeQuizParticipantStats(participants);
                          return (
                            <>
                              <div className={qstyles.lecturerStat}>
                                <strong>{stats.submitted}</strong>
                                <span>Submitted</span>
                              </div>
                              <div className={qstyles.lecturerStat}>
                                <strong>{stats.avg ?? '—'}</strong>
                                <span>Average score</span>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    ) : null}
                    {participantsError ? <AssessmentAlert type="error">{participantsError}</AssessmentAlert> : null}
                    {loadingParticipantsId === quiz.id ? (
                      <AssessmentMeta>Loading participants…</AssessmentMeta>
                    ) : participants.length === 0 ? (
                      <div style={{ textAlign: 'center' }}>
                        <QuizEmptyIllustration />
                        <AssessmentEmpty>No attempts recorded yet.</AssessmentEmpty>
                      </div>
                    ) : (
                      participants.map((entry) => (
                        <QueueItem key={entry.id}>
                          <div className={s.queueItemHeader}>
                            <div>
                              <AssessmentMeta strong>{entry.student?.full_name || entry.student?.email || 'Unknown student'}</AssessmentMeta>
                              <AssessmentMeta>{entry.student?.student_id || entry.student?.email || 'No identifier'}</AssessmentMeta>
                            </div>
                            <StatusBadge variant="neutral">{entry.score ?? 'Pending'}</StatusBadge>
                          </div>
                        </QueueItem>
                      ))
                    )}
                  </div>
                ) : null}
              </AssessmentCard>
            </li>
          );
        })}
      </AssessmentList>

      {!loading && quizzes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-6)' }}>
          <QuizEmptyIllustration />
          <AssessmentEmpty>No quizzes in this course yet.</AssessmentEmpty>
        </div>
      ) : null}
      </CoursePageFrame>
    </AssessmentShell>
  );
}
