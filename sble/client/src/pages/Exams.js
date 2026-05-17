import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useKeycloak } from '../auth/AuthProvider';
import api from '../config/api';
import { buildFileUploadFormData, triggerBlobDownload } from '../utils/fileTransfer';
import { getStudentExamUiState, computeExamParticipation } from '../assessment';
import {
  AssessmentShell,
  AssessmentPageHeader,
  AssessmentCard,
  AssessmentSectionTitle,
  AssessmentAlert,
  AssessmentMeta,
  AssessmentToolbar,
  AssessmentDivider,
  BtnPrimary,
  BtnSecondary,
  BtnAccent,
  Field,
  TextInput,
  CardTitleRow,
  StatusBadge,
  QueueItem
} from '../components/assessment/AssessmentPrimitives';
import CoursePageFrame from '../components/workspace/CoursePageFrame';
import QuizEmptyIllustration from '../components/quizzes/QuizEmptyIllustration';
import qstyles from '../components/quizzes/AssessmentQuiz.module.css';
import s from '../components/assessment/AssessmentPrimitives.module.css';

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
  const [message, setMessage] = useState('');
  const [openParticipantsExamId, setOpenParticipantsExamId] = useState(null);
  const [participantsByExam, setParticipantsByExam] = useState({});
  const [enrollmentCount, setEnrollmentCount] = useState(0);

  const loadExams = () => {
    setLoading(true);
    api.get(`/exams/course/${courseId}`)
      .then((r) => setExams(Array.isArray(r.data) ? r.data : []))
      .catch(() => setExams([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadExams();
  }, [courseId]);

  const uploadExam = async (e) => {
    e.preventDefault();
    if (!file || !form.title.trim()) {
      setError('Title and PDF file are required.');
      return;
    }
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
      setMessage('Exam paper uploaded. Release when ready for students.');
    } catch (err) {
      setError(err?.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const releaseExam = async (examId) => {
    setError('');
    try {
      const res = await api.patch(`/exams/${examId}/release`, {
        scheduled_at: form.scheduled_at || undefined,
        duration_minutes: form.duration_minutes
      });
      setExams((prev) => prev.map((ex) => (ex.id === examId ? { ...ex, ...res.data, is_released: true } : ex)));
      setMessage('Exam released to students.');
    } catch (err) {
      setError(err?.response?.data?.error || 'Release failed');
    }
  };

  const downloadExam = async (exam) => {
    setError('');
    try {
      const response = await api.get(`/exams/${exam.id}/download`, { responseType: 'blob' });
      triggerBlobDownload(response, `${exam.title || `exam-${exam.id}`}.pdf`);
      if (!isLecturer) {
        setExams((prev) => prev.map((ex) => (
          ex.id === exam.id
            ? { ...ex, myAccess: { accessed_at: new Date().toISOString() } }
            : ex
        )));
        setMessage('Exam paper downloaded. Keep it secure for the examination window.');
      }
    } catch (err) {
      setError(err?.response?.data?.error || 'Download failed');
    }
  };

  const toggleParticipants = async (examId) => {
    if (openParticipantsExamId === examId) {
      setOpenParticipantsExamId(null);
      return;
    }
    setOpenParticipantsExamId(examId);
    if (participantsByExam[examId]) return;
    try {
      const res = await api.get(`/exams/${examId}/participants`);
      setParticipantsByExam((prev) => ({
        ...prev,
        [examId]: Array.isArray(res.data?.participants) ? res.data.participants : []
      }));
      setEnrollmentCount(Number(res.data?.enrollmentCount) || 0);
    } catch (err) {
      setParticipantsByExam((prev) => ({ ...prev, [examId]: [] }));
    }
  };

  const windowLabel = (exam) => {
    if (!exam.start_time && !exam.end_time) return 'Window not scheduled';
    const start = exam.start_time ? new Date(exam.start_time).toLocaleString() : '—';
    const end = exam.end_time ? new Date(exam.end_time).toLocaleString() : '—';
    return `${start} → ${end}`;
  };

  return (
    <AssessmentShell wide={isLecturer}>
      <CoursePageFrame courseId={courseId} pageTitle="Exams">
        <AssessmentPageHeader
          kicker={isLecturer ? 'Teaching · examinations' : 'Learning · examinations'}
          title="Exams"
          lead={
            isLecturer
              ? 'Upload exam papers, set availability windows, and track student access during the examination period.'
              : 'Download exam papers only during the scheduled window. Access is recorded for academic records.'
          }
        />

        {loading ? <AssessmentMeta>Loading exams…</AssessmentMeta> : null}
        {error ? <AssessmentAlert type="error">{error}</AssessmentAlert> : null}
        {message ? <AssessmentAlert type="success">{message}</AssessmentAlert> : null}

        {isLecturer ? (
          <AssessmentCard>
            <AssessmentSectionTitle>Upload exam paper</AssessmentSectionTitle>
            <form onSubmit={uploadExam} className={s.formGrid}>
              <Field label="Title">
                <TextInput value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
              </Field>
              <Field label="Scheduled start">
                <TextInput type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} />
              </Field>
              <Field label="Duration (minutes)">
                <TextInput type="number" min={1} value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} />
              </Field>
              <Field label="PDF file">
                <input type="file" accept=".pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} required />
              </Field>
              <BtnPrimary type="submit" disabled={uploading}>{uploading ? 'Uploading…' : 'Upload exam'}</BtnPrimary>
            </form>
          </AssessmentCard>
        ) : null}

        <AssessmentSectionTitle>Scheduled exams</AssessmentSectionTitle>

        {!loading && exams.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-6)' }}>
            <QuizEmptyIllustration />
            <AssessmentMeta strong>No exams scheduled yet.</AssessmentMeta>
          </div>
        ) : (
          <ul className={s.list}>
            {exams.map((exam) => {
              const studentState = getStudentExamUiState(exam);
              const participants = participantsByExam[exam.id] || [];
              const participation = computeExamParticipation(participants, enrollmentCount);

              return (
                <li key={exam.id}>
                  <AssessmentCard as="article">
                    <CardTitleRow
                      title={exam.title}
                      aside={
                        <StatusBadge variant={studentState.badgeVariant}>
                          {isLecturer
                            ? (exam.is_released ? (exam.window_status === 'open' ? 'Active' : exam.window_status) : 'Draft')
                            : studentState.label}
                        </StatusBadge>
                      }
                    />
                    <AssessmentMeta>{windowLabel(exam)} · {exam.duration_minutes} min</AssessmentMeta>

                    {isLecturer ? (
                      <AssessmentToolbar>
                        {!exam.is_released ? (
                          <BtnAccent type="button" onClick={() => releaseExam(exam.id)}>Release to students</BtnAccent>
                        ) : null}
                        <BtnSecondary type="button" onClick={() => toggleParticipants(exam.id)}>
                          {openParticipantsExamId === exam.id ? 'Hide participation' : 'Participation'}
                        </BtnSecondary>
                        <BtnPrimary type="button" onClick={() => downloadExam(exam)}>Download paper</BtnPrimary>
                      </AssessmentToolbar>
                    ) : (
                      <AssessmentToolbar>
                        <BtnPrimary
                          type="button"
                          onClick={() => downloadExam(exam)}
                          disabled={!studentState.canDownload}
                        >
                          {studentState.buttonLabel}
                        </BtnPrimary>
                      </AssessmentToolbar>
                    )}

                    {exam.myAccess?.accessed_at && !isLecturer ? (
                      <>
                        <AssessmentDivider />
                        <AssessmentAlert type="success">
                          You accessed this exam on {new Date(exam.myAccess.accessed_at).toLocaleString()}.
                        </AssessmentAlert>
                      </>
                    ) : null}

                    {isLecturer && openParticipantsExamId === exam.id ? (
                      <div className={s.queue}>
                        <div className={qstyles.lecturerStats}>
                          <div className={qstyles.lecturerStat}>
                            <strong>{participation.completed}</strong>
                            <span>Accessed</span>
                          </div>
                          <div className={qstyles.lecturerStat}>
                            <strong>{participation.rate}%</strong>
                            <span>Participation</span>
                          </div>
                        </div>
                        {participants.length === 0 ? (
                          <AssessmentMeta>No students have accessed this exam yet.</AssessmentMeta>
                        ) : (
                          participants.map((row) => (
                            <QueueItem key={row.id}>
                              <AssessmentMeta strong>{row.student?.full_name || row.student?.email}</AssessmentMeta>
                              <AssessmentMeta>Accessed {new Date(row.accessed_at).toLocaleString()}</AssessmentMeta>
                            </QueueItem>
                          ))
                        )}
                      </div>
                    ) : null}
                  </AssessmentCard>
                </li>
              );
            })}
          </ul>
        )}
      </CoursePageFrame>
    </AssessmentShell>
  );
}

