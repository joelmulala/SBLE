import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useKeycloak } from '../auth/AuthProvider';
import api from '../config/api';
import { buildFileUploadFormData, triggerBlobDownload } from '../utils/fileTransfer';
import {
  AssessmentShell,
  AssessmentPageHeader,
  AssessmentCard,
  AssessmentSectionTitle,
  AssessmentAlert,
  AssessmentEmpty,
  AssessmentMeta,
  BtnPrimary,
  BtnSecondary,
  Field,
  TextInput,
  StatusBadge
} from '../components/assessment/AssessmentPrimitives';
import CoursePageFrame from '../components/workspace/CoursePageFrame';

export default function Exams() {
  const { courseId } = useParams();
  const { keycloak } = useKeycloak();
  const isLecturer = keycloak.hasRealmRole('lecturer') || keycloak.hasRealmRole('admin');

  const [exams, setExams] = useState([]);
  const [file, setFile] = useState(null);
  const [form, setForm] = useState({ title: '', scheduled_at: '', duration_minutes: 120 });
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    api.get(`/exams/course/${courseId}`)
      .then((r) => setExams(Array.isArray(r.data) ? r.data : []))
      .catch(() => setExams([]))
      .finally(() => setLoading(false));
  }, [courseId]);

  const uploadExam = async (e) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setError('');
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
      setExams((prev) => [...prev, res.data]);
      setForm({ title: '', scheduled_at: '', duration_minutes: 120 });
      setFile(null);
    } catch (err) {
      setError(err?.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const releaseExam = async (examId) => {
    await api.patch(`/exams/${examId}/release`);
    setExams((prev) => prev.map((ex) => (ex.id === examId ? { ...ex, is_released: true } : ex)));
  };

  const downloadExam = async (examId, title) => {
    try {
      const response = await api.get(`/exams/${examId}/download`, { responseType: 'blob' });
      triggerBlobDownload(response, `${title || `exam-${examId}`}.pdf`);
    } catch (_) {
      setError('Download failed');
    }
  };

  return (
    <AssessmentShell>
      <CoursePageFrame courseId={courseId} pageTitle="Exams">
        <AssessmentPageHeader
          kicker={isLecturer ? 'Course delivery' : 'Course study'}
          title="Exams"
          lead="Scheduled examinations and release windows for this course."
        />

        {loading ? <AssessmentMeta>Loading exams...</AssessmentMeta> : null}
        {error ? <AssessmentAlert>{error}</AssessmentAlert> : null}

        {isLecturer ? (
          <AssessmentCard>
            <AssessmentSectionTitle>Upload exam paper</AssessmentSectionTitle>
            <form onSubmit={uploadExam} style={{ display: 'grid', gap: 'var(--space-4)' }}>
              <Field label="Title">
                <TextInput value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
              </Field>
              <Field label="Scheduled">
                <TextInput type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} />
              </Field>
              <Field label="Duration (minutes)">
                <TextInput type="number" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} />
              </Field>
              <Field label="PDF file">
                <input type="file" accept=".pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} required />
              </Field>
              <BtnPrimary type="submit" disabled={uploading}>{uploading ? 'Uploading...' : 'Upload exam'}</BtnPrimary>
            </form>
          </AssessmentCard>
        ) : null}

        {!loading && exams.length === 0 ? (
          <AssessmentEmpty>No exams scheduled yet.</AssessmentEmpty>
        ) : (
          <AssessmentCard>
            <AssessmentSectionTitle>Exams</AssessmentSectionTitle>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {exams.map((ex) => (
                <li
                  key={ex.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                    padding: 'var(--space-3)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)'
                  }}
                >
                  <div>
                    <strong>{ex.title}</strong>
                    {ex.scheduled_at ? (
                      <AssessmentMeta>
                        {new Date(ex.scheduled_at).toLocaleString()} · {ex.duration_minutes} min
                      </AssessmentMeta>
                    ) : null}
                    <StatusBadge variant={ex.is_released ? 'success' : 'warning'}>
                      {ex.is_released ? 'Released' : 'Locked'}
                    </StatusBadge>
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    {isLecturer && !ex.is_released ? (
                      <BtnSecondary type="button" onClick={() => releaseExam(ex.id)}>Release</BtnSecondary>
                    ) : null}
                    {(ex.is_released || isLecturer) ? (
                      <BtnPrimary type="button" onClick={() => downloadExam(ex.id, ex.title)}>Download</BtnPrimary>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </AssessmentCard>
        )}
      </CoursePageFrame>
    </AssessmentShell>
  );
}
