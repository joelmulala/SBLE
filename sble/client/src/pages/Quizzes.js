import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useKeycloak } from '../auth/AuthProvider';
import api from '../config/api';

export default function Quizzes() {
  const { id: courseId } = useParams();
  const { keycloak } = useKeycloak();
  const isLecturer = keycloak.hasRealmRole('lecturer') || keycloak.hasRealmRole('admin');

  const [quizzes, setQuizzes] = useState([]);
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: '', time_limit_minutes: 30 });
  const [questions, setQuestions] = useState([{ question_text: '', question_type: 'mcq', options: ['', '', '', ''], correct_answer: '', marks: 1 }]);

  useEffect(() => {
    api.get(`/quizzes/course/${courseId}`).then(r => setQuizzes(r.data)).catch(() => {});
  }, [courseId]);

  const addQuestion = () =>
    setQuestions(prev => [...prev, { question_text: '', question_type: 'mcq', options: ['', '', '', ''], correct_answer: '', marks: 1 }]);

  const updateQuestion = (i, field, value) =>
    setQuestions(prev => prev.map((q, idx) => idx === i ? { ...q, [field]: value } : q));

  const createQuiz = async (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      course_id: courseId,
      questions: questions.map(q => ({
        ...q,
        options: q.question_type === 'mcq' ? q.options.filter(Boolean) : null
      }))
    };
    const res = await api.post('/quizzes', payload);
    setQuizzes(prev => [...prev, res.data]);
    setCreating(false);
    setForm({ title: '', time_limit_minutes: 30 });
    setQuestions([{ question_text: '', question_type: 'mcq', options: ['', '', '', ''], correct_answer: '', marks: 1 }]);
  };

  const publishQuiz = async (quizId) => {
    await api.patch(`/quizzes/${quizId}/publish`);
    setQuizzes(prev => prev.map(q => q.id === quizId ? { ...q, is_published: true } : q));
  };

  const openQuiz = async (quizId) => {
    const res = await api.get(`/quizzes/${quizId}`);
    setActiveQuiz(res.data);
    setAnswers({});
    setResult(null);
  };

  const submitQuiz = async () => {
    const res = await api.post(`/quizzes/${activeQuiz.id}/attempt`, { answers });
    setResult(res.data);
  };

  if (activeQuiz) return (
    <div style={{ maxWidth: 640 }}>
      <h2>{activeQuiz.title}</h2>
      <p style={{ color: '#888', marginBottom: 20 }}>Time limit: {activeQuiz.time_limit_minutes} min</p>

      {activeQuiz.QuizQuestions?.map((q, i) => (
        <div key={q.id} style={{ background: '#fff', padding: 16, borderRadius: 8, marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
          <p style={{ fontWeight: 600 }}>{i + 1}. {q.question_text} <span style={{ color: '#aaa', fontWeight: 400 }}>({q.marks} mark{q.marks > 1 ? 's' : ''})</span></p>

          {q.question_type === 'mcq' && q.options?.map((opt, oi) => (
            <label key={oi} style={{ display: 'block', marginTop: 8, cursor: 'pointer' }}>
              <input type="radio" name={`q_${q.id}`} value={opt}
                checked={answers[q.id] === opt}
                onChange={() => setAnswers(prev => ({ ...prev, [q.id]: opt }))} />
              {' '}{opt}
            </label>
          ))}

          {q.question_type === 'true_false' && ['True', 'False'].map(opt => (
            <label key={opt} style={{ display: 'block', marginTop: 8, cursor: 'pointer' }}>
              <input type="radio" name={`q_${q.id}`} value={opt}
                checked={answers[q.id] === opt}
                onChange={() => setAnswers(prev => ({ ...prev, [q.id]: opt }))} />
              {' '}{opt}
            </label>
          ))}

          {q.question_type === 'short_answer' && (
            <input value={answers[q.id] || ''} onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
              placeholder="Your answer..." style={{ marginTop: 8, width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #ddd' }} />
          )}
        </div>
      ))}

      {result ? (
        <div style={{ background: '#e8f5e9', padding: 20, borderRadius: 8, marginTop: 16 }}>
          <h3>Score: {result.score}</h3>
          <button onClick={() => setActiveQuiz(null)} style={{ marginTop: 12, padding: '8px 20px', borderRadius: 6, border: 'none', background: '#4f8ef7', color: '#fff', cursor: 'pointer' }}>
            Back to Quizzes
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button onClick={submitQuiz} style={{ padding: '10px 24px', borderRadius: 6, border: 'none', background: '#28a745', color: '#fff', cursor: 'pointer' }}>
            Submit Quiz
          </button>
          <button onClick={() => setActiveQuiz(null)} style={{ padding: '10px 24px', borderRadius: 6, border: '1px solid #ddd', background: '#fff', cursor: 'pointer' }}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Quizzes</h2>
        {isLecturer && !creating && (
          <button onClick={() => setCreating(true)} style={{ background: '#4f8ef7', color: '#fff', padding: '8px 20px', borderRadius: 6, border: 'none', cursor: 'pointer' }}>
            + New Quiz
          </button>
        )}
      </div>

      {isLecturer && creating && (
        <form onSubmit={createQuiz} style={{ marginTop: 20, background: '#fff', padding: 20, borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', maxWidth: 600 }}>
          <h3 style={{ marginBottom: 16 }}>Create Quiz</h3>
          <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Quiz title" required
            style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #ddd', marginBottom: 10 }} />
          <input type="number" value={form.time_limit_minutes} onChange={e => setForm({ ...form, time_limit_minutes: e.target.value })}
            placeholder="Time limit (minutes)" style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #ddd', marginBottom: 16 }} />

          {questions.map((q, i) => (
            <div key={i} style={{ border: '1px solid #eee', borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <p style={{ fontWeight: 600, marginBottom: 8 }}>Question {i + 1}</p>
              <input value={q.question_text} onChange={e => updateQuestion(i, 'question_text', e.target.value)} placeholder="Question text" required
                style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #ddd', marginBottom: 8 }} />
              <select value={q.question_type} onChange={e => updateQuestion(i, 'question_type', e.target.value)}
                style={{ padding: '8px', borderRadius: 6, border: '1px solid #ddd', marginBottom: 8 }}>
                <option value="mcq">Multiple Choice</option>
                <option value="true_false">True / False</option>
                <option value="short_answer">Short Answer</option>
              </select>
              {q.question_type === 'mcq' && q.options.map((opt, oi) => (
                <input key={oi} value={opt} onChange={e => {
                  const opts = [...q.options]; opts[oi] = e.target.value;
                  updateQuestion(i, 'options', opts);
                }} placeholder={`Option ${oi + 1}`}
                  style={{ display: 'block', width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #ddd', marginBottom: 4 }} />
              ))}
              <input value={q.correct_answer} onChange={e => updateQuestion(i, 'correct_answer', e.target.value)} placeholder="Correct answer"
                style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #ddd', marginTop: 4 }} />
            </div>
          ))}

          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button type="button" onClick={addQuestion} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #4f8ef7', color: '#4f8ef7', background: '#fff', cursor: 'pointer' }}>
              + Add Question
            </button>
            <button type="submit" style={{ padding: '8px 20px', borderRadius: 6, border: 'none', background: '#4f8ef7', color: '#fff', cursor: 'pointer' }}>
              Save Quiz
            </button>
            <button type="button" onClick={() => setCreating(false)} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #ddd', background: '#fff', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <ul style={{ marginTop: 24, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {quizzes.map(q => (
          <li key={q.id} style={{ background: '#fff', padding: 16, borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong>{q.title}</strong>
              <span style={{ marginLeft: 10, fontSize: '0.8rem', color: q.is_published ? '#28a745' : '#aaa' }}>
                {q.is_published ? 'Published' : 'Draft'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {isLecturer && !q.is_published && (
                <button onClick={() => publishQuiz(q.id)} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#28a745', color: '#fff', cursor: 'pointer' }}>
                  Publish
                </button>
              )}
              {(!isLecturer && q.is_published) && (
                <button onClick={() => openQuiz(q.id)} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#4f8ef7', color: '#fff', cursor: 'pointer' }}>
                  Take Quiz
                </button>
              )}
            </div>
          </li>
        ))}
        {quizzes.length === 0 && <p style={{ color: '#888', marginTop: 16 }}>No quizzes available yet.</p>}
      </ul>
    </div>
  );
}
