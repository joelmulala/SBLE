import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../config/api';
import { buildFileUploadFormData } from '../../utils/fileTransfer';

const cardStyle = {
  background: '#fff',
  borderRadius: 10,
  padding: 16,
  boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  border: '1px solid #e7ecf5'
};

export default function LecturerExamsPage() {
  const [exams, setExams] = useState([]);
  const [courses, setCourses] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ course_id: '', title: '', scheduled_at: '', duration_minutes: 120 });
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError('');
      try {
        const [coursesRes, examsRes] = await Promise.all([
          api.get('/courses'),
          api.get('/exams')
        ]);

        const courseList = Array.isArray(coursesRes.data) ? coursesRes.data : [];
        setCourses(courseList);
        setExams(Array.isArray(examsRes.data) ? examsRes.data : []);
      } catch (err) {
        setCourses([]);
        setExams([]);
        setError(err?.response?.data?.error || 'Failed to load exams');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const courseNameById = useMemo(() => Object.fromEntries(
    courses.map((course) => [String(course.id), course.title])
  ), [courses]);

  const uploadExam = async (e) => {
    e.preventDefault();

    if (!form.course_id) {
      setError('Please select a course.');
      return;
    }

    if (!file) {
      setError('Please choose an exam file.');
      return;
    }

    setUploading(true);
    setError('');
    try {
      const fd = buildFileUploadFormData({
        file,
        courseId: form.course_id,
        title: form.title.trim(),
        fields: {
          scheduled_at: form.scheduled_at,
          duration_minutes: form.duration_minutes
        }
      });

      const res = await api.post('/exams/upload', fd);
      setExams((prev) => [res.data, ...prev]);
      setForm({ course_id: '', title: '', scheduled_at: '', duration_minutes: 120 });
      setFile(null);
      setShowForm(false);
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to upload exam');
    } finally {
      setUploading(false);
    }
  };

  const releaseExam = async (examId) => {
    try {
      const res = await api.patch(`/exams/${examId}/release`);
      setExams((prev) => prev.map((exam) => (exam.id === examId ? res.data : exam)));
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to release exam');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2>Exams</h2>
          <p style={{ color: '#666', marginTop: 6 }}>Manage exam uploads, release windows, and downloads per course.</p>
        </div>
        <button type="button" onClick={() => setShowForm((prev) => !prev)} style={actionButtonStyle}>
          {showForm ? 'Close Form' : 'Add New'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={uploadExam} style={{ ...cardStyle, marginTop: 18, display: 'grid', gap: 10 }}>
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
            placeholder="Exam title"
            required
            style={inputStyle}
          />
          <input
            type="datetime-local"
            value={form.scheduled_at}
            onChange={(e) => setForm((prev) => ({ ...prev, scheduled_at: e.target.value }))}
            style={inputStyle}
          />
          <input
            type="number"
            min="1"
            value={form.duration_minutes}
            onChange={(e) => setForm((prev) => ({ ...prev, duration_minutes: e.target.value }))}
            placeholder="Duration in minutes"
            style={inputStyle}
          />
          <input type="file" accept=".pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} required />
          <button type="submit" disabled={uploading} style={actionButtonStyle}>
            {uploading ? 'Uploading...' : 'Upload Exam'}
          </button>
        </form>
      )}

      {error && <p style={{ color: '#c0392b', marginTop: 12 }}>{error}</p>}
      {loading && <p style={{ marginTop: 12 }}>Loading exams...</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))', gap: 16, marginTop: 18 }}>
        {exams.map((exam) => (
          <div key={exam.id} style={cardStyle}>
            <strong>{exam.title}</strong>
            <p style={{ color: '#666', fontSize: '0.88rem', marginTop: 6 }}>
              Course: {courseNameById[String(exam.course_id)] || `Course #${exam.course_id}`}
            </p>
            <p style={{ color: '#555', fontSize: '0.85rem', marginTop: 8 }}>
              Window: {formatDateTime(exam.start_time || exam.scheduled_at)} → {formatDateTime(exam.end_time)}
            </p>
            <p style={{ color: exam.is_released ? '#28a745' : '#e67e22', fontSize: '0.85rem', marginTop: 4, fontWeight: 600 }}>
              {exam.is_released ? 'Released' : 'Locked'}
            </p>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
              <Link to={`/lecturer/courses/${exam.course_id}/exams`} style={primaryLinkStyle}>Manage Exam</Link>
              {!exam.is_released && (
                <button type="button" onClick={() => releaseExam(exam.id)} style={secondaryButtonStyle}>Release</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {!loading && exams.length === 0 && <p style={{ color: '#888', marginTop: 14 }}>No exams available.</p>}
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

const secondaryButtonStyle = {
  background: '#fff',
  color: '#344054',
  border: '1px solid #d0d5dd',
  borderRadius: 8,
  padding: '8px 12px',
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: '0.85rem'
};
