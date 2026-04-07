import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../config/api';

const infoCardStyle = {
  background: '#fff',
  borderRadius: 8,
  padding: 18,
  boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  border: '1px solid #eef2f7'
};

export default function CourseViewPage({ courseId }) {
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadCourseData = async () => {
      if (!courseId) {
        setError('Invalid course selected.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');
      try {
        const coursesRes = await api.get('/courses');
        const visibleCourses = Array.isArray(coursesRes.data) ? coursesRes.data : [];
        const activeCourse = visibleCourses.find((item) => String(item.id) === String(courseId));

        if (!activeCourse) {
          setCourse(null);
          setError('Access denied: you are not enrolled in this course or the course does not exist.');
          return;
        }

        setCourse(activeCourse);
      } catch (err) {
        setError(resolveCourseAccessMessage(err, 'Failed to load course view.'));
      } finally {
        setLoading(false);
      }
    };

    loadCourseData();
  }, [courseId]);

  if (loading) return <p>Loading course...</p>;

  return (
    <div>
      <h2>{course?.title || `Course #${courseId}`}</h2>
      {error && <p style={{ color: '#c0392b', marginTop: 10 }}>{error}</p>}

      {!error && (
        <>
          <div style={infoCardStyle}>
            <p style={{ color: '#666', marginTop: 0 }}>{course?.description || 'No description available.'}</p>
            <p style={{ color: '#888', marginTop: 8, marginBottom: 0 }}>
              Lecturer: {course?.lecturer?.full_name || 'Not assigned'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
            <Link to={`/student/courses/${courseId}/materials`} style={linkButtonStyle}>View Materials</Link>
            <Link to={`/student/courses/${courseId}/assignments`} style={linkButtonStyle}>View Assignments</Link>
            <Link to={`/student/courses/${courseId}/quizzes`} style={linkButtonStyle}>Take Quiz</Link>
            <Link to={`/student/courses/${courseId}/exams`} style={linkButtonStyle}>View Exams</Link>
          </div>
        </>
      )}
    </div>
  );
}

function resolveCourseAccessMessage(err, fallback) {
  const status = err?.response?.status;
  if (status === 403) return 'Access denied: you are not enrolled in this course.';
  if (status === 404) return 'This course does not exist or is no longer available.';
  return err?.response?.data?.error || fallback;
}

const linkButtonStyle = {
  display: 'inline-flex',
  textDecoration: 'none',
  background: '#4f8ef7',
  color: '#fff',
  borderRadius: 8,
  padding: '8px 12px',
  fontWeight: 600
};
