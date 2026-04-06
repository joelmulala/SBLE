import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useKeycloak } from '../auth/AuthProvider';
import api from '../config/api';

const cardStyle = {
  background: '#fff',
  borderRadius: 8,
  padding: 20,
  boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  border: '1px solid #eef2f7'
};

export default function Courses() {
  const { keycloak } = useKeycloak();
  const isLecturer = keycloak.hasRealmRole('lecturer') || keycloak.hasRealmRole('admin');
  const courseBasePath = isLecturer ? '/lecturer/courses' : '/student/courses';
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadCourses = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await api.get('/courses');
        setCourses(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        setError(err?.response?.data?.error || 'Failed to load courses.');
      } finally {
        setLoading(false);
      }
    };

    loadCourses();
  }, []);

  if (loading) return <p>Loading courses...</p>;

  return (
    <div>
      <h2>My Courses</h2>
      <p style={{ color: '#666', marginTop: 6 }}>Only courses you can access are shown here.</p>
      {error && <p style={{ color: '#c0392b', marginTop: 12 }}>{error}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px,1fr))', gap: 16, marginTop: 20 }}>
        {courses.map((course) => (
          <div key={course.id} style={cardStyle}>
            <h3 style={{ marginTop: 0 }}>{course.title}</h3>
            <p style={{ color: '#888', marginTop: 6, fontSize: '0.9rem' }}>{course.description || 'No description available.'}</p>
            <p style={{ color: '#555', marginTop: 8, fontSize: '0.9rem' }}>
              Lecturer: {course.lecturer?.full_name || 'Not assigned'}
            </p>
            <Link
              to={`${courseBasePath}/${course.id}`}
              style={{ display: 'inline-flex', marginTop: 12, textDecoration: 'none', background: '#4f8ef7', color: '#fff', borderRadius: 8, padding: '8px 12px', fontWeight: 600 }}
            >
              Open Course
            </Link>
          </div>
        ))}
        {courses.length === 0 && <p style={{ color: '#888' }}>No courses found.</p>}
      </div>
    </div>
  );
}
