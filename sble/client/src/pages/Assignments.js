import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useKeycloak } from '../auth/AuthProvider';
import api from '../config/api';

export default function Assignments() {
  const { id: courseId } = useParams();
  const { keycloak } = useKeycloak();
  const isLecturer = keycloak.hasRealmRole('lecturer') || keycloak.hasRealmRole('admin');

  const [assignments, setAssignments] = useState([]);
  const [form, setForm] = useState({ title: '', description: '', due_date: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitFile, setSubmitFile] = useState({});

  useEffect(() => {
    api.get(`/assignments/course/${courseId}`).then(r => setAssignments(r.data));
  }, [courseId]);

  const createAssignment = async (e) => {
    e.preventDefault();
    const res = await api.post('/assignments', { ...form, course_id: courseId });
    setAssignments(prev => [...prev, res.data]);
    setForm({ title: '', description: '', due_date: '' });
  };

  const submitAssignment = async (assignmentId) => {
    const file = submitFile[assignmentId];
    if (!file) return;
    setSubmitting(true);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('submission_type', 'scanned');
    try {
      await api.post(`/assignments/${assignmentId}/submit`, fd);
      alert('Submitted successfully');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h2>Assignments</h2>

      {isLecturer && (
        <form onSubmit={createAssignment} style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 480 }}>
          <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Title" required
            style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #ddd' }} />
          <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Description"
            style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #ddd', resize: 'vertical' }} />
          <input type="datetime-local" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })}
            style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #ddd' }} />
          <button type="submit" style={{ background: '#4f8ef7', color: '#fff', padding: '10px', borderRadius: 6, border: 'none', cursor: 'pointer' }}>
            Create Assignment
          </button>
        </form>
      )}

      <ul style={{ marginTop: 24, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {assignments.map(a => (
          <li key={a.id} style={{ background: '#fff', padding: 16, borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
            <h3>{a.title}</h3>
            <p style={{ color: '#666', marginTop: 4 }}>{a.description}</p>
            {a.due_date && <p style={{ color: '#aaa', fontSize: '0.85rem', marginTop: 4 }}>Due: {new Date(a.due_date).toLocaleString()}</p>}
            {!isLecturer && (
              <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
                <input type="file" accept=".pdf,.jpg,.png" onChange={e => setSubmitFile({ ...submitFile, [a.id]: e.target.files[0] })} />
                <button onClick={() => submitAssignment(a.id)} disabled={submitting}
                  style={{ background: '#28a745', color: '#fff', padding: '8px 16px', borderRadius: 6, border: 'none', cursor: 'pointer' }}>
                  {submitting ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            )}
          </li>
        ))}
        {assignments.length === 0 && <p style={{ color: '#888' }}>No assignments yet.</p>}
      </ul>
    </div>
  );
}
