import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../config/api';
import { buildFileUploadFormData, triggerBlobDownload } from '../../utils/fileTransfer';

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
  const [attachment, setAttachment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
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

    if (!form.title.trim()) {
      setError('Please enter an assignment title.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payload = buildFileUploadFormData({
        file: attachment,
        courseId: form.course_id,
        title: form.title,
        fields: {
          description: form.description.trim(),
          due_date: form.due_date || null
        }
      });

      const res = await api.post('/assignments', payload);

      setAssignments((prev) => [res.data, ...prev]);
      setForm({ title: '', description: '', due_date: '', course_id: '' });
      setAttachment(null);
      setShowForm(false);
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to create assignment');
    } finally {
      setSaving(false);
    }
  };

  const downloadAssignmentFile = async (assignmentId, fileName) => {
    setDownloadingId(assignmentId);
    setError('');

    try {
      const response = await api.get(`/assignments/${assignmentId}/download`, { responseType: 'blob' });
      triggerBlobDownload(response, fileName || `assignment-${assignmentId}`);
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to download assignment file');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ marginBottom: 6 }}>Assignments</h2>
          <p style={{ color: '#667085', margin: 0 }}>View assignment summaries and open the course-specific page for submissions.</p>
        </div>
        <button type="button" onClick={() => setShowForm((prev) => !prev)} style={actionButtonStyle}>
          {showForm ? 'Close Form' : 'Create Assignment'}
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
          <div style={{ display: 'grid', gap: 6 }}>
            <input
              type="file"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              onChange={(e) => setAttachment(e.target.files?.[0] || null)}
            />
            <span style={{ color: '#667085', fontSize: '0.82rem' }}>
              Optional: upload the assignment file so students can download it.
            </span>
          </div>
          <button type="submit" disabled={saving} style={actionButtonStyle}>
            {saving ? 'Saving...' : attachment ? 'Create & Upload Assignment' : 'Create Assignment'}
          </button>
        </form>
      )}

      {error && <p style={{ color: '#c0392b', marginTop: 12 }}>{error}</p>}
      {loading && <p style={{ marginTop: 12 }}>Loading assignments...</p>}

      <div style={{ ...cardStyle, marginTop: 18, padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={headerCellStyle}>Title</th>
              <th style={headerCellStyle}>Course</th>
              <th style={headerCellStyle}>Due Date</th>
              <th style={headerCellStyle}>Attachment</th>
              <th style={headerCellStyle}>Action</th>
            </tr>
          </thead>
          <tbody>
            {assignments.map((assignment) => (
              <tr key={assignment.id}>
                <td style={cellStyle}>
                  <div style={{ fontWeight: 600, color: '#111827' }}>{assignment.title}</div>
                </td>
                <td style={cellStyle}>{courseNameById[String(assignment.course_id)] || `Course #${assignment.course_id}`}</td>
                <td style={cellStyle}>{formatDateTime(assignment.due_date)}</td>
                <td style={cellStyle}>
                  {assignment.file_name ? (
                    <button
                      type="button"
                      onClick={() => downloadAssignmentFile(assignment.id, assignment.file_name)}
                      disabled={downloadingId === assignment.id}
                      style={{ ...secondaryLinkStyle, opacity: downloadingId === assignment.id ? 0.7 : 1 }}
                    >
                      {downloadingId === assignment.id ? 'Downloading...' : 'Download File'}
                    </button>
                  ) : (
                    <span style={{ color: '#98a2b3' }}>No file</span>
                  )}
                </td>
                <td style={cellStyle}>
                  <Link to={`/lecturer/courses/${assignment.course_id}/assignments`} style={primaryLinkStyle}>
                    Open
                  </Link>
                </td>
              </tr>
            ))}
            {!loading && assignments.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: '16px 12px', color: '#888' }}>No assignments available.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
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

const headerCellStyle = {
  textAlign: 'left',
  padding: '12px 14px',
  borderBottom: '1px solid #e5e7eb',
  color: '#475467',
  fontSize: '0.85rem',
  background: '#f8fafc'
};

const cellStyle = {
  padding: '12px 14px',
  borderBottom: '1px solid #f2f4f7',
  color: '#344054',
  fontSize: '0.92rem'
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
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#eef4ff',
  color: '#175cd3',
  borderRadius: 8,
  padding: '8px 12px',
  minHeight: 38,
  fontWeight: 600,
  fontSize: '0.85rem',
  border: '1px solid #c7d7fe',
  cursor: 'pointer'
};
