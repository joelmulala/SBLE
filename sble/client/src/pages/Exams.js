import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useKeycloak } from '../auth/AuthProvider';
import api from '../config/api';
import { buildFileUploadFormData, triggerBlobDownload } from '../utils/fileTransfer';
import { getStudentExamUiState, computeExamParticipation } from '../assessment';
import {
  Field,
  TextInput
} from '../components/assessment/AssessmentPrimitives';
import AssessmentWorkspace from '../components/workspace/AssessmentWorkspace';
import {
  PageActions,
  Panel,
  Button,
  DataTable,
  TableActions,
  SearchInput,
  StatusPill,
  EmptyState,
  LoadingState
} from '../components/ui';
import ui from '../components/ui/system.module.css';
import QuizEmptyIllustration from '../components/quizzes/QuizEmptyIllustration';
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
  const [showUpload, setShowUpload] = useState(false);
  const [tableQuery, setTableQuery] = useState('');

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
      setShowUpload(false);
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
    } catch {
      setParticipantsByExam((prev) => ({ ...prev, [examId]: [] }));
    }
  };

  const windowLabel = (exam) => {
    if (!exam.start_time && !exam.end_time) return 'Window not scheduled';
    const start = exam.start_time ? new Date(exam.start_time).toLocaleString() : '—';
    const end = exam.end_time ? new Date(exam.end_time).toLocaleString() : '—';
    return `${start} → ${end}`;
  };

  const releasedCount = useMemo(
    () => exams.filter((ex) => ex.is_released).length,
    [exams]
  );

  const activeWindowCount = useMemo(
    () => exams.filter((ex) => ex.is_released && ex.window_status === 'open').length,
    [exams]
  );

  const columns = useMemo(() => {
    const base = [
      {
        key: 'title',
        label: 'Exam',
        render: (exam) => (
          <div className={ui.cellStack}>
            <span className={ui.cellPrimary}>{exam.title}</span>
            <span className={ui.cellMuted}>{windowLabel(exam)} · {exam.duration_minutes} min</span>
          </div>
        )
      },
      {
        key: 'status',
        label: 'Status',
        render: (exam) => {
          if (isLecturer) {
            const label = exam.is_released
              ? (exam.window_status === 'open' ? 'Active' : exam.window_status || 'Released')
              : 'Draft';
            return <StatusPill variant={exam.is_released ? 'active' : 'inactive'}>{label}</StatusPill>;
          }
          const studentState = getStudentExamUiState(exam);
          return <StatusPill variant={studentState.badgeVariant === 'success' ? 'active' : 'info'}>{studentState.label}</StatusPill>;
        }
      },
      {
        key: 'actions',
        label: 'Actions',
        render: (exam) => (
          <TableActions>
            {isLecturer ? (
              <>
                {!exam.is_released ? (
                  <Button type="button" variant="primary" onClick={() => releaseExam(exam.id)}>
                    Release
                  </Button>
                ) : null}
                <Button type="button" variant="ghost" onClick={() => toggleParticipants(exam.id)}>
                  {openParticipantsExamId === exam.id ? 'Hide access' : 'Participation'}
                </Button>
                <Button type="button" variant="ghost" onClick={() => downloadExam(exam)}>
                  Download
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="primary"
                disabled={!getStudentExamUiState(exam).canDownload}
                onClick={() => downloadExam(exam)}
              >
                {getStudentExamUiState(exam).buttonLabel}
              </Button>
            )}
          </TableActions>
        )
      }
    ];
    return base;
  }, [isLecturer, openParticipantsExamId]);

  const openExam = exams.find((ex) => ex.id === openParticipantsExamId);
  const openParticipants = openParticipantsExamId ? (participantsByExam[openParticipantsExamId] || []) : [];
  const participation = openExam
    ? computeExamParticipation(openParticipants, enrollmentCount)
    : null;

  return (
    <AssessmentWorkspace courseId={courseId}>
      <p className={ui.lead}>
        {isLecturer
          ? 'Upload exam papers, set availability windows, and track student access during the examination period.'
          : 'Download exam papers only during the scheduled window. Access is recorded for academic records.'}
      </p>

      <PageActions
        search={(
          <SearchInput
            placeholder="Search exams…"
            value={tableQuery}
            onChange={(e) => setTableQuery(e.target.value)}
            aria-label="Search exams"
          />
        )}
        actions={isLecturer ? (
          <Button type="button" variant="primary" onClick={() => setShowUpload((prev) => !prev)}>
            {showUpload ? 'Close upload' : 'Upload exam'}
          </Button>
        ) : null}
      />

      {error ? <div className={`${ui.notice} ${ui.noticeError}`}>{error}</div> : null}
      {message ? <div className={`${ui.notice} ${ui.noticeSuccess}`}>{message}</div> : null}

      {isLecturer && exams.length > 0 ? (
        <KpiStatGrid>
          <StatCard label="Scheduled exams" value={exams.length} hint="In this course" />
          <StatCard label="Released" value={releasedCount} hint="Available to students" />
          <StatCard label="Draft" value={exams.length - releasedCount} hint="Awaiting release" />
          <StatCard label="Active windows" value={activeWindowCount} hint="Open for download now" />
        </KpiStatGrid>
      ) : null}

      {isLecturer && showUpload ? (
        <Panel title="Upload exam paper">
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
            <div className={ui.field}>
              <label htmlFor="exam-pdf">PDF file</label>
              <input id="exam-pdf" type="file" className={ui.input} accept=".pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} required />
            </div>
            <div className={ui.formActions}>
              <Button type="submit" variant="primary" disabled={uploading}>
                {uploading ? 'Uploading…' : 'Upload exam'}
              </Button>
            </div>
          </form>
        </Panel>
      ) : null}

      <Panel title="Scheduled exams" lead={loading ? '' : `${exams.length} exam${exams.length === 1 ? '' : 's'}`} flush>
        {loading ? (
          <div className={ui.tableState}>
            <LoadingState label="Loading exams…" />
          </div>
        ) : exams.length === 0 ? (
          <div className={ui.emptyCenter}>
            <QuizEmptyIllustration />
            <p className={ui.emptyHint}>No exams scheduled yet.</p>
          </div>
        ) : (
          <DataTable
            hideToolbar
            query={tableQuery}
            onQueryChange={setTableQuery}
            columns={columns}
            rows={exams}
            rowKey={(ex) => ex.id}
            searchFn={(exam, q) => `${exam.title} ${windowLabel(exam)}`.toLowerCase().includes(q)}
            emptyMessage="No exams match your search."
          />
        )}
      </Panel>

      {isLecturer && openParticipantsExamId && openExam ? (
        <Panel
          title={`Participation · ${openExam.title}`}
          lead={participation ? `${participation.completed} accessed · ${participation.rate}% participation` : ''}
        >
          {openParticipants.length === 0 ? (
            <EmptyState message="No students have accessed this exam yet." />
          ) : (
            <ul className={ui.oversightList}>
              {openParticipants.map((row) => (
                <li key={row.id} className={ui.oversightItem}>
                  <div>
                    <strong>{row.student?.full_name || row.student?.email || 'Student'}</strong>
                    <p className={ui.oversightMeta}>
                      Accessed {new Date(row.accessed_at).toLocaleString()}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      ) : null}
    </AssessmentWorkspace>
  );
}
