import React, { useEffect, useMemo, useState } from 'react';
import api from '../../config/api';
import { buildFileUploadFormData, triggerBlobDownload } from '../../utils/fileTransfer';
import {
  AssessmentShell,
  AssessmentPageHeader,
  AssessmentCard,
  AssessmentSectionTitle,
  AssessmentMeta,
  AssessmentAlert,
  AssessmentEmpty,
  BtnPrimary,
  Field,
  TextInput,
  TextArea,
  SelectInput,
  LinkPrimary
} from '../../components/assessment/AssessmentPrimitives';
import s from '../../components/assessment/AssessmentPrimitives.module.css';

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
    <AssessmentShell wide>
      <AssessmentPageHeader
        kicker="Teaching · assignments"
        title="All assignments"
        lead="Create briefs from here, then open each course for submissions, grading, and release to students."
        toolbar={(
          <BtnPrimary type="button" onClick={() => setShowForm((prev) => !prev)}>
            {showForm ? 'Close form' : 'Create assignment'}
          </BtnPrimary>
        )}
      />

      {error ? <AssessmentAlert type="error">{error}</AssessmentAlert> : null}
      {loading ? <AssessmentMeta>Loading assignments…</AssessmentMeta> : null}

      {showForm && (
        <AssessmentCard>
          <AssessmentSectionTitle>New assignment</AssessmentSectionTitle>
          <form onSubmit={createAssignment} className={s.formGrid}>
            <Field label="Course">
              <SelectInput
                value={form.course_id}
                onChange={(e) => setForm((prev) => ({ ...prev, course_id: e.target.value }))}
                required
              >
                <option value="">Select course</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>{course.title}</option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Title">
              <TextInput
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Assignment title"
                required
              />
            </Field>
            <Field label="Description">
              <TextArea
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Instructions for students"
                rows={3}
              />
            </Field>
            <Field label="Due date">
              <TextInput
                type="datetime-local"
                value={form.due_date}
                onChange={(e) => setForm((prev) => ({ ...prev, due_date: e.target.value }))}
              />
            </Field>
            <div>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                onChange={(e) => setAttachment(e.target.files?.[0] || null)}
              />
              <p className={s.inlineHint}>Optional: attach a file students download with the brief.</p>
            </div>
            <BtnPrimary type="submit" disabled={saving}>
              {saving ? 'Saving…' : attachment ? 'Create & upload' : 'Create assignment'}
            </BtnPrimary>
          </form>
        </AssessmentCard>
      )}

      <AssessmentSectionTitle>Directory</AssessmentSectionTitle>

      <div className={s.tableScroll}>
        <table className={s.table}>
          <thead>
            <tr>
              <th className={s.th}>Title</th>
              <th className={s.th}>Course</th>
              <th className={s.th}>Due</th>
              <th className={s.th}>Attachment</th>
              <th className={s.th}>Workflow</th>
            </tr>
          </thead>
          <tbody>
            {assignments.map((assignment) => (
              <tr key={assignment.id}>
                <td className={s.td}>
                  <span className={s.metaStrong}>{assignment.title}</span>
                </td>
                <td className={s.td}>{courseNameById[String(assignment.course_id)] || `Course #${assignment.course_id}`}</td>
                <td className={s.td}>{formatDateTime(assignment.due_date)}</td>
                <td className={s.td}>
                  {assignment.file_name ? (
                    <button
                      type="button"
                      className={s.navLinkSecondary}
                      onClick={() => downloadAssignmentFile(assignment.id, assignment.file_name)}
                      disabled={downloadingId === assignment.id}
                    >
                      {downloadingId === assignment.id ? 'Downloading…' : 'Download'}
                    </button>
                  ) : (
                    <span className={s.meta}>No file</span>
                  )}
                </td>
                <td className={s.td}>
                  <LinkPrimary to={`/lecturer/courses/${assignment.course_id}/assignments`}>
                    Open course workspace
                  </LinkPrimary>
                </td>
              </tr>
            ))}
            {!loading && assignments.length === 0 && (
              <tr>
                <td className={s.td} colSpan={5}>
                  <AssessmentEmpty>No assignments yet.</AssessmentEmpty>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AssessmentShell>
  );
}

function formatDateTime(value) {
  if (!value) return 'Not set';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'Not set' : parsed.toLocaleString();
}
