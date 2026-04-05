import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useKeycloak } from '@react-keycloak/web';
import useAuthSync from '../hooks/useAuthSync';
import api from '../config/api';

export default function Dashboard() {
  const { keycloak } = useKeycloak();
  useAuthSync();

  const name = keycloak.tokenParsed?.name || 'User';
  const isLecturer = keycloak.hasRealmRole('lecturer') || keycloak.hasRealmRole('admin');
  const [courses, setCourses] = useState([]);

  useEffect(() => {
    api.get('/courses').then(r => setCourses(r.data)).catch(() => {});
  }, []);

  return (
    <div>
      <h1>Welcome back, {name}</h1>
      <p style={{ color: '#888', marginTop: 6 }}>
        {isLecturer ? 'Manage your courses, upload materials, and track student progress.' : 'Access your courses, submit assignments, and join live sessions.'}
      </p>

      <div style={{ display: 'flex', gap: 16, marginTop: 28, flexWrap: 'wrap' }}>
        <StatCard label={isLecturer ? 'Courses Teaching' : 'Courses Enrolled'} value={courses.length} color="#4f8ef7" />
      </div>

      <h3 style={{ marginTop: 32, marginBottom: 16 }}>
        {isLecturer ? 'Your Courses' : 'My Courses'}
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px,1fr))', gap: 14 }}>
        {courses.map(c => (
          <Link key={c.id} to={`/courses/${c.id}`}
            style={{ background: '#fff', borderRadius: 8, padding: 18, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', display: 'block' }}>
            <h4 style={{ marginBottom: 6 }}>{c.title}</h4>
            <p style={{ color: '#aaa', fontSize: '0.85rem' }}>{c.description || 'No description'}</p>
          </Link>
        ))}
        {courses.length === 0 && (
          <p style={{ color: '#aaa' }}>
            {isLecturer ? 'No courses yet. ' : 'You are not enrolled in any courses yet. '}
            <Link to="/courses" style={{ color: '#4f8ef7' }}>Go to Courses</Link>
          </p>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={{ background: '#fff', borderRadius: 8, padding: '20px 28px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', borderLeft: `4px solid ${color}`, minWidth: 160 }}>
      <p style={{ color: '#888', fontSize: '0.85rem' }}>{label}</p>
      <p style={{ fontSize: '2rem', fontWeight: 700, color, marginTop: 4 }}>{value}</p>
    </div>
  );
}
