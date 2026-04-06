import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../config/api';

export default function StudentQuizzesPage() {
  const [courses, setCourses] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError('');
      try {
        const [coursesRes, quizzesRes] = await Promise.all([
          api.get('/courses'),
          api.get('/quizzes')
        ]);

        setCourses(Array.isArray(coursesRes.data) ? coursesRes.data : []);
        setQuizzes(Array.isArray(quizzesRes.data) ? quizzesRes.data : []);
      } catch (err) {
        setCourses([]);
        setQuizzes([]);
        setError(err?.response?.data?.error || 'Failed to load quizzes.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const groupedQuizzes = useMemo(() => {
    const visibleCourseIds = new Set(courses.map((course) => String(course.id)));
    return courses
      .map((course) => ({
        course,
        items: quizzes.filter((item) => visibleCourseIds.has(String(item.course_id)) && String(item.course_id) === String(course.id))
      }))
      .filter((entry) => entry.items.length > 0);
  }, [courses, quizzes]);

  if (loading) return <p>Loading quizzes...</p>;

  return (
    <div>
      <h2>Quizzes</h2>
      <p style={{ color: '#666', marginTop: 6 }}>Quizzes from all your enrolled courses.</p>
      {error && <p style={{ color: '#c0392b', marginTop: 12 }}>{error}</p>}

      <div style={{ display: 'grid', gap: 14, marginTop: 18 }}>
        {groupedQuizzes.map(({ course, items }) => (
          <section key={course.id} style={sectionStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0 }}>{course.title}</h3>
              <Link to={`/student/courses/${course.id}/quizzes`} style={linkButtonStyle}>Open Course Quizzes</Link>
            </div>

            <ul style={{ listStyle: 'none', padding: 0, marginTop: 12, display: 'grid', gap: 10 }}>
              {items.map((quiz) => (
                <li key={quiz.id} style={itemStyle}>
                  <strong>{quiz.title}</strong>
                  <div style={{ color: getQuizStatus(quiz).color, fontSize: '0.88rem', marginTop: 6, fontWeight: 600 }}>
                    {getQuizStatus(quiz).label}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}

        {!error && groupedQuizzes.length === 0 && (
          <p style={{ color: '#888' }}>No quizzes found in your enrolled courses.</p>
        )}
      </div>
    </div>
  );
}

function getQuizStatus(quiz) {
  if (quiz?.myAttempt?.submitted_at) {
    return {
      label: Number.isFinite(Number(quiz.myAttempt.score)) ? `Attempt used • Score ${Number(quiz.myAttempt.score)}` : 'Attempt used',
      color: '#16a34a'
    };
  }

  const now = Date.now();
  const startTime = quiz?.start_time ? new Date(quiz.start_time).getTime() : null;
  const endTime = quiz?.end_time ? new Date(quiz.end_time).getTime() : null;

  if (startTime && now < startTime) return { label: `Starts ${new Date(startTime).toLocaleString()}`, color: '#b54708' };
  if (endTime && now >= endTime) return { label: 'Closed', color: '#667085' };
  return { label: 'Available', color: '#2563eb' };
}

const sectionStyle = {
  background: '#fff',
  borderRadius: 8,
  padding: 16,
  boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  border: '1px solid #eef2f7'
};

const itemStyle = {
  padding: '10px 12px',
  borderRadius: 8,
  background: '#f8fafc',
  border: '1px solid #eef2f7'
};

const linkButtonStyle = {
  display: 'inline-flex',
  textDecoration: 'none',
  background: '#4f8ef7',
  color: '#fff',
  borderRadius: 8,
  padding: '8px 12px',
  fontWeight: 600
};