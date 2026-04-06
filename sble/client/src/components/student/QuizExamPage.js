import React, { useEffect, useMemo, useState } from 'react';
import api from '../../config/api';
import { triggerBlobDownload } from '../../utils/fileTransfer';

const cardStyle = {
  background: '#fff',
  borderRadius: 8,
  padding: 16,
  boxShadow: '0 1px 4px rgba(0,0,0,0.08)'
};

export default function QuizExamPage({ courseId }) {
  const [quizzes, setQuizzes] = useState([]);
  const [exams, setExams] = useState([]);
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!courseId) return;
      setLoading(true);
      setMessage('');
      try {
        const [quizRes, examRes] = await Promise.all([
          api.get(`/quizzes/course/${courseId}`),
          api.get(`/exams/course/${courseId}`)
        ]);
        setQuizzes(Array.isArray(quizRes.data) ? quizRes.data : []);
        setExams(Array.isArray(examRes.data) ? examRes.data : []);
      } catch (err) {
        setMessage(err?.response?.data?.error || 'Failed to load quizzes and exams');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [courseId]);

  const publishedQuizzes = useMemo(() => quizzes.filter((q) => q.is_published), [quizzes]);

  const startQuiz = async (quizId) => {
    setMessage('');
    try {
      const res = await api.get(`/quizzes/${quizId}`);
      setActiveQuiz(res.data);
      setAnswers({});
    } catch (err) {
      setMessage(err?.response?.data?.error || 'Cannot open this quiz now');
    }
  };

  const submitQuiz = async () => {
    if (!activeQuiz) return;
    setMessage('');
    try {
      const res = await api.post(`/quizzes/${activeQuiz.id}/attempt`, { answers });
      const score = res?.data?.score;
      if (Number.isFinite(score)) {
        localStorage.setItem(`quizScore:${activeQuiz.id}`, String(score));
      }
      setMessage(Number.isFinite(score) ? `Quiz submitted. Score: ${score}` : 'Quiz submitted.');
      setActiveQuiz(null);
    } catch (err) {
      const payload = err?.response?.data;
      if (payload && Number.isFinite(payload.score)) {
        localStorage.setItem(`quizScore:${activeQuiz.id}`, String(payload.score));
      }
      setMessage(payload?.error || 'Failed to submit quiz');
      setActiveQuiz(null);
    }
  };

  const downloadExam = async (exam) => {
    setMessage('');
    try {
      const response = await api.get(`/exams/${exam.id}/download`, { responseType: 'blob' });
      triggerBlobDownload(response, `${exam.title || `exam-${exam.id}`}.pdf`);
      setMessage('Exam downloaded.');
    } catch (err) {
      setMessage(err?.response?.data?.error || 'Exam download unavailable right now');
    }
  };

  if (activeQuiz) {
    return (
      <div>
        <h2>{activeQuiz.title}</h2>
        <p style={{ color: '#888' }}>Time limit: {activeQuiz.time_limit_minutes} min</p>

        {activeQuiz.QuizQuestions?.map((q, i) => (
          <div key={q.id} style={{ ...cardStyle, marginTop: 10 }}>
            <p style={{ marginTop: 0, fontWeight: 600 }}>{i + 1}. {q.question_text}</p>

            {q.question_type === 'mcq' && q.options?.map((opt, idx) => (
              <label key={idx} style={{ display: 'block', marginTop: 6 }}>
                <input
                  type="radio"
                  name={`q-${q.id}`}
                  checked={answers[q.id] === opt}
                  onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                />
                {' '}{opt}
              </label>
            ))}

            {q.question_type === 'true_false' && ['True', 'False'].map((opt) => (
              <label key={opt} style={{ display: 'block', marginTop: 6 }}>
                <input
                  type="radio"
                  name={`q-${q.id}`}
                  checked={answers[q.id] === opt}
                  onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                />
                {' '}{opt}
              </label>
            ))}

            {q.question_type === 'short_answer' && (
              <input
                value={answers[q.id] || ''}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                placeholder="Your answer"
                style={{ width: '100%', marginTop: 8, padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd' }}
              />
            )}
          </div>
        ))}

        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button onClick={submitQuiz} style={{ background: '#4f8ef7', color: '#fff', border: 'none', borderRadius: 6, padding: '9px 14px', cursor: 'pointer' }}>
            Submit Quiz
          </button>
          <button onClick={() => setActiveQuiz(null)} style={{ background: '#fff', border: '1px solid #ddd', borderRadius: 6, padding: '9px 14px', cursor: 'pointer' }}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2>Quiz / Exam</h2>
      {message && <p style={{ color: message.toLowerCase().includes('failed') ? '#c0392b' : '#2c3e50' }}>{message}</p>}
      {loading && <p>Loading...</p>}

      <div style={{ marginTop: 12 }}>
        <h3>Quizzes</h3>
        {publishedQuizzes.length === 0 && !loading && <p style={{ color: '#777' }}>No published quizzes.</p>}
        <div style={{ display: 'grid', gap: 10 }}>
          {publishedQuizzes.map((quiz) => (
            <div key={quiz.id} style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong>{quiz.title}</strong>
                <p style={{ color: '#777', fontSize: '0.85rem', marginTop: 6 }}>Duration: {quiz.time_limit_minutes || quiz.duration_minutes || '-'} min</p>
              </div>
              <button onClick={() => startQuiz(quiz.id)} style={{ background: '#16a085', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 12px', cursor: 'pointer' }}>
                Start
              </button>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <h3>Exams</h3>
        {exams.length === 0 && !loading && <p style={{ color: '#777' }}>No exams.</p>}
        <div style={{ display: 'grid', gap: 10 }}>
          {exams.map((exam) => (
            <div key={exam.id} style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong>{exam.title}</strong>
                <p style={{ color: '#777', fontSize: '0.85rem', marginTop: 6 }}>{exam.is_released ? 'Released' : 'Locked'}</p>
              </div>
              <button onClick={() => downloadExam(exam)} style={{ background: '#4f8ef7', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 12px', cursor: 'pointer' }}>
                Download
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
