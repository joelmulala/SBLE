import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../config/api';

const cardStyle = {
  background: '#fff',
  borderRadius: 10,
  padding: 16,
  boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  border: '1px solid #e7ecf5'
};

export default function LecturerAssignmentsPage() {
  const [assignments, setAssignments] = useState([]);
  const [courses, setCourses] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', due_date: '', course_id: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError('');
      try {
        const [assignmentsRes, coursesRes] = await Promise.all([
          api.get('/assignments'),
          api.get('/courses')
        ]);

        setAssignments(Array.isArray(assignmentsRes.data) ? assignmentsRes.data : []);
        setCourses(Array.isArray(coursesRes.data) ? coursesRes.data : []);
      } catch (err) {
        setAssignments([]);
        setCourses([]);
        setError(err?.response?.data?.error || 'Failed to load assignments');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const courseNameById = useMemo(() => Object.fromEntries(
    courses.map((course) => [String(course.id), course.title])
  ), [courses]);

  const createAssignment = async (e) => {
    e.preventDefault();

    if (!form.course_id) {
      setError('Please select a course.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const res = await api.post('/assignments', {
        title: form.title.trim(),
        description: form.description.trim(),
        due_date: form.due_date || null,
        course_id: form.course_id
      });

      setAssignments((prev) => [res.data, ...prev]);
      setForm({ title: '', description: '', due_date: '', course_id: '' });
      setShowForm(false);
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to create assignment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2>Assignments</h2>
          <p style={{ color: '#666', marginTop: 6 }}>Review assignment items across your lecturer-managed courses.</p>
        </div>
        <button type="button" onClick={() => setShowForm((prev) => !prev)} style={actionButtonStyle}>
          {showForm ? 'Close Form' : 'Add New'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={createAssignment} style={{ ...cardStyle, marginTop: 18, display: 'grid', gap: 10 }}>
          <select
            value={form.course_id}
            onChange={(e) => setForm((prev) => ({ ...prev, course_id: e.target.value }))}
            required
            style={inputStyle}
          >
            <option value="">Select course</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>{course.title}</option>
            ))}
          </select>
          <input
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="Assignment title"
            required
            style={inputStyle}
          />
          <textarea
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Description"
            rows={3}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
          <input
            type="datetime-local"
            value={form.due_date}
            onChange={(e) => setForm((prev) => ({ ...prev, due_date: e.target.value }))}
            style={inputStyle}
          />
          <button type="submit" disabled={saving} style={actionButtonStyle}>
            {saving ? 'Saving...' : 'Create Assignment'}
          </button>
        </form>
      )}

      {error && <p style={{ color: '#c0392b', marginTop: 12 }}>{error}</p>}
      {loading && <p style={{ marginTop: 12 }}>Loading assignments...</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))', gap: 16, marginTop: 18 }}>
        {assignments.map((assignment) => (
          <div key={assignment.id} style={cardStyle}>
            <strong>{assignment.title}</strong>
            <p style={{ color: '#666', fontSize: '0.88rem', marginTop: 6 }}>{assignment.description || 'No description provided.'}</p>
            <p style={{ color: '#555', fontSize: '0.85rem', marginTop: 8 }}>
              Course: {courseNameById[String(assignment.course_id)] || `Course #${assignment.course_id}`}
            </p>
            {assignment.due_date && (
              <p style={{ color: '#555', fontSize: '0.85rem', marginTop: 4 }}>
                Due: {formatDateTime(assignment.due_date)}
              </p>
            )}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
              <Link to={`/lecturer/courses/${assignment.course_id}/assignments`} style={primaryLinkStyle}>Open Assignment</Link>
              <Link to={`/lecturer/courses/${assignment.course_id}/materials`} style={secondaryLinkStyle}>Open Materials</Link>
            </div>
          </div>
        ))}
      </div>

      {!loading && assignments.length === 0 && <p style={{ color: '#888', marginTop: 14 }}>No assignments available.</p>}
    </div>
  );
}

function formatDateTime(value) {
  if (!value) return 'Not set';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'Not set' : parsed.toLocaleString();
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
