import React, { useEffect, useState } from 'react';
import api from '../../config/api';
import { buildFileUploadFormData } from '../../utils/fileTransfer';

const cardStyle = {
  background: '#fff',
  borderRadius: 8,
  padding: 16,
  boxShadow: '0 1px 4px rgba(0,0,0,0.08)'
};

export default function AssignmentSubmissionPage({ courseId }) {
  const [assignments, setAssignments] = useState([]);
  const [files, setFiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const loadAssignments = async () => {
      if (!courseId) return;
      setLoading(true);
      try {
        const res = await api.get(`/assignments/course/${courseId}`);
        setAssignments(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        setMessage(err?.response?.data?.error || 'Failed to load assignments');
      } finally {
        setLoading(false);
      }
    };

    loadAssignments();
  }, [courseId]);

  const submit = async (assignmentId) => {
    const file = files[assignmentId];
    if (!file) {
      setMessage('Select a file before submitting.');
      return;
    }

    setSubmittingId(assignmentId);
    setMessage('');
    try {
      const formData = buildFileUploadFormData({
        file,
        courseId,
        fields: { submission_type: 'scanned' }
      });
      await api.post(`/assignments/${assignmentId}/submit`, formData);
      setMessage('Submission uploaded successfully.');
      setFiles((prev) => ({ ...prev, [assignmentId]: null }));
    } catch (err) {
      setMessage(err?.response?.data?.error || 'Failed to submit assignment');
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div>
      <h2>Assignment Submission</h2>

      {loading && <p>Loading assignments...</p>}
      {message && <p style={{ color: message.toLowerCase().includes('failed') ? '#c0392b' : '#2c3e50' }}>{message}</p>}

      <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
        {assignments.map((assignment) => (
          <div key={assignment.id} style={cardStyle}>
            <h3 style={{ marginTop: 0 }}>{assignment.title}</h3>
            <p style={{ color: '#666', marginTop: 4 }}>{assignment.description || 'No description'}</p>
            <p style={{ color: '#888', fontSize: '0.85rem', marginTop: 6 }}>
              {assignment.due_date ? `Due: ${new Date(assignment.due_date).toLocaleString()}` : 'No deadline'}
            </p>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10, alignItems: 'center' }}>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                onChange={(e) => setFiles((prev) => ({ ...prev, [assignment.id]: e.target.files?.[0] || null }))}
              />
              <button
                onClick={() => submit(assignment.id)}
                disabled={submittingId === assignment.id}
                style={{ background: '#4f8ef7', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 12px', cursor: 'pointer' }}
              >
                {submittingId === assignment.id ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>
        ))}

        {!loading && assignments.length === 0 && <p style={{ color: '#777' }}>No assignments available.</p>}
      </div>
    </div>
  );
}
