import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useKeycloak } from '../auth/AuthProvider';
import api from '../config/api';
import { buildFileUploadFormData, triggerBlobDownload } from '../utils/fileTransfer';

export default function Exams() {
  const { courseId } = useParams();
  const { keycloak } = useKeycloak();
  const isLecturer = keycloak.hasRealmRole('lecturer') || keycloak.hasRealmRole('admin');

  const [exams, setExams] = useState([]);
  const [file, setFile] = useState(null);
  const [form, setForm] = useState({ title: '', scheduled_at: '', duration_minutes: 120 });
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    api.get(`/exams/course/${courseId}`).then(r => setExams(r.data)).catch(() => {});
  }, [courseId]);

  const uploadExam = async (e) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    const fd = buildFileUploadFormData({
      file,
      courseId,
      title: form.title,
      fields: {
        scheduled_at: form.scheduled_at,
        duration_minutes: form.duration_minutes
      }
    });
    try {
      const res = await api.post('/exams/upload', fd);
      setExams(prev => [...prev, res.data]);
      setForm({ title: '', scheduled_at: '', duration_minutes: 120 });
      setFile(null);
    } finally {
      setUploading(false);
    }
  };

  const releaseExam = async (examId) => {
    await api.patch(`/exams/${examId}/release`);
    setExams(prev => prev.map(ex => ex.id === examId ? { ...ex, is_released: true } : ex));
  };

  const downloadExam = async (examId, title) => {
    try {
      const response = await api.get(`/exams/${examId}/download`, { responseType: 'blob' });
      triggerBlobDownload(response, `${title || `exam-${examId}`}.pdf`);
    } catch (_) {
      alert('Download failed');
    }
  };

  return (
    <div>
      <h2>Exams</h2>

      {isLecturer && (
        <form onSubmit={uploadExam} style={{ marginTop: 20, background: '#fff', padding: 20, borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h3 style={{ marginBottom: 4 }}>Upload Exam Paper</h3>
          <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Exam title" required
            style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #ddd' }} />
          <label style={{ fontSize: '0.85rem', color: '#666' }}>Scheduled date &amp; time</label>
          <input type="datetime-local" value={form.scheduled_at} onChange={e => setForm({ ...form, scheduled_at: e.target.value })}
            style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #ddd' }} />
          <input type="number" value={form.duration_minutes} onChange={e => setForm({ ...form, duration_minutes: e.target.value })}
            placeholder="Duration (minutes)" style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #ddd' }} />
          <input type="file" accept=".pdf" onChange={e => setFile(e.target.files[0])} required />
          <button type="submit" disabled={uploading}
            style={{ background: '#4f8ef7', color: '#fff', padding: '10px', borderRadius: 6, border: 'none', cursor: 'pointer' }}>
            {uploading ? 'Uploading...' : 'Upload Exam Paper'}
          </button>
        </form>
      )}

      <ul style={{ marginTop: 24, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {exams.map(ex => (
          <li key={ex.id} style={{ background: '#fff', padding: 16, borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong>{ex.title}</strong>
              {ex.scheduled_at && (
                <p style={{ color: '#888', fontSize: '0.85rem', marginTop: 4 }}>
                  Scheduled: {new Date(ex.scheduled_at).toLocaleString()}
                  {' · '}{ex.duration_minutes} min
                </p>
              )}
              <span style={{ fontSize: '0.8rem', color: ex.is_released ? '#28a745' : '#e67e22', fontWeight: 600 }}>
                {ex.is_released ? 'Released' : 'Locked'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {isLecturer && !ex.is_released && (
                <button onClick={() => releaseExam(ex.id)}
                  style={{ background: '#28a745', color: '#fff', padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer' }}>
                  Release
                </button>
              )}
              {(ex.is_released || isLecturer) && (
                <button onClick={() => downloadExam(ex.id, ex.title)}
                  style={{ background: '#4f8ef7', color: '#fff', padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer' }}>
                  Download
                </button>
              )}
            </div>
          </li>
        ))}
        {exams.length === 0 && <p style={{ color: '#888', marginTop: 16 }}>No exams uploaded yet.</p>}
      </ul>
    </div>
  );
}
