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
  const [questionCounts, setQuestionCounts] = useState({});
  const [showCoursePicker, setShowCoursePicker] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [loading, setLoading] = useState(true);
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

        const quizRows = Array.isArray(quizzesRes.data) ? quizzesRes.data : [];
        const courseRows = Array.isArray(coursesRes.data) ? coursesRes.data : [];

        setQuizzes(quizRows);
        setCourses(courseRows);

        const countEntries = await Promise.all(quizRows.map(async (quiz) => {
          try {
            const res = await api.get(`/quizzes/${quiz.id}/questions`);
            return [quiz.id, Array.isArray(res.data) ? res.data.length : 0];
          } catch (_) {
            return [quiz.id, Number(quiz.question_count) || 0];
          }
        }));

        setQuestionCounts(Object.fromEntries(countEntries));
      } catch (err) {
        setQuizzes([]);
        setCourses([]);
        setQuestionCounts({});
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

  const openQuizBuilder = () => {
    if (!selectedCourseId) {
      setError('Please select a course first.');
      return;
    }

    setError('');
    navigate(`/lecturer/courses/${selectedCourseId}/quizzes?create=1`);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ marginBottom: 6 }}>Quizzes</h2>
          <p style={{ color: '#667085', margin: 0 }}>Browse quiz summaries and open each quiz for full details and question management.</p>
        </div>
        <button type="button" onClick={() => setShowCoursePicker((prev) => !prev)} style={actionButtonStyle}>
          {showCoursePicker ? 'Close' : 'Create Quiz'}
        </button>
      </div>

      {showCoursePicker && (
        <div style={{ ...cardStyle, marginTop: 18, maxWidth: 520 }}>
          <h3 style={{ marginTop: 0 }}>Open Quiz Builder</h3>
          <p style={{ color: '#667085', marginTop: 6 }}>
            Select a course to create a quiz. At least one question is required before saving.
          </p>
          <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              style={inputStyle}
            >
              <option value="">Select course</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>{course.title}</option>
              ))}
            </select>
            <button type="button" onClick={openQuizBuilder} style={actionButtonStyle}>
              Open Quiz Details
            </button>
          </div>
        </div>
      )}

      {error && <p style={{ color: '#c0392b', marginTop: 12 }}>{error}</p>}
      {loading && <p style={{ marginTop: 12 }}>Loading quizzes...</p>}

      <div style={{ ...cardStyle, marginTop: 18, padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={headerCellStyle}>Quiz</th>
              <th style={headerCellStyle}>Course</th>
              <th style={headerCellStyle}>Status</th>
              <th style={headerCellStyle}>Questions</th>
              <th style={headerCellStyle}>Action</th>
            </tr>
          </thead>
          <tbody>
            {quizzes.map((quiz) => (
              <tr key={quiz.id}>
                <td style={cellStyle}>
                  <div style={{ fontWeight: 600, color: '#111827' }}>{quiz.title}</div>
                </td>
                <td style={cellStyle}>{courseNameById[String(quiz.course_id)] || `Course #${quiz.course_id}`}</td>
                <td style={cellStyle}>
                  <span style={{ color: quiz.is_published ? '#16a34a' : '#b54708', fontWeight: 600 }}>
                    {quiz.is_published ? 'Published' : 'Draft'}
                  </span>
                </td>
                <td style={cellStyle}>{questionCounts[quiz.id] ?? Number(quiz.question_count) ?? 0}</td>
                <td style={cellStyle}>
                  <Link to={`/lecturer/courses/${quiz.course_id}/quizzes?draftQuizId=${quiz.id}`} style={primaryLinkStyle}>
                    Open Details
                  </Link>
                </td>
              </tr>
            ))}
            {!loading && quizzes.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: '16px 12px', color: '#888' }}>No quizzes available.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
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

const headerCellStyle = {
  textAlign: 'left',
  padding: '12px 14px',
  borderBottom: '1px solid #e5e7eb',
  color: '#475467',
  fontSize: '0.85rem',
  background: '#f8fafc'
};

const cellStyle = {
  padding: '12px 14px',
  borderBottom: '1px solid #f2f4f7',
  color: '#344054',
  fontSize: '0.92rem'
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
