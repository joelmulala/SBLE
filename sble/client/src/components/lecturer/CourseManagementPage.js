import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../config/api';

const cardStyle = {
  background: '#fff',
  borderRadius: 8,
  padding: 16,
  boxShadow: '0 1px 4px rgba(0,0,0,0.08)'
};

export default function CourseManagementPage() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ title: '', description: '' });

  const loadCourses = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/courses');
      setCourses(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to load courses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCourses();
  }, []);

  const createCourse = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;

    setSaving(true);
    setError('');
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim()
      };
      const res = await api.post('/courses', payload);
      setCourses((prev) => [res.data, ...prev]);
      setForm({ title: '', description: '' });
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to create course');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h2>Course Management</h2>

      <form onSubmit={createCourse} style={{ ...cardStyle, marginTop: 14, maxWidth: 560 }}>
        <h3 style={{ marginTop: 0 }}>Create Course</h3>
        <input
          value={form.title}
          onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
          placeholder="Course title"
          required
          style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', marginBottom: 10 }}
        />
        <textarea
          value={form.description}
          onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
          placeholder="Course description"
          rows={3}
          style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', resize: 'vertical' }}
        />
        <button
          type="submit"
          disabled={saving}
          style={{ marginTop: 10, background: '#4f8ef7', color: '#fff', border: 'none', borderRadius: 6, padding: '9px 14px', cursor: 'pointer' }}
        >
          {saving ? 'Saving...' : 'Create'}
        </button>
      </form>

      {error && <p style={{ color: '#c0392b', marginTop: 12 }}>{error}</p>}

      <div style={{ marginTop: 18 }}>
        <h3>Your Courses</h3>
        {loading && <p>Loading courses...</p>}
        {!loading && courses.length === 0 && <p style={{ color: '#777' }}>No courses found.</p>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
          {courses.map((course) => (
            <div key={course.id} style={cardStyle}>
              <strong>{course.title}</strong>
              <p style={{ color: '#666', fontSize: '0.9rem', marginTop: 6 }}>
                {course.description || 'No description'}
              </p>
              <p style={{ color: '#999', fontSize: '0.8rem', marginTop: 8 }}>Course ID: {course.id}</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                <Link to={`/lecturer/courses/${course.id}/enrollment`} style={primaryLinkStyle}>Manage Course</Link>
                <Link to={`/lecturer/courses/${course.id}/assignments`} style={secondaryLinkStyle}>View Assignments</Link>
                <Link to={`/lecturer/courses/${course.id}/materials`} style={secondaryLinkStyle}>Open Materials</Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

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
