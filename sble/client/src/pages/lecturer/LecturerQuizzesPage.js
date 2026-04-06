import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../config/api';

const cardStyle = {
  background: '#fff',
  borderRadius: 10,
  padding: 16,
  boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  border: '1px solid #e7ecf5'
};

export default function LecturerQuizzesPage() {
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState([]);
  const [courses, setCourses] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ course_id: '', title: '', time_limit_minutes: 30, scheduled_at: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError('');
      try {
        const [quizzesRes, coursesRes] = await Promise.all([
          api.get('/quizzes'),
          api.get('/courses')
        ]);

        setQuizzes(Array.isArray(quizzesRes.data) ? quizzesRes.data : []);
        setCourses(Array.isArray(coursesRes.data) ? coursesRes.data : []);
      } catch (err) {
        setQuizzes([]);
        setCourses([]);
        setError(err?.response?.data?.error || 'Failed to load quizzes');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const courseNameById = useMemo(() => Object.fromEntries(
    courses.map((course) => [String(course.id), course.title])
  ), [courses]);

  const createQuiz = async (e) => {
    e.preventDefault();

    if (!form.course_id) {
      setError('Please select a course.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const res = await api.post('/quizzes', {
        course_id: form.course_id,
        title: form.title.trim(),
        time_limit_minutes: Number(form.time_limit_minutes) || 30,
        scheduled_at: form.scheduled_at || null,
        questions: []
      });

      setQuizzes((prev) => [res.data, ...prev]);
      setForm({ course_id: '', title: '', time_limit_minutes: 30, scheduled_at: '' });
      setShowForm(false);
      navigate(`/lecturer/courses/${res.data.course_id}/quizzes?draftQuizId=${res.data.id}`);
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to create quiz');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2>Quizzes</h2>
          <p style={{ color: '#666', marginTop: 6 }}>Review quiz activity across your lecturer-managed courses.</p>
        </div>
        <button type="button" onClick={() => setShowForm((prev) => !prev)} style={actionButtonStyle}>
          {showForm ? 'Close Form' : 'Add New'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={createQuiz} style={{ ...cardStyle, marginTop: 18, display: 'grid', gap: 10 }}>
          <select
            value={form.course_id}
            onChange={(e) => setForm((prev) => ({ ...prev, course_id: e.target.value }))}
            required
            style={inputStyle}
          >
            <option value="">Select course</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>{course.title}</option>
            ))}
          </select>
          <input
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="Quiz title"
            required
            style={inputStyle}
          />
          <input
            type="datetime-local"
            value={form.scheduled_at}
            onChange={(e) => setForm((prev) => ({ ...prev, scheduled_at: e.target.value }))}
            style={inputStyle}
          />
          <input
            type="number"
            min="1"
            value={form.time_limit_minutes}
            onChange={(e) => setForm((prev) => ({ ...prev, time_limit_minutes: e.target.value }))}
            placeholder="Time limit in minutes"
            style={inputStyle}
          />
          <button type="submit" disabled={saving} style={actionButtonStyle}>
            {saving ? 'Saving...' : 'Create Quiz'}
          </button>
        </form>
      )}

      {error && <p style={{ color: '#c0392b', marginTop: 12 }}>{error}</p>}
      {loading && <p style={{ marginTop: 12 }}>Loading quizzes...</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))', gap: 16, marginTop: 18 }}>
        {quizzes.map((quiz) => (
          <div key={quiz.id} style={cardStyle}>
            <strong>{quiz.title}</strong>
            <p style={{ color: '#666', fontSize: '0.88rem', marginTop: 6 }}>
              Course: {courseNameById[String(quiz.course_id)] || `Course #${quiz.course_id}`}
            </p>
            <p style={{ color: '#555', fontSize: '0.85rem', marginTop: 8 }}>
              Status: {quiz.is_published ? 'Published' : 'Draft'}
            </p>
            <p style={{ color: '#555', fontSize: '0.85rem', marginTop: 4 }}>
              Window: {formatDateTime(quiz.start_time || quiz.created_at)} → {formatDateTime(quiz.end_time)}
            </p>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
              <Link to={`/lecturer/courses/${quiz.course_id}/quizzes?draftQuizId=${quiz.id}`} style={primaryLinkStyle}>
                Manage Questions
              </Link>
              <Link to={`/lecturer/courses/${quiz.course_id}/assignments`} style={secondaryLinkStyle}>View Assignments</Link>
            </div>
          </div>
        ))}
      </div>

      {!loading && quizzes.length === 0 && <p style={{ color: '#888', marginTop: 14 }}>No quizzes available.</p>}
    </div>
  );
}

function formatDateTime(value) {
  if (!value) return 'Not set';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'Not set' : parsed.toLocaleString();
}

const inputStyle = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 6,
  border: '1px solid #ddd'
};

const actionButtonStyle = {
  background: '#4f8ef7',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  padding: '10px 14px',
  cursor: 'pointer',
  fontWeight: 600
};

const primaryLinkStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  textDecoration: 'none',
  background: '#4f8ef7',
  color: '#fff',
  borderRadius: 8,
  padding: '8px 12px',
  minHeight: 38,
  fontWeight: 600,
  fontSize: '0.85rem'
};

const secondaryLinkStyle = {
  ...primaryLinkStyle,
  background: '#fff',
  color: '#344054',
  border: '1px solid #d0d5dd'
};
