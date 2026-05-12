import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useKeycloak } from '../auth/AuthProvider';
import api from '../config/api';

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
  const { keycloak } = useKeycloak();
  const isLecturer = keycloak.hasRealmRole('lecturer') || keycloak.hasRealmRole('admin');
  const isStudent = keycloak.hasRealmRole('student');

  const [quizzes, setQuizzes] = useState([]);
  const [quizAvailabilityById, setQuizAvailabilityById] = useState({});
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: '', time_limit_minutes: 30 });
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

      const payload = {
        ...form,
        course_id: courseId,
        questions: normalizedQuestions
      };
      const res = await api.post('/quizzes', payload);
      setQuizzes((prev) => [...prev, res.data]);

      setCreating(false);
      setSearchParams({});
      setForm({ title: '', time_limit_minutes: 30 });
      setQuestions([createEmptyQuestion()]);
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to save quiz.');
    }
  };

  const publishQuiz = async (quizId) => {
    try {
      const res = await api.patch(`/quizzes/${quizId}/publish`);
      setQuizzes((prev) => prev.map((quiz) => (quiz.id === quizId ? { ...quiz, ...res.data, is_published: true } : quiz)));
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to publish quiz.');
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
      setAnswers({});
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

  const submitQuiz = async () => {
    if (!activeQuiz || !Array.isArray(activeQuiz.QuizQuestions) || activeQuiz.QuizQuestions.length === 0) {
      setError('This quiz is not available yet');
      return;
    }

    const totalMarks = activeQuiz.QuizQuestions.reduce((sum, question) => sum + (Number(question.marks) || 1), 0);

    setSubmitting(true);
    setError('');
    try {
      const res = await api.post(`/quizzes/${activeQuiz.id}/attempt`, { answers });
      const score = Number(res.data?.score ?? 0);
      updateQuizAttempt(activeQuiz.id, {
        id: res.data?.attempt?.id || activeQuiz.attempt_id || null,
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
      if (payload?.attempt_id || Number.isFinite(Number(payload?.score))) {
        const score = Number(payload.score ?? 0);
        updateQuizAttempt(activeQuiz.id, {
          id: payload?.attempt_id || activeQuiz.attempt_id || null,
          score,
          submitted_at: payload?.submitted_at || new Date().toISOString()
        });
        setResult({
          ...payload,
          score,
          totalMarks: Number(payload?.totalMarks ?? totalMarks),
          correctAnswers: Array.isArray(payload?.correctAnswers) ? payload.correctAnswers : [],
          feedback: Array.isArray(payload?.feedback) ? payload.feedback : [],
          auto_graded: true,
          auto_submitted: Boolean(payload?.auto_submitted)
        });
      }
      setError(resolveCourseAccessMessage(err, payload?.error || 'Failed to submit quiz.'));
    } finally {
      setSubmitting(false);
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
    const hasActiveQuestions = Array.isArray(activeQuiz.QuizQuestions) && activeQuiz.QuizQuestions.length > 0;

    return (
      <div className="app-page">
        <div className="app-container app-container--narrow">
      <div className="app-surface app-surface-body" style={{ maxWidth: 760 }}>
        <h2>{activeQuiz.title}</h2>
        <p style={{ color: '#888', marginBottom: 20 }}>Time limit: {activeQuiz.time_limit_minutes} min</p>

        {!hasActiveQuestions && (
          <div style={{ background: '#fff4e5', color: '#b54708', padding: 14, borderRadius: 8, marginBottom: 12 }}>
            This quiz is not available yet
          </div>
        )}

        {activeQuiz.QuizQuestions?.map((q, i) => (
          <div key={q.id} style={{ background: '#fff', padding: 16, borderRadius: 8, marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
            <p style={{ fontWeight: 600 }}>{i + 1}. {q.question_text} <span style={{ color: '#aaa', fontWeight: 400 }}>({q.marks} mark{q.marks > 1 ? 's' : ''})</span></p>

            {q.question_type === 'mcq' && q.options?.map((opt, oi) => (
              <label key={oi} style={{ display: 'block', marginTop: 8, cursor: 'pointer' }}>
                <input type="radio" name={`q_${q.id}`} value={opt}
                  checked={answers[q.id] === opt}
                  onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: opt }))} />
                {' '}{opt}
              </label>
            ))}

            {q.question_type === 'true_false' && ['True', 'False'].map((opt) => (
              <label key={opt} style={{ display: 'block', marginTop: 8, cursor: 'pointer' }}>
                <input type="radio" name={`q_${q.id}`} value={opt}
                  checked={answers[q.id] === opt}
                  onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: opt }))} />
                {' '}{opt}
              </label>
            ))}

            {q.question_type === 'short_answer' && (
              <input value={answers[q.id] || ''} onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                placeholder="Your answer..." style={{ marginTop: 8, width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #ddd' }} />
            )}
          </div>
        ))}

        {result ? (
          <div style={{ background: '#f8fbff', border: '1px solid #dbeafe', padding: 20, borderRadius: 12, marginTop: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Quiz Result</p>
                <h3 style={{ margin: '6px 0 0 0', color: '#111827' }}>You scored {result.score}/{result.totalMarks ?? 0}</h3>
              </div>
              <div style={{ background: '#dbeafe', color: '#1d4ed8', borderRadius: 999, padding: '8px 14px', fontWeight: 700 }}>
                {result.totalMarks ? `${Math.round((Number(result.score || 0) / Number(result.totalMarks)) * 100)}%` : '0%'}
              </div>
            </div>

            {result.message && <p style={{ marginTop: 10, color: '#166534' }}>{result.message}</p>}
            {result.auto_submitted && (
              <div style={{ marginTop: 10, background: '#fff7ed', color: '#b45309', borderRadius: 8, padding: '10px 12px' }}>
                Your time expired, so the quiz was submitted automatically.
              </div>
            )}

            {Array.isArray(result.feedback) && result.feedback.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <strong style={{ color: '#111827' }}>Feedback</strong>
                <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                  {result.feedback.map((item, index) => (
                    <div
                      key={item.question_id || index}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 8,
                        background: item.status === 'correct' ? '#ecfdf3' : '#fef3f2',
                        color: item.status === 'correct' ? '#166534' : '#b42318',
                        border: item.status === 'correct' ? '1px solid #abefc6' : '1px solid #fecdca'
                      }}
                    >
                      {item.message}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {Array.isArray(result.correctAnswers) && result.correctAnswers.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <strong style={{ color: '#111827' }}>Answer Review</strong>
                <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
                  {result.correctAnswers.map((item, index) => (
                    <div key={item.question_id || index} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
                      <div style={{ fontWeight: 600, color: '#111827' }}>{item.question_text}</div>
                      <div style={{ fontSize: '0.9rem', marginTop: 6, color: '#475467' }}>Your answer: <strong>{item.submitted_answer || 'No answer'}</strong></div>
                      <div style={{ fontSize: '0.9rem', marginTop: 4, color: '#475467' }}>Correct answer: <strong>{item.correct_answer || 'Not provided'}</strong></div>
                      <div style={{ marginTop: 6, fontSize: '0.85rem', color: item.is_correct ? '#166534' : '#b42318', fontWeight: 600 }}>
                        {item.is_correct ? `Correct • +${item.marks_awarded}` : `Incorrect • 0/${item.marks_possible}`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button onClick={() => setActiveQuiz(null)} style={{ marginTop: 16, padding: '8px 20px', borderRadius: 6, border: 'none', background: '#4f8ef7', color: '#fff', cursor: 'pointer' }}>
              Back to Quizzes
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button onClick={submitQuiz} disabled={submitting || !hasActiveQuestions} style={{ padding: '10px 24px', borderRadius: 6, border: 'none', background: '#28a745', color: '#fff', cursor: (submitting || !hasActiveQuestions) ? 'not-allowed' : 'pointer', opacity: (submitting || !hasActiveQuestions) ? 0.7 : 1 }}>
              {submitting ? 'Submitting...' : 'Submit Quiz'}
            </button>
            <button onClick={() => setActiveQuiz(null)} style={{ padding: '10px 24px', borderRadius: 6, border: '1px solid #ddd', background: '#fff', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        )}
      </div>
      </div>
      </div>
    );
  }

  return (
    <div className="app-page">
      <div className="app-container app-stack">
      <section className="app-surface">
        <div className="app-surface-body">
          <p className="app-kicker">{isLecturer ? 'Quiz Authoring' : 'Quiz Attempts'}</p>
          <h1 className="page-title" style={{ marginTop: '0.35rem' }}>{isLecturer ? 'Manage Quizzes' : 'Quizzes'}</h1>
        </div>
      </section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: '1rem', color: '#667085', fontWeight: 500 }}>Assessments by course workflow</h2>
        {isLecturer && !creating && (
          <button onClick={() => setCreating(true)} style={{ background: '#4f8ef7', color: '#fff', padding: '8px 20px', borderRadius: 6, border: 'none', cursor: 'pointer' }}>
            + New Quiz
          </button>
        )}
      </div>
      {loading && <p style={{ marginTop: 12, color: '#666' }}>Loading quizzes...</p>}
      {error && <p style={{ marginTop: 12, color: '#c0392b' }}>{error}</p>}

      {isLecturer && creating && (
        <form onSubmit={createQuiz} className="app-surface app-surface-body" style={{ maxWidth: 760 }}>
          <h3 style={{ marginBottom: 16 }}>{draftQuizTarget ? `Manage Questions • ${draftQuizTarget.title}` : 'Create Quiz'}</h3>

          {!draftQuizTarget && (
            <>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Quiz title" required
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #ddd', marginBottom: 10 }} />
              <input type="number" value={form.time_limit_minutes} onChange={(e) => setForm({ ...form, time_limit_minutes: e.target.value })}
                placeholder="Time limit (minutes)" style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #ddd', marginBottom: 16 }} />
            </>
          )}

          {draftQuizTarget && (
            <p style={{ marginTop: 0, marginBottom: 14, color: '#667085' }}>
              {draftQuizTarget.is_published
                ? 'Update the questions below and save your changes.'
                : 'This quiz is saved as a draft. Add at least one question before publishing it.'}
            </p>
          )}

          {loadingQuestions ? (
            <p style={{ color: '#666', marginBottom: 12 }}>Loading question editor...</p>
          ) : questions.map((q, i) => (
            <div key={q.id || i} style={{ border: '1px solid #eee', borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                <p style={{ fontWeight: 600, margin: 0 }}>Question {i + 1}</p>
                <button
                  type="button"
                  onClick={() => deleteQuestion(i)}
                  style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #f04438', background: '#fff', color: '#f04438', cursor: 'pointer' }}
                >
                  Delete
                </button>
              </div>
              <input value={q.question_text} onChange={(e) => updateQuestion(i, 'question_text', e.target.value)} placeholder="Question text"
                style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #ddd', marginBottom: 8 }} />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                <select value={q.question_type} onChange={(e) => updateQuestion(i, 'question_type', e.target.value)}
                  style={{ padding: '8px', borderRadius: 6, border: '1px solid #ddd' }}>
                  <option value="mcq">Multiple Choice</option>
                  <option value="true_false">True / False</option>
                  <option value="short_answer">Short Answer</option>
                </select>
                <input
                  type="number"
                  min="1"
                  value={q.marks}
                  onChange={(e) => updateQuestion(i, 'marks', e.target.value)}
                  placeholder="Marks"
                  style={{ width: 110, padding: '8px', borderRadius: 6, border: '1px solid #ddd' }}
                />
              </div>
              {q.question_type === 'mcq' && ensureFourOptions(q.options).map((opt, oi) => (
                <input key={oi} value={opt} onChange={(e) => {
                  const opts = ensureFourOptions(q.options);
                  opts[oi] = e.target.value;
                  updateQuestion(i, 'options', opts);
                }} placeholder={`Option ${oi + 1}`}
                  style={{ display: 'block', width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #ddd', marginBottom: 4 }} />
              ))}
              {q.question_type === 'true_false' && (
                <p style={{ fontSize: '0.85rem', color: '#667085', margin: '6px 0' }}>
                  Students will choose between True and False.
                </p>
              )}
              <input value={q.correct_answer} onChange={(e) => updateQuestion(i, 'correct_answer', e.target.value)} placeholder={q.question_type === 'short_answer' ? 'Expected answer' : 'Correct answer'}
                style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #ddd', marginTop: 4 }} />
            </div>
          ))}

          <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
            <button type="button" onClick={addQuestion} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #4f8ef7', color: '#4f8ef7', background: '#fff', cursor: 'pointer' }}>
              + Add Question
            </button>
            <button type="submit" disabled={loadingQuestions} style={{ padding: '8px 20px', borderRadius: 6, border: 'none', background: '#4f8ef7', color: '#fff', cursor: loadingQuestions ? 'not-allowed' : 'pointer', opacity: loadingQuestions ? 0.7 : 1 }}>
              {draftQuizTarget ? 'Save Changes' : 'Save Quiz'}
            </button>
            <button type="button" onClick={() => { setCreating(false); setSearchParams({}); setQuestions([createEmptyQuestion()]); }} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #ddd', background: '#fff', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10, padding: 0 }}>
        {quizzes.map((quiz) => {
          const participants = participantsByQuiz[quiz.id] || [];
          const isParticipantsOpen = openParticipantsQuizId === quiz.id;
          const studentState = getStudentQuizState(quiz, quizAvailabilityById[quiz.id]);

          return (
            <li key={quiz.id} className="app-surface app-surface-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <strong>{quiz.title}</strong>
                  <span style={{ marginLeft: 10, fontSize: '0.8rem', color: quiz.is_published ? '#28a745' : '#aaa' }}>
                    {quiz.is_published ? 'Published' : 'Draft'}
                  </span>
                  {!isLecturer && (
                    <div style={{ marginTop: 6, color: studentState.color, fontSize: '0.85rem', fontWeight: 600 }}>
                      {studentState.label}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {isLecturer && !quiz.is_published && (
                    <button onClick={() => publishQuiz(quiz.id)} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#28a745', color: '#fff', cursor: 'pointer' }}>
                      Publish
                    </button>
                  )}
                  {isLecturer && (
                    <>
                      <button onClick={() => openQuestionManager(quiz.id)} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #ddd', background: '#fff', cursor: 'pointer' }}>
                        Manage Questions
                      </button>
                      <button onClick={() => toggleParticipants(quiz.id)} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #ddd', background: '#fff', cursor: 'pointer' }}>
                        {isParticipantsOpen ? 'Hide Participants' : 'View Participants'}
                      </button>
                    </>
                  )}
                  {!isLecturer && (
                    <button onClick={() => openQuiz(quiz.id)} disabled={!studentState.canStart}
                      style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: studentState.canStart ? '#4f8ef7' : '#d0d5dd', color: '#fff', cursor: studentState.canStart ? 'pointer' : 'not-allowed' }}>
                      {studentState.buttonLabel}
                    </button>
                  )}
                </div>
              </div>

              {isLecturer && isParticipantsOpen && (
                <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 12 }}>
                  <strong style={{ display: 'block', marginBottom: 10 }}>Participants</strong>
                  {participantsError && <p style={{ color: '#c0392b', marginBottom: 8 }}>{participantsError}</p>}
                  {loadingParticipantsId === quiz.id ? (
                    <p style={{ color: '#666' }}>Loading participants...</p>
                  ) : participants.length === 0 ? (
                    <p style={{ color: '#888' }}>No students have taken this quiz yet.</p>
                  ) : (
                    <div style={{ display: 'grid', gap: 8 }}>
                      {participants.map((entry) => (
                        <div key={entry.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', padding: '8px 10px', borderRadius: 6, background: '#f8fafc' }}>
                          <div>
                            <div style={{ fontWeight: 600 }}>{entry.student?.full_name || entry.student?.email || 'Unknown student'}</div>
                            <div style={{ fontSize: '0.82rem', color: '#666' }}>{entry.student?.student_id || entry.student?.email || 'No identifier'}</div>
                          </div>
                          <div style={{ fontWeight: 700, color: '#1f2937' }}>{entry.score ?? 'Pending'}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
        {!loading && quizzes.length === 0 && <p style={{ color: '#888', marginTop: 16 }}>No quizzes available yet.</p>}
      </ul>
      </div>
    </div>
  );
}

function resolveCourseAccessMessage(err, fallback) {
  const status = err?.response?.status;
  const backendMessage = err?.response?.data?.error;

  if (backendMessage && backendMessage !== 'Forbidden: not enrolled in this course') {
    return backendMessage;
  }

  if (status === 403) return 'Access denied: you are not enrolled in this course.';
  if (status === 404) return 'This course does not exist or is no longer available.';
  return backendMessage || fallback;
}

function getStudentQuizState(quiz, availability) {
  const attempt = quiz?.myAttempt;

  if (attempt?.submitted_at) {
    return {
      label: Number.isFinite(Number(attempt.score)) ? `Already attempted • Score ${Number(attempt.score)}` : 'Already attempted',
      canStart: false,
      color: '#16a34a',
      buttonLabel: 'Attempt Used'
    };
  }

  if (!quiz.is_published) {
    return { label: 'This quiz is not available yet', canStart: false, color: '#98a2b3', buttonLabel: 'Unavailable' };
  }

  if (!availability) {
    return { label: 'Checking availability...', canStart: false, color: '#98a2b3', buttonLabel: 'Checking...' };
  }

  if (availability.canStart === false) {
    return {
      label: availability.label || 'This quiz is not available yet',
      canStart: false,
      color: '#98a2b3',
      buttonLabel: 'Unavailable'
    };
  }

  const now = Date.now();
  const startTime = quiz.start_time ? new Date(quiz.start_time).getTime() : null;
  const endTime = quiz.end_time ? new Date(quiz.end_time).getTime() : null;

  if (startTime && now < startTime) {
    return {
      label: `Starts ${new Date(startTime).toLocaleString()}`,
      canStart: false,
      color: '#b54708',
      buttonLabel: 'Unavailable'
    };
  }

  if (endTime && now >= endTime) {
    return {
      label: 'Quiz closed',
      canStart: false,
      color: '#667085',
      buttonLabel: 'Unavailable'
    };
  }

  if (attempt?.id) {
    return {
      label: 'Attempt in progress',
      canStart: true,
      color: '#2563eb',
      buttonLabel: 'Resume Quiz'
    };
  }

  return { label: 'Available now', canStart: true, color: '#16a085', buttonLabel: 'Start Quiz' };
}
