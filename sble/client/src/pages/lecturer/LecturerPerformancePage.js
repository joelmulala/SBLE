import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../config/api';
import PerformanceDashboard from '../../components/lecturer/PerformanceDashboard';

const cardStyle = {
  background: '#fff',
  borderRadius: 10,
  padding: 16,
  boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  border: '1px solid #e7ecf5'
};

export default function LecturerPerformancePage() {
  const navigate = useNavigate();
  const { courseId } = useParams();
  const isDetailRoute = Boolean(courseId);
  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState(courseId || '');
  const [performanceRows, setPerformanceRows] = useState([]);
  const [assessmentMetrics, setAssessmentMetrics] = useState(null);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [loading, setLoading] = useState(Boolean(courseId));
  const [error, setError] = useState('');

  useEffect(() => {
    setSelectedCourseId(courseId || '');
  }, [courseId]);

  useEffect(() => {
    const loadCourses = async () => {
      setCoursesLoading(true);
      try {
        const res = await api.get('/courses');
        setCourses(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        setCourses([]);
      } finally {
        setCoursesLoading(false);
      }
    };

    loadCourses();
  }, []);

  useEffect(() => {
    const loadPerformance = async () => {
      if (!courseId) {
        setPerformanceRows([]);
        setAssessmentMetrics(null);
        setError('');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');
      try {
        const res = await api.get(`/courses/${courseId}/performance`);
        setPerformanceRows(Array.isArray(res.data?.performance) ? res.data.performance : []);
        setAssessmentMetrics(res.data?.assessment_metrics || null);
      } catch (err) {
        setPerformanceRows([]);
        setAssessmentMetrics(null);
        setError(err?.response?.data?.error || 'Failed to load performance data');
      } finally {
        setLoading(false);
      }
    };

    loadPerformance();
  }, [courseId]);

  const summary = useMemo(() => {
    return performanceRows.reduce((acc, row) => {
      const category = row?.category;
      if (acc[category] !== undefined) acc[category] += 1;
      return acc;
    }, { Green: 0, Orange: 0, Red: 0 });
  }, [performanceRows]);

  const handleCourseChange = (event) => {
    const nextCourseId = event.target.value;
    setSelectedCourseId(nextCourseId);

    if (!nextCourseId) {
      navigate('/lecturer/performance');
      return;
    }

    navigate(`/lecturer/courses/${nextCourseId}/performance`);
  };

  return (
    <div>
      <h2>Performance Analytics</h2>
      <p style={{ color: '#666', marginTop: 6 }}>
        {isDetailRoute ? 'Performance analytics for this course.' : 'Please select a course'}
      </p>

      <div style={{ ...cardStyle, marginTop: 18 }}>
        <label htmlFor="performance-course-selector" style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>
          Select Course
        </label>
        <select
          id="performance-course-selector"
          value={selectedCourseId}
          onChange={handleCourseChange}
          style={{ width: '100%', maxWidth: 360, padding: '10px 12px', borderRadius: 8, border: '1px solid #d0d5dd', background: '#fff' }}
        >
          <option value="">Please select a course</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>{course.title}</option>
          ))}
        </select>
        {coursesLoading && <p style={{ marginTop: 10, color: '#666' }}>Loading courses...</p>}
      </div>

      {!isDetailRoute && !coursesLoading && (
        <div style={{ ...cardStyle, marginTop: 18 }}>
          <p style={{ margin: 0, color: '#555' }}>Please select a course</p>
        </div>
      )}

      {error && <p style={{ color: '#c0392b', marginTop: 12 }}>{error}</p>}
      {isDetailRoute && loading && <p style={{ marginTop: 12 }}>Loading performance analytics...</p>}

      {!loading && isDetailRoute && !error && (
        <>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 18 }}>
            <div style={cardStyle}><strong>Students</strong><p style={{ margin: '6px 0 0', color: '#555' }}>{performanceRows.length}</p></div>
            <div style={cardStyle}><strong>Green</strong><p style={{ margin: '6px 0 0', color: '#2ecc71' }}>{summary.Green}</p></div>
            <div style={cardStyle}><strong>Orange</strong><p style={{ margin: '6px 0 0', color: '#f39c12' }}>{summary.Orange}</p></div>
            <div style={cardStyle}><strong>Red</strong><p style={{ margin: '6px 0 0', color: '#e74c3c' }}>{summary.Red}</p></div>
          </div>

          <div style={{ marginTop: 20 }}>
            <PerformanceDashboard rows={performanceRows} loading={loading} error={error} assessmentMetrics={assessmentMetrics} />
          </div>
        </>
      )}

      {!loading && isDetailRoute && !error && performanceRows.length === 0 && (
        <div style={{ ...cardStyle, marginTop: 18 }}>
          <p style={{ margin: 0, color: '#777' }}>No performance data available</p>
        </div>
      )}
    </div>
  );
}
