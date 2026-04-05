import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../config/api';

export default function Courses() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/courses').then(r => setCourses(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading courses...</p>;

  return (
    <div>
      <h2>My Courses</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px,1fr))', gap: 16, marginTop: 20 }}>
        {courses.map(c => (
          <Link key={c.id} to={`/courses/${c.id}`} style={{ background: '#fff', borderRadius: 8, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', display: 'block' }}>
            <h3>{c.title}</h3>
            <p style={{ color: '#888', marginTop: 6, fontSize: '0.9rem' }}>{c.description}</p>
          </Link>
        ))}
        {courses.length === 0 && <p style={{ color: '#888' }}>No courses found.</p>}
      </div>
    </div>
  );
}
