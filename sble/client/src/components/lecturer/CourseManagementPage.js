import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../config/api';

const cardStyle = {
  background: '#fff',
  borderRadius: 10,
  padding: 16,
  boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  border: '1px solid #e7ecf5'
};

const emptyForm = {
  title: '',
  description: ''
};

export default function CourseManagementPage() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm);

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

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (course) => {
    setEditingId(course.id);
    setForm({
      title: course.title || '',
      description: course.description || ''
    });
    setShowForm(true);
    setError('');
  };

  const saveCourse = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;

    setSaving(true);
    setError('');
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim()
      };

      if (editingId) {
        const res = await api.put(`/courses/${editingId}`, payload);
        setCourses((prev) => prev.map((course) => (course.id === editingId ? res.data : course)));
      } else {
        const res = await api.post('/courses', payload);
        setCourses((prev) => [res.data, ...prev]);
      }

      resetForm();
    } catch (err) {
      setError(err?.response?.data?.error || `Failed to ${editingId ? 'update' : 'create'} course`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ marginBottom: 6 }}>Course Management</h2>
          <p style={{ color: '#667085', margin: 0 }}>Manage your course list from one clean page.</p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (showForm && !editingId) {
              resetForm();
            } else {
              setForm(emptyForm);
              setEditingId(null);
              setShowForm(true);
            }
          }}
          style={primaryButtonStyle}
        >
          {showForm && !editingId ? 'Close Form' : 'Create Course'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={saveCourse} style={{ ...cardStyle, marginTop: 16, maxWidth: 620 }}>
          <h3 style={{ marginTop: 0 }}>{editingId ? 'Edit Course' : 'Create Course'}</h3>
          <input
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="Course title"
            required
            style={{ width: '100%', padding: '9px 10px', borderRadius: 6, border: '1px solid #ddd', marginBottom: 10 }}
          />
          <textarea
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Course description"
            rows={3}
            style={{ width: '100%', padding: '9px 10px', borderRadius: 6, border: '1px solid #ddd', resize: 'vertical' }}
          />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            <button type="submit" disabled={saving} style={primaryButtonStyle}>
              {saving ? 'Saving...' : editingId ? 'Update Course' : 'Create Course'}
            </button>
            <button type="button" onClick={resetForm} style={secondaryButtonStyle}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {error && <p style={{ color: '#c0392b', marginTop: 12 }}>{error}</p>}

      <div style={{ marginTop: 20 }}>
        <h3 style={{ marginBottom: 12 }}>Your Courses</h3>
        {loading && <p>Loading courses...</p>}
        {!loading && courses.length === 0 && <p style={{ color: '#777' }}>No courses found.</p>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
          {courses.map((course) => (
            <div key={course.id} style={cardStyle}>
              <strong style={{ fontSize: '1rem' }}>{course.title}</strong>
              <p style={{ color: '#666', fontSize: '0.9rem', marginTop: 8, minHeight: 42 }}>
                {course.description || 'No description provided.'}
              </p>
              <p style={{ color: '#999', fontSize: '0.8rem', marginTop: 8 }}>Course ID: {course.id}</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                <button type="button" onClick={() => handleEdit(course)} style={primaryButtonStyle}>
                  Edit Course
                </button>
                <Link to={`/lecturer/courses/${course.id}`} style={openCourseLinkStyle}>Open Course</Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const primaryButtonStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#4f8ef7',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  padding: '9px 12px',
  minHeight: 38,
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: '0.85rem'
};

const secondaryButtonStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#fff',
  color: '#344054',
  border: '1px solid #d0d5dd',
  borderRadius: 8,
  padding: '9px 12px',
  minHeight: 38,
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: '0.85rem'
};

const openCourseLinkStyle = {
  ...secondaryButtonStyle,
  textDecoration: 'none'
};
