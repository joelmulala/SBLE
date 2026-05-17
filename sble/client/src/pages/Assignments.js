import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../config/api';
import { buildFileUploadFormData, triggerBlobDownload } from '../utils/fileTransfer';
import {
  resolveCourseAccessMessage,
  feedbackAlertType,
  useAssessmentRoles
} from '../assessment';
import {
  AssessmentShell,
  AssessmentPageHeader,
  AssessmentCard,
  AssessmentSectionTitle,
  AssessmentMeta,
  AssessmentAlert,
  AssessmentList,
  BtnPrimary,
  Field,
  TextInput,
  TextArea
} from '../components/assessment/AssessmentPrimitives';
import CoursePageFrame from '../components/workspace/CoursePageFrame';
import LecturerAssignmentCard from '../components/assignments/LecturerAssignmentCard';
import StudentAssignmentCard from '../components/assignments/StudentAssignmentCard';
import GradingPanel from '../components/assignments/GradingPanel';
import AssignmentsEmptyState from '../components/assignments/AssignmentsEmptyState';
import { computeAssignmentStats } from '../components/assignments/assignmentUtils';
import s from '../components/assessment/AssessmentPrimitives.module.css';
import dash from '../components/assignments/Assignments.module.css';

export default function Assignments() {
  const { courseId } = useParams();
  const { isLecturer, isStudent } = useAssessmentRoles();

  const [assignments, setAssignments] = useState([]);
  const [form, setForm] = useState({ title: '', description: '', due_date: '' });
  const [assignmentFile, setAssignmentFile] = useState(null);
  const [submitFile, setSubmitFile] = useState({});
  const [uploadProgress, setUploadProgress] = useState({});
  const [submittingId, setSubmittingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
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

  const loadSubmissions = useCallback(async (assignmentId) => {
    const res = await api.get(`/assignments/${assignmentId}/submissions`);
    const list = Array.isArray(res.data) ? res.data : [];
    setSubmissionsByAssignment((prev) => ({ ...prev, [assignmentId]: list }));
    return list;
  }, []);

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
        const list = Array.isArray(res.data) ? res.data : [];
        setAssignments(list);

        if (isLecturer && list.length) {
          const results = await Promise.all(
            list.map((a) => loadSubmissions(a.id).catch(() => []))
          );
          const map = {};
          list.forEach((a, i) => { map[a.id] = results[i] || []; });
          setSubmissionsByAssignment(map);
        }
      } catch (err) {
        setAssignments([]);
        setError(resolveCourseAccessMessage(err, 'Failed to load assignments.'));
      } finally {
        setLoading(false);
      }
    };

    loadAssignments();
  }, [courseId, isStudent, isLecturer, loadSubmissions]);

  const lecturerSummary = useMemo(() => {
    if (!isLecturer) return null;
    let total = 0;
    let graded = 0;
    let pending = 0;
    Object.values(submissionsByAssignment).forEach((list) => {
      const stats = computeAssignmentStats(list);
      total += stats.total;
      graded += stats.graded;
      pending += stats.pending;
    });
    return { total, graded, pending };
  }, [isLecturer, submissionsByAssignment]);

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
      setSubmissionsByAssignment((prev) => ({ ...prev, [res.data.id]: [] }));
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
    setUploadProgress((prev) => ({ ...prev, [assignmentId]: 0 }));
    setMessage('');
    setError('');
    setConfirmId(null);

    const fd = buildFileUploadFormData({
      file,
      courseId: assignment?.course_id || courseId,
      fields: { submission_type: 'scanned' }
    });

    try {
      const res = await api.post(`/assignments/${assignmentId}/submit`, fd, {
        onUploadProgress: (e) => {
          if (e.total) {
            setUploadProgress((prev) => ({
              ...prev,
              [assignmentId]: Math.round((e.loaded * 100) / e.total)
            }));
          }
        }
      });
      updateAssignmentSubmission(assignmentId, res.data);
      setSubmitFile((prev) => ({ ...prev, [assignmentId]: null }));
      setUploadProgress((prev) => ({ ...prev, [assignmentId]: 100 }));
      setConfirmId(assignmentId);
      setMessage(existingSubmission ? 'Submission updated successfully.' : 'Submission uploaded successfully.');
    } catch (err) {
      setMessage(resolveCourseAccessMessage(err, 'Failed to submit assignment.'));
    } finally {
      setSubmittingId(null);
      setTimeout(() => {
        setUploadProgress((prev) => ({ ...prev, [assignmentId]: null }));
      }, 800);
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
      setConfirmId(null);
      setMessage('Submission removed. You can upload again before the due date.');
    } catch (err) {
      setMessage(resolveCourseAccessMessage(err, 'Failed to delete submission.'));
    } finally {
      setDeletingId(null);
    }
  };

  const toggleSubmissions = async (assignmentId) => {
    if (openSubmissionsAssignmentId === assignmentId) {
      setOpenSubmissionsAssignmentId(null);
      setGradingSubmission(null);
      setSubmissionsError('');
      return;
    }

    setOpenSubmissionsAssignmentId(assignmentId);
    setSubmissionsError('');
    setLoadingSubmissionsId(assignmentId);

    try {
      await loadSubmissions(assignmentId);
    } catch (err) {
      setSubmissionsByAssignment((prev) => ({ ...prev, [assignmentId]: [] }));
      setSubmissionsError(err?.response?.data?.error || 'Failed to load submissions.');
    } finally {
      setLoadingSubmissionsId(null);
    }
  };

  const downloadSubmission = async (entry) => {
    setDownloadingSubmissionId(entry.id);
    setSubmissionsError('');

    try {
      const response = await api.get(`/assignments/submissions/${entry.id}/download`, { responseType: 'blob' });
      triggerBlobDownload(response, entry.file_name || `submission-${entry.id}`);
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
    setSubmissionsError('');
  };

  const persistGrading = async (shouldPublish) => {
    if (!gradingSubmission?.id || !openSubmissionsAssignmentId) return;
    setGradingSaving(true);
    setSubmissionsError('');
    try {
      await api.patch(`/assignments/submissions/${gradingSubmission.id}/grade`, {
        grade: gradeField,
        feedback: feedbackField,
        publish: shouldPublish
      });
      await loadSubmissions(openSubmissionsAssignmentId);
      setGradingSubmission(null);
      setMessage(shouldPublish ? 'Results published to student and gradebook.' : 'Draft grade saved.');
    } catch (err) {
      setSubmissionsError(err?.response?.data?.error || 'Failed to save grade.');
    } finally {
      setGradingSaving(false);
    }
  };

  const downloadAssignmentFile = async (assignment) => {
    setDownloadingAssignmentId(assignment.id);
    setMessage('');
    setError('');

    try {
      const response = await api.get(`/assignments/${assignment.id}/download`, { responseType: 'blob' });
      triggerBlobDownload(response, assignment.file_name || `assignment-${assignment.id}`);
    } catch (err) {
      setMessage(err?.response?.data?.error || 'Failed to download assignment file.');
    } finally {
      setDownloadingAssignmentId(null);
    }
  };

  const messageAlertType = message ? feedbackAlertType(message) : null;
  const activeAssignment = assignments.find((a) => a.id === openSubmissionsAssignmentId);

  return (
    <AssessmentShell wide={isLecturer}>
      <CoursePageFrame courseId={courseId} pageTitle="Assignments">
        <AssessmentPageHeader
          kicker={isLecturer ? 'Teaching · assessment' : 'Learning · assessment'}
          title="Assignments"
          lead={
            isLecturer
              ? 'Manage briefs, track submission progress, and complete grading in a structured workspace.'
              : 'View requirements, submit coursework, and read feedback once your lecturer releases results.'
          }
        />

        {loading && <AssessmentMeta>Loading assignments…</AssessmentMeta>}
        {error ? <AssessmentAlert type="error">{error}</AssessmentAlert> : null}
        {message && messageAlertType ? (
          <AssessmentAlert type={messageAlertType}>{message}</AssessmentAlert>
        ) : null}

        {isLecturer && lecturerSummary && assignments.length > 0 ? (
          <div className={dash.dashboard}>
            <div className={dash.summaryStrip}>
              <div className={dash.summaryCard}>
                <span className={dash.summaryValue}>{assignments.length}</span>
                <span className={dash.summaryLabel}>Assignments</span>
              </div>
              <div className={dash.summaryCard}>
                <span className={dash.summaryValue}>{lecturerSummary.total}</span>
                <span className={dash.summaryLabel}>Submissions</span>
              </div>
              <div className={dash.summaryCard}>
                <span className={dash.summaryValue}>{lecturerSummary.graded}</span>
                <span className={dash.summaryLabel}>Graded</span>
              </div>
              <div className={dash.summaryCard}>
                <span className={dash.summaryValue}>{lecturerSummary.pending}</span>
                <span className={dash.summaryLabel}>Pending review</span>
              </div>
            </div>
          </div>
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
                <p className={s.inlineHint}>Optional: attach a brief, rubric, or template for students.</p>
              </div>
              <div>
                <BtnPrimary type="submit" disabled={creatingAssignment}>
                  {creatingAssignment ? 'Creating…' : assignmentFile ? 'Create & upload' : 'Create assignment'}
                </BtnPrimary>
              </div>
            </form>
          </AssessmentCard>
        )}

        <AssessmentSectionTitle>{isLecturer ? 'Course assignments' : 'Your assignments'}</AssessmentSectionTitle>

        <AssessmentList>
          {assignments.map((assignment) => (
            <li key={assignment.id}>
              {isLecturer ? (
                <LecturerAssignmentCard
                  assignment={assignment}
                  stats={computeAssignmentStats(submissionsByAssignment[assignment.id] || [])}
                  submissions={submissionsByAssignment[assignment.id] || []}
                  queueOpen={openSubmissionsAssignmentId === assignment.id}
                  queueLoading={loadingSubmissionsId === assignment.id}
                  queueError={openSubmissionsAssignmentId === assignment.id ? submissionsError : ''}
                  downloadingSubmissionId={downloadingSubmissionId}
                  activeSubmissionId={gradingSubmission?.id}
                  onToggleQueue={() => toggleSubmissions(assignment.id)}
                  onOpenGrading={openGrading}
                  onDownloadSubmission={downloadSubmission}
                  onDownloadBrief={downloadAssignmentFile}
                  downloadingBrief={downloadingAssignmentId === assignment.id}
                />
              ) : (
                <StudentAssignmentCard
                  assignment={assignment}
                  file={submitFile[assignment.id]}
                  onFileChange={(f) => setSubmitFile((prev) => ({ ...prev, [assignment.id]: f }))}
                  uploadProgress={uploadProgress[assignment.id]}
                  submitting={submittingId === assignment.id}
                  deleting={deletingId === assignment.id}
                  onSubmit={() => submitAssignment(assignment.id)}
                  onDelete={() => deleteSubmission(assignment.id)}
                  onDownloadBrief={downloadAssignmentFile}
                  downloadingBrief={downloadingAssignmentId === assignment.id}
                  showConfirm={confirmId === assignment.id}
                />
              )}
            </li>
          ))}
        </AssessmentList>

        {!loading && assignments.length === 0 ? (
          <AssignmentsEmptyState isLecturer={isLecturer} title="No assignments yet" />
        ) : null}

        {gradingSubmission && activeAssignment ? (
          <GradingPanel
            submission={gradingSubmission}
            assignment={activeAssignment}
            grade={gradeField}
            feedback={feedbackField}
            publish={publishField}
            saving={gradingSaving}
            error={submissionsError}
            onGradeChange={setGradeField}
            onFeedbackChange={setFeedbackField}
            onPublishChange={setPublishField}
            onSaveDraft={() => persistGrading(false)}
            onPublish={() => persistGrading(true)}
            onClose={() => setGradingSubmission(null)}
            onDownload={downloadSubmission}
          />
        ) : null}
      </CoursePageFrame>
    </AssessmentShell>
  );
}
