import React, { useEffect, useState } from 'react';
import api from '../../config/api';
import CourseLearningHome from '../courseModules/CourseLearningHome';

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

  if (loading) {
    return (
      <div className="app-page">
        <div className="app-container">
          <p className="app-meta">Loading course...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-page">
        <div className="app-container">
          <p style={{ color: '#c0392b' }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-page">
      <div className="app-container">
        <CourseLearningHome courseId={courseId} course={course} isLecturer={false} />
      </div>
    </div>
  );
}

function resolveCourseAccessMessage(err, fallback) {
  const status = err?.response?.status;
  if (status === 403) return 'Access denied: you are not enrolled in this course.';
  if (status === 404) return 'This course does not exist or is no longer available.';
  return err?.response?.data?.error || fallback;
}
