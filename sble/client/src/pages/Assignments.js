import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../config/api';
import { buildFileUploadFormData, triggerBlobDownload } from '../utils/fileTransfer';
import {
  resolveCourseAccessMessage,
  feedbackAlertType,
  getAssignmentStudentUiState,
  useAssessmentRoles
} from '../assessment';
import {
  AssessmentShell,
  AssessmentPageHeader,
  AssessmentCard,
  AssessmentSectionTitle,
  AssessmentMeta,
  AssessmentAlert,
  AssessmentEmpty,
  AssessmentList,
  AssessmentToolbar,
  BtnPrimary,
  BtnSecondary,
  BtnDanger,
  Field,
  TextInput,
  TextArea,
  QueueItem,
  GradingForm,
  StatusBadge,
  CardTitleRow,
  StatsRow,
  Stat
} from '../components/assessment/AssessmentPrimitives';
import CoursePageFrame from '../components/workspace/CoursePageFrame';
import s from '../components/assessment/AssessmentPrimitives.module.css';

export default function Assignments() {
  const { courseId } = useParams();
  const { isLecturer, isStudent } = useAssessmentRoles();

  const [assignments, setAssignments] = useState([]);
  const [form, setForm] = useState({ title: '', description: '', due_date: '' });
  const [assignmentFile, setAssignmentFile] = useState(null);
  const [submitFile, setSubmitFile] = useState({});
  const [submittingId, setSubmittingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [openSubmissionsAssignmentId, setOpenSubmissionsAssignmentId] = useState(null);
  const [submissionsByAssignment, setSubmissionsByAssignment] = useState({});
  const [submissionsError, setSubmissionsError] = useState('');
  const [loadingSubmissionsId, setLoadingSubmissionsId] = useState(null);
  const [downloadingSubmissionId, setDownloadingSubmissionId] = useState(null);
  const [downloadingAssignmentId, setDownloadingAssignmentId] = useState(null);
  const [gradingSubmission, setGradingSubmission] = useState(null);
  const [gradeField, setGradeField] = useState('');
  const [feedbackField, setFeedbackField] = useState('');
  const [publishField, setPublishField] = useState(false);
  const [gradingSaving, setGradingSaving] = useState(false);
  const [creatingAssignment, setCreatingAssignment] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const loadAssignments = async () => {
      setLoading(true);
      setError('');

      try {
        if (courseId && isStudent) {
          const coursesRes = await api.get('/courses');
          const visibleCourses = Array.isArray(coursesRes.data) ? coursesRes.data : [];
          const hasAccess = visibleCourses.some((course) => String(course.id) === String(courseId));

          if (!hasAccess) {
            setAssignments([]);
            setError('Access denied: you are not enrolled in this course or the course does not exist.');
            return;
          }
        }

        const endpoint = courseId ? `/assignments/course/${courseId}` : '/assignments';
        const res = await api.get(endpoint);
        setAssignments(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        setAssignments([]);
        setError(resolveCourseAccessMessage(err, 'Failed to load assignments.'));
      } finally {
        setLoading(false);
      }
    };

    loadAssignments();
  }, [courseId, isStudent]);

  const updateAssignmentSubmission = (assignmentId, submission) => {
    setAssignments((prev) => prev.map((assignment) => (
      assignment.id === assignmentId
        ? { ...assignment, mySubmission: submission }
        : assignment
    )));
  };

  const createAssignment = async (e) => {
    e.preventDefault();

    if (!form.title.trim()) {
      setError('Please enter an assignment title.');
      return;
    }

    setCreatingAssignment(true);
    setMessage('');
    setError('');

    try {
      const payload = buildFileUploadFormData({
        file: assignmentFile,
        courseId,
        title: form.title,
        fields: {
          description: form.description.trim(),
          due_date: form.due_date || null
        }
      });

      const res = await api.post('/assignments', payload);
      setAssignments((prev) => [res.data, ...prev]);
      setForm({ title: '', description: '', due_date: '' });
      setAssignmentFile(null);
      setMessage(assignmentFile ? 'Assignment created and file uploaded successfully.' : 'Assignment created successfully.');
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to create assignment.');
    } finally {
      setCreatingAssignment(false);
    }
  };

  const submitAssignment = async (assignmentId) => {
    const file = submitFile[assignmentId];
    const assignment = assignments.find((item) => item.id === assignmentId);
    const existingSubmission = assignment?.mySubmission;

    if (!file) {
      setMessage(existingSubmission ? 'Choose a new file to resubmit before the due date.' : 'Select a file before submitting.');
      return;
    }

    setSubmittingId(assignmentId);
    setMessage('');
    setError('');

    const fd = buildFileUploadFormData({
      file,
      courseId: assignment?.course_id || courseId,
      fields: { submission_type: 'scanned' }
    });

    try {
      const res = await api.post(`/assignments/${assignmentId}/submit`, fd);
      updateAssignmentSubmission(assignmentId, res.data);
      setSubmitFile((prev) => ({ ...prev, [assignmentId]: null }));
      setMessage(existingSubmission ? 'Submission updated successfully.' : 'Submission uploaded successfully.');
    } catch (err) {
      const serverMessage = resolveCourseAccessMessage(err, 'Failed to submit assignment.');
      setMessage(serverMessage);
    } finally {
      setSubmittingId(null);
    }
  };

  const deleteSubmission = async (assignmentId) => {
    const assignment = assignments.find((item) => item.id === assignmentId);
    const submission = assignment?.mySubmission;
    if (!submission?.id) return;

    setDeletingId(assignmentId);
    setMessage('');
    setError('');
    try {
      await api.delete(`/assignments/submissions/${submission.id}`);
      updateAssignmentSubmission(assignmentId, null);
      setSubmitFile((prev) => ({ ...prev, [assignmentId]: null }));
      setMessage('Submission deleted. You can resubmit before the due date.');
    } catch (err) {
      setMessage(resolveCourseAccessMessage(err, 'Failed to delete submission.'));
    } finally {
      setDeletingId(null);
    }
  };

  const toggleSubmissions = async (assignmentId) => {
    if (openSubmissionsAssignmentId === assignmentId) {
      setOpenSubmissionsAssignmentId(null);
      setSubmissionsError('');
      return;
    }

    setOpenSubmissionsAssignmentId(assignmentId);
    setSubmissionsError('');
    setLoadingSubmissionsId(assignmentId);

    try {
      const res = await api.get(`/assignments/${assignmentId}/submissions`);
      setSubmissionsByAssignment((prev) => ({
        ...prev,
        [assignmentId]: Array.isArray(res.data) ? res.data : []
      }));
    } catch (err) {
      setSubmissionsByAssignment((prev) => ({ ...prev, [assignmentId]: [] }));
      setSubmissionsError(err?.response?.data?.error || 'Failed to load submissions.');
    } finally {
      setLoadingSubmissionsId(null);
    }
  };

  const downloadSubmission = async (submissionId, fileName) => {
    setDownloadingSubmissionId(submissionId);
    setSubmissionsError('');

    try {
      const response = await api.get(`/assignments/submissions/${submissionId}/download`, { responseType: 'blob' });
      triggerBlobDownload(response, fileName || `submission-${submissionId}`);
    } catch (err) {
      setSubmissionsError(err?.response?.data?.error || 'Download failed.');
    } finally {
      setDownloadingSubmissionId(null);
    }
  };

  const openGrading = (entry) => {
    setGradingSubmission(entry);
    setGradeField(entry.grade != null && entry.grade !== '' ? String(entry.grade) : '');
    setFeedbackField(entry.feedback || '');
    setPublishField(entry.grading_status === 'published');
  };

  const saveGrading = async () => {
    if (!gradingSubmission?.id || !openSubmissionsAssignmentId) return;
    setGradingSaving(true);
    setSubmissionsError('');
    try {
      await api.patch(`/assignments/submissions/${gradingSubmission.id}/grade`, {
        grade: gradeField,
        feedback: feedbackField,
        publish: publishField
      });
      const res = await api.get(`/assignments/${openSubmissionsAssignmentId}/submissions`);
      setSubmissionsByAssignment((prev) => ({
        ...prev,
        [openSubmissionsAssignmentId]: Array.isArray(res.data) ? res.data : []
      }));
      setGradingSubmission(null);
      setMessage('Grading saved.');
    } catch (err) {
      setSubmissionsError(err?.response?.data?.error || 'Failed to save grade.');
    } finally {
      setGradingSaving(false);
    }
  };

  const downloadAssignmentFile = async (assignmentId, fileName) => {
    setDownloadingAssignmentId(assignmentId);
    setMessage('');
    setError('');

    try {
      const response = await api.get(`/assignments/${assignmentId}/download`, { responseType: 'blob' });
      triggerBlobDownload(response, fileName || `assignment-${assignmentId}`);
    } catch (err) {
      setMessage(err?.response?.data?.error || 'Failed to download assignment file.');
    } finally {
      setDownloadingAssignmentId(null);
    }
  };

  const messageAlertType = message ? feedbackAlertType(message) : null;

  return (
    <AssessmentShell wide={isLecturer}>
      <CoursePageFrame courseId={courseId} pageTitle="Assignments">
      <AssessmentPageHeader
        kicker={isLecturer ? 'Teaching · assessment' : 'Learning · assessment'}
        title="Assignments"
        lead={
          isLecturer
            ? 'Review briefs, due dates, and the submission queue. Grading tools open only from each assignment’s submission list.'
            : 'Read the brief, track your submission status, and upload work before the due date. Feedback appears here once released.'
        }
      />

      {loading && <AssessmentMeta>Loading assignments…</AssessmentMeta>}
      {error ? <AssessmentAlert type="error">{error}</AssessmentAlert> : null}
      {message && messageAlertType ? (
        <AssessmentAlert type={messageAlertType}>{message}</AssessmentAlert>
      ) : null}

      {isLecturer && (
        <AssessmentCard>
          <AssessmentSectionTitle>Create assignment</AssessmentSectionTitle>
          <form onSubmit={createAssignment} className={s.formGrid}>
            <Field label="Title">
              <TextInput value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Assignment title" required />
            </Field>
            <Field label="Instructions / description">
              <TextArea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What students should submit and how it will be evaluated" rows={4} />
            </Field>
            <Field label="Due date">
              <TextInput type="datetime-local" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </Field>
            <div>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                onChange={(e) => setAssignmentFile(e.target.files?.[0] || null)}
              />
              <p className={s.inlineHint}>Optional: attach a file students can download (brief, rubric, or template).</p>
            </div>
            <div>
              <BtnPrimary type="submit" disabled={creatingAssignment}>
                {creatingAssignment ? 'Creating…' : assignmentFile ? 'Create & upload' : 'Create assignment'}
              </BtnPrimary>
            </div>
          </form>
        </AssessmentCard>
      )}

      <AssessmentSectionTitle>Your assignments</AssessmentSectionTitle>

      <AssessmentList>
        {assignments.map((assignment) => {
          const submission = assignment.mySubmission || null;
          const status = getAssignmentStudentUiState(assignment);
          const submissionCount = isLecturer && openSubmissionsAssignmentId === assignment.id
            ? (submissionsByAssignment[assignment.id] || []).length
            : null;

          return (
            <li key={assignment.id}>
              <AssessmentCard as="article">
                <CardTitleRow
                  title={assignment.title}
                  aside={
                    isLecturer && assignment.due_date ? (
                      <StatusBadge variant="neutral">Due {new Date(assignment.due_date).toLocaleString()}</StatusBadge>
                    ) : null
                  }
                />
                {assignment.description ? <AssessmentMeta>{assignment.description}</AssessmentMeta> : null}
                {!isLecturer && assignment.due_date ? (
                  <AssessmentMeta strong>Due {new Date(assignment.due_date).toLocaleString()}</AssessmentMeta>
                ) : null}

                {isLecturer && openSubmissionsAssignmentId === assignment.id && submissionCount != null ? (
                  <StatsRow>
                    <Stat label="Submissions in view" value={String(submissionCount)} />
                  </StatsRow>
                ) : null}

                {assignment.file_name ? (
                  <>
                    <AssessmentDivider />
                    <div className={s.flexRow}>
                      <AssessmentMeta strong>Materials: {assignment.file_name}</AssessmentMeta>
                      <BtnPrimary
                        type="button"
                        onClick={() => downloadAssignmentFile(assignment.id, assignment.file_name)}
                        disabled={downloadingAssignmentId === assignment.id}
                      >
                        {downloadingAssignmentId === assignment.id ? 'Downloading…' : 'Download brief'}
                      </BtnPrimary>
                    </div>
                  </>
                ) : null}

                {isLecturer && (
                  <>
                    <AssessmentDivider />
                    <AssessmentToolbar>
                      <BtnSecondary type="button" onClick={() => toggleSubmissions(assignment.id)}>
                        {openSubmissionsAssignmentId === assignment.id ? 'Hide submissions' : 'Open grading queue'}
                      </BtnSecondary>
                    </AssessmentToolbar>

                    {openSubmissionsAssignmentId === assignment.id && (
                      <div className={s.queue}>
                        <p className={s.queueTitle}>Grading queue</p>
                        {submissionsError ? <AssessmentAlert type="error">{submissionsError}</AssessmentAlert> : null}
                        {loadingSubmissionsId === assignment.id ? (
                          <AssessmentMeta>Loading submissions…</AssessmentMeta>
                        ) : (submissionsByAssignment[assignment.id] || []).length === 0 ? (
                          <AssessmentEmpty>No submissions yet for this assignment.</AssessmentEmpty>
                        ) : (
                          (submissionsByAssignment[assignment.id] || []).map((entry) => (
                            <QueueItem key={entry.id}>
                              <div className={s.queueItemHeader}>
                                <div>
                                  <AssessmentMeta strong>{entry.student?.full_name || entry.student?.email || 'Unknown student'}</AssessmentMeta>
                                  <AssessmentMeta>
                                    {entry.file_name || 'Submission file'}
                                    {entry.submitted_at ? ` · Submitted ${new Date(entry.submitted_at).toLocaleString()}` : ''}
                                  </AssessmentMeta>
                                  <AssessmentMeta>
                                    {entry.grading_status === 'published'
                                      ? 'Status: released to student'
                                      : entry.grading_status === 'graded'
                                        ? 'Status: graded (draft — not released)'
                                        : 'Status: submitted'}
                                    {entry.grade != null ? ` · Grade: ${entry.grade}` : ''}
                                  </AssessmentMeta>
                                </div>
                                <div className={s.actionRow}>
                                  <BtnPrimary
                                    type="button"
                                    onClick={() => downloadSubmission(entry.id, entry.file_name)}
                                    disabled={downloadingSubmissionId === entry.id}
                                  >
                                    {downloadingSubmissionId === entry.id ? 'Downloading…' : 'Download'}
                                  </BtnPrimary>
                                  <BtnSecondary
                                    type="button"
                                    onClick={() => (gradingSubmission?.id === entry.id ? setGradingSubmission(null) : openGrading(entry))}
                                  >
                                    {gradingSubmission?.id === entry.id ? 'Close panel' : 'Grade & feedback'}
                                  </BtnSecondary>
                                </div>
                              </div>
                              {gradingSubmission?.id === entry.id && (
                                <GradingForm>
                                  <Field label="Grade (numeric)">
                                    <TextInput value={gradeField} onChange={(e) => setGradeField(e.target.value)} />
                                  </Field>
                                  <Field label="Feedback">
                                    <TextArea value={feedbackField} onChange={(e) => setFeedbackField(e.target.value)} rows={4} />
                                  </Field>
                                  <label className={s.checkRow}>
                                    <input type="checkbox" checked={publishField} onChange={(e) => setPublishField(e.target.checked)} />
                                    Publish results to student (sends notification)
                                  </label>
                                  <div className={s.flexRow}>
                                    <BtnPrimary type="button" disabled={gradingSaving} onClick={saveGrading}>
                                      {gradingSaving ? 'Saving…' : 'Save grading'}
                                    </BtnPrimary>
                                    <BtnSecondary type="button" onClick={() => setGradingSubmission(null)}>Cancel</BtnSecondary>
                                  </div>
                                </GradingForm>
                              )}
                            </QueueItem>
                          ))
                        )}
                      </div>
                    )}
                  </>
                )}

                {!isLecturer && (
                  <>
                    <AssessmentDivider />
                    <div className={s.flexRow}>
                      <StatusBadge variant={status.badgeVariant}>{status.label}</StatusBadge>
                    </div>

                    {submission?.submitted_at && (
                      <div className={s.studentPanel}>
                        <AssessmentMeta strong>
                          Submitted {new Date(submission.submitted_at).toLocaleString()}
                        </AssessmentMeta>
                        {submission.grade === null || submission.grade === undefined ? (
                          <p className={s.feedbackItem} style={{ color: '#2563eb', fontWeight: 600 }}>Waiting for grading</p>
                        ) : (
                          <>
                            <p className={s.feedbackItem} style={{ color: '#047857', fontWeight: 600 }}>Grade: {submission.grade}</p>
                            {submission.feedback ? (
                              <div className={s.feedbackBlock}>Feedback: {submission.feedback}</div>
                            ) : null}
                          </>
                        )}
                      </div>
                    )}

                    <div className={`${s.studentPanel} ${s.uploadRow}`}>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.png,.doc,.docx"
                        onChange={(e) => setSubmitFile({ ...submitFile, [assignment.id]: e.target.files?.[0] || null })}
                        disabled={!status.canUpload}
                      />
                      <BtnPrimary
                        type="button"
                        onClick={() => submitAssignment(assignment.id)}
                        disabled={!status.canUpload || submittingId === assignment.id}
                      >
                        {submittingId === assignment.id ? 'Uploading…' : status.uploadLabel}
                      </BtnPrimary>
                      {status.canDelete && submission?.id ? (
                        <BtnDanger type="button" onClick={() => deleteSubmission(assignment.id)} disabled={deletingId === assignment.id}>
                          {deletingId === assignment.id ? 'Deleting…' : 'Delete submission'}
                        </BtnDanger>
                      ) : null}
                    </div>
                  </>
                )}
              </AssessmentCard>
            </li>
          );
        })}
      </AssessmentList>

      {!loading && assignments.length === 0 ? (
        <AssessmentEmpty>No assignments in this course yet.</AssessmentEmpty>
      ) : null}
      </CoursePageFrame>
    </AssessmentShell>
  );
}
