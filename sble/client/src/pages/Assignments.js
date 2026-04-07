import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useKeycloak } from '../auth/AuthProvider';
import api from '../config/api';
import { buildFileUploadFormData, triggerBlobDownload } from '../utils/fileTransfer';

export default function Assignments() {
  const { courseId } = useParams();
  const { keycloak } = useKeycloak();
  const isLecturer = keycloak.hasRealmRole('lecturer') || keycloak.hasRealmRole('admin');
  const isStudent = keycloak.hasRealmRole('student');

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

  return (
    <div>
      <h2>Assignments</h2>
      {loading && <p style={{ marginTop: 12, color: '#666' }}>Loading assignments...</p>}
      {error && <p style={{ marginTop: 12, color: '#c0392b' }}>{error}</p>}
      {message && <p style={{ marginTop: 12, color: message.toLowerCase().includes('failed') || message.toLowerCase().includes('passed') ? '#c0392b' : '#2c3e50' }}>{message}</p>}

      {isLecturer && (
        <form onSubmit={createAssignment} style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 480 }}>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title" required
            style={inputStyle} />
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description"
            style={{ ...inputStyle, resize: 'vertical' }} />
          <input type="datetime-local" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })}
            style={inputStyle} />
          <div style={{ display: 'grid', gap: 6 }}>
            <input
              type="file"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              onChange={(e) => setAssignmentFile(e.target.files?.[0] || null)}
            />
            <span style={{ color: '#667085', fontSize: '0.84rem' }}>
              Optional: attach the assignment file for students to download.
            </span>
          </div>
          <button type="submit" style={primaryButtonStyle} disabled={creatingAssignment}>
            {creatingAssignment ? 'Creating...' : assignmentFile ? 'Create & Upload Assignment' : 'Create Assignment'}
          </button>
        </form>
      )}

      <ul style={{ marginTop: 24, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12, padding: 0 }}>
        {assignments.map((assignment) => {
          const submission = assignment.mySubmission || null;
          const status = getAssignmentStatus(assignment);

          return (
            <li key={assignment.id} style={{ background: '#fff', padding: 16, borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
              <h3 style={{ marginTop: 0 }}>{assignment.title}</h3>
              <p style={{ color: '#666', marginTop: 4 }}>{assignment.description}</p>
              {assignment.due_date && <p style={{ color: '#98a2b3', fontSize: '0.85rem', marginTop: 4 }}>Due: {new Date(assignment.due_date).toLocaleString()}</p>}
              {assignment.file_name && (
                <div style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ color: '#475467', fontSize: '0.88rem' }}>Attached file: {assignment.file_name}</span>
                  <button
                    type="button"
                    onClick={() => downloadAssignmentFile(assignment.id, assignment.file_name)}
                    disabled={downloadingAssignmentId === assignment.id}
                    style={primaryButtonStyle}
                  >
                    {downloadingAssignmentId === assignment.id ? 'Downloading...' : 'Download Assignment'}
                  </button>
                </div>
              )}

              {isLecturer && (
                <div style={{ marginTop: 12 }}>
                  <button
                    type="button"
                    onClick={() => toggleSubmissions(assignment.id)}
                    style={secondaryButtonStyle}
                  >
                    {openSubmissionsAssignmentId === assignment.id ? 'Hide Submissions' : 'View Submissions'}
                  </button>

                  {openSubmissionsAssignmentId === assignment.id && (
                    <div style={{ marginTop: 12, borderTop: '1px solid #eef2f7', paddingTop: 12, display: 'grid', gap: 10 }}>
                      {submissionsError && <p style={{ color: '#c0392b', margin: 0 }}>{submissionsError}</p>}
                      {loadingSubmissionsId === assignment.id ? (
                        <p style={{ color: '#666', margin: 0 }}>Loading submissions...</p>
                      ) : (submissionsByAssignment[assignment.id] || []).length === 0 ? (
                        <p style={{ color: '#888', margin: 0 }}>No submissions yet</p>
                      ) : (
                        (submissionsByAssignment[assignment.id] || []).map((entry) => (
                          <div key={entry.id} style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                            <div>
                              <div style={{ fontWeight: 600 }}>{entry.student?.full_name || entry.student?.email || 'Unknown student'}</div>
                              <div style={{ color: '#667085', fontSize: '0.84rem', marginTop: 4 }}>
                                {entry.file_name || 'Submission file'}
                                {entry.submitted_at ? ` • Submitted ${new Date(entry.submitted_at).toLocaleString()}` : ''}
                              </div>
                              {entry.grade !== null && entry.grade !== undefined && (
                                <div style={{ color: '#16a34a', fontSize: '0.84rem', marginTop: 4 }}>Grade: {entry.grade}</div>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => downloadSubmission(entry.id, entry.file_name)}
                              disabled={downloadingSubmissionId === entry.id}
                              style={primaryButtonStyle}
                            >
                              {downloadingSubmissionId === entry.id ? 'Downloading...' : 'Download'}
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}

              {!isLecturer && (
                <>
                  <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ ...statusBadgeStyle, color: status.color, borderColor: status.borderColor }}>{status.label}</span>
                  </div>

                  {submission?.submitted_at && (
                    <div style={{ marginTop: 10, display: 'grid', gap: 4 }}>
                      <span style={{ color: '#667085', fontSize: '0.84rem' }}>
                        Submitted at {new Date(submission.submitted_at).toLocaleString()}
                      </span>
                      {submission.grade === null || submission.grade === undefined ? (
                        <span style={{ color: '#2563eb', fontSize: '0.84rem', fontWeight: 600 }}>Waiting for grading</span>
                      ) : (
                        <span style={{ color: '#16a34a', fontSize: '0.84rem', fontWeight: 600 }}>Graded: {submission.grade}</span>
                      )}
                    </div>
                  )}

                  <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.png,.doc,.docx"
                      onChange={(e) => setSubmitFile({ ...submitFile, [assignment.id]: e.target.files?.[0] || null })}
                      disabled={!status.canUpload}
                    />
                    <button
                      type="button"
                      onClick={() => submitAssignment(assignment.id)}
                      disabled={!status.canUpload || submittingId === assignment.id}
                      style={primaryButtonStyle}
                    >
                      {submittingId === assignment.id ? 'Uploading...' : status.uploadLabel}
                    </button>
                    {status.canDelete && submission?.id && (
                      <button
                        type="button"
                        onClick={() => deleteSubmission(assignment.id)}
                        disabled={deletingId === assignment.id}
                        style={secondaryButtonStyle}
                      >
                        {deletingId === assignment.id ? 'Deleting...' : 'Delete Submission'}
                      </button>
                    )}
                  </div>
                </>
              )}
            </li>
          );
        })}
        {!loading && assignments.length === 0 && <p style={{ color: '#888' }}>No assignments yet.</p>}
      </ul>
    </div>
  );
}

function resolveCourseAccessMessage(err, fallback) {
  const status = err?.response?.status;
  if (status === 403) return 'Access denied: you are not enrolled in this course.';
  if (status === 404) return 'This course does not exist or is no longer available.';
  return err?.response?.data?.error || fallback;
}

function getAssignmentStatus(assignment) {
  const submission = assignment?.mySubmission;
  const dueTime = assignment?.due_date ? new Date(assignment.due_date).getTime() : null;
  const isPastDue = dueTime ? Date.now() >= dueTime : false;

  if (submission?.grade !== null && submission?.grade !== undefined) {
    return {
      label: `Graded: ${submission.grade}`,
      color: '#16a34a',
      borderColor: '#bbf7d0',
      canUpload: false,
      canDelete: false,
      uploadLabel: 'Submitted'
    };
  }

  if (submission?.id) {
    return {
      label: 'Waiting for grading',
      color: '#2563eb',
      borderColor: '#bfdbfe',
      canUpload: !isPastDue,
      canDelete: !isPastDue,
      uploadLabel: isPastDue ? 'Upload Closed' : 'Resubmit'
    };
  }

  if (isPastDue) {
    return {
      label: 'Submission closed',
      color: '#b42318',
      borderColor: '#fecdca',
      canUpload: false,
      canDelete: false,
      uploadLabel: 'Upload Closed'
    };
  }

  return {
    label: 'Ready to submit',
    color: '#16a085',
    borderColor: '#b7eadf',
    canUpload: true,
    canDelete: false,
    uploadLabel: 'Upload Submission'
  };
}

const inputStyle = {
  padding: '8px 12px',
  borderRadius: 6,
  border: '1px solid #ddd'
};

const primaryButtonStyle = {
  background: '#4f8ef7',
  color: '#fff',
  padding: '8px 16px',
  borderRadius: 6,
  border: 'none',
  cursor: 'pointer'
};

const secondaryButtonStyle = {
  background: '#fff',
  color: '#b42318',
  padding: '8px 16px',
  borderRadius: 6,
  border: '1px solid #fecdca',
  cursor: 'pointer'
};

const statusBadgeStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  border: '1px solid',
  borderRadius: 999,
  padding: '4px 10px',
  fontSize: '0.82rem',
  fontWeight: 600
};
