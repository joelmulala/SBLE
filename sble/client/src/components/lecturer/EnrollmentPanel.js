import React, { useState } from 'react';
import api from '../../config/api';

const panelStyle = {
  background: '#fff',
  borderRadius: 8,
  padding: 16,
  boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  border: '1px solid #e7ecf5'
};

const inputStyle = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 6,
  border: '1px solid #ddd'
};

export default function EnrollmentPanel({ courseId, onEnrollmentChange }) {
  const [studentId, setStudentId] = useState('');
  const [csvFile, setCsvFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [result, setResult] = useState(null);

  if (!courseId) {
    return null;
  }

  const enrollSingle = async (e) => {
    e.preventDefault();
    if (!studentId.trim()) return;

    setBusy(true);
    setMessage('');
    setResult(null);
    try {
      const res = await api.post(`/courses/${courseId}/enroll`, { student_id: studentId.trim() });
      setMessage(`Enrolled: ${res.data?.student?.full_name || res.data?.student?.student_id || studentId.trim()}`);
      setStudentId('');
      await onEnrollmentChange?.();
    } catch (err) {
      setMessage(err?.response?.data?.error || 'Failed to enroll student');
    } finally {
      setBusy(false);
    }
  };

  const enrollByCsv = async (e) => {
    e.preventDefault();
    if (!csvFile) return;

    setBusy(true);
    setMessage('');
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('file', csvFile);
      const res = await api.post(`/courses/${courseId}/enroll/csv`, formData);
      setResult(res.data);
      setMessage('CSV enrollment processed');
      setCsvFile(null);
      await onEnrollmentChange?.();
    } catch (err) {
      setMessage(err?.response?.data?.error || 'Failed to process CSV');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginTop: 16 }}>
        <form onSubmit={enrollSingle} style={panelStyle}>
          <strong>Add Student</strong>
          <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
            <input
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              placeholder="Student ID"
              required
              style={inputStyle}
            />
            <button type="submit" disabled={busy} style={primaryButtonStyle}>
              {busy ? 'Saving...' : 'Add Student'}
            </button>
          </div>
        </form>

        <form onSubmit={enrollByCsv} style={panelStyle}>
          <strong>Upload CSV</strong>
          <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
            <input type="file" accept=".csv" onChange={(e) => setCsvFile(e.target.files?.[0] || null)} required />
            <button type="submit" disabled={busy || !csvFile} style={secondaryButtonStyle}>
              {busy ? 'Uploading...' : 'Upload CSV'}
            </button>
          </div>
        </form>
      </div>

      {message && <p style={{ marginTop: 12, color: message.toLowerCase().includes('failed') ? '#c0392b' : '#2c3e50' }}>{message}</p>}

      {result && (
        <div style={{ ...panelStyle, marginTop: 12 }}>
          <strong>CSV Result</strong>
          <p style={{ marginTop: 8, color: '#666', fontSize: '0.9rem' }}>Enrolled: {result.enrolled?.length || 0}</p>
          <p style={{ color: '#666', fontSize: '0.9rem' }}>Already enrolled: {result.alreadyEnrolled?.length || 0}</p>
          <p style={{ color: '#666', fontSize: '0.9rem' }}>Not found: {result.notFound?.length || 0}</p>
        </div>
      )}
    </div>
  );
}

const primaryButtonStyle = {
  background: '#4f8ef7',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  padding: '8px 12px',
  cursor: 'pointer',
  fontWeight: 600
};

const secondaryButtonStyle = {
  ...primaryButtonStyle,
  background: '#16a085'
};
