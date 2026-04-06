import React, { useEffect, useMemo, useState } from 'react';
import api from '../config/api';
import { useKeycloak } from '../auth/AuthProvider';

const cardStyle = {
  background: '#fff',
  borderRadius: 10,
  padding: 18,
  boxShadow: '0 1px 4px rgba(0,0,0,0.08)'
};

const emptyForm = {
  full_name: '',
  email: '',
  role: 'lecturer',
  student_id: '',
  program: '',
  year_of_study: '',
  semester: '',
  mode: 'Full-time',
  institution: '',
  staff_email: '',
  is_active: true
};

export default function Users() {
  const { keycloak } = useKeycloak();
  const currentUserId = keycloak.tokenParsed?.sub;
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const isEditing = Boolean(editingId);
  const isLecturer = form.role === 'lecturer';
  const isStudent = form.role === 'student';

  const sortedUsers = useMemo(() => users, [users]);

  const loadUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/users');
      setUsers(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const payload = {
        ...form,
        year_of_study: form.year_of_study === '' ? '' : Number(form.year_of_study),
        semester: form.semester === '' ? '' : Number(form.semester)
      };

      const res = isEditing
        ? await api.put(`/users/${editingId}`, payload)
        : await api.post('/users', payload);

      await loadUsers();
      const defaultPassword = res.data?.default_password;
      const roleLabel = form.role === 'lecturer' ? 'Lecturer' : 'User';
      setMessage(defaultPassword
        ? `${roleLabel} saved. Default password: ${defaultPassword}`
        : 'User information saved successfully.');
      resetForm();
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (user) => {
    setEditingId(user.id);
    setError('');
    setMessage('');
    setForm({
      full_name: user.full_name || '',
      email: user.email || '',
      role: user.role || 'lecturer',
      student_id: user.student_id || '',
      program: user.program || '',
      year_of_study: user.year_of_study || '',
      semester: user.semester || '',
      mode: user.mode || 'Full-time',
      institution: user.institution || '',
      staff_email: user.staff_email || '',
      is_active: user.is_active !== false
    });
  };

  const handleDelete = async (user) => {
    const confirmed = window.confirm(`Delete ${user.full_name}?`);
    if (!confirmed) return;

    setError('');
    setMessage('');
    try {
      await api.delete(`/users/${user.id}`);
      setMessage('User deleted successfully.');
      if (editingId === user.id) resetForm();
      await loadUsers();
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to delete user');
    }
  };

  const handleResetLecturerPassword = async (user) => {
    setError('');
    setMessage('');
    try {
      const res = await api.post(`/users/${user.id}/reset-password`);
      setMessage(`Default lecturer password for ${user.full_name}: ${res.data?.default_password}`);
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to fetch lecturer default password');
    }
  };

  return (
    <div>
      <h2>System Users</h2>
      <p style={{ color: '#666', marginTop: 6 }}>
        Admins can add, update, delete, and manage lecturer account defaults from here.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 420px) 1fr', gap: 18, marginTop: 18 }}>
        <form onSubmit={handleSubmit} style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>{isEditing ? 'Update User' : 'Add User'}</h3>

          <div style={{ display: 'grid', gap: 10 }}>
            <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Full name" required style={inputStyle} />
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" required style={inputStyle} />
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} style={inputStyle}>
              <option value="lecturer">Lecturer</option>
              <option value="student">Student</option>
            </select>

            {isLecturer && (
              <>
                <input value={form.institution} onChange={(e) => setForm({ ...form, institution: e.target.value })} placeholder="Institution" required={isLecturer} style={inputStyle} />
                <input type="email" value={form.staff_email} onChange={(e) => setForm({ ...form, staff_email: e.target.value })} placeholder="Staff email" required={isLecturer} style={inputStyle} />
              </>
            )}

            {isStudent && (
              <>
                <input value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })} placeholder="Student ID" required={isStudent} style={inputStyle} />
                <input value={form.program} onChange={(e) => setForm({ ...form, program: e.target.value })} placeholder="Program" required={isStudent} style={inputStyle} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <input type="number" value={form.year_of_study} onChange={(e) => setForm({ ...form, year_of_study: e.target.value })} placeholder="Year" required={isStudent} style={inputStyle} />
                  <input type="number" value={form.semester} onChange={(e) => setForm({ ...form, semester: e.target.value })} placeholder="Semester" required={isStudent} style={inputStyle} />
                </div>
                <select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })} style={inputStyle}>
                  <option value="Full-time">Full-time</option>
                  <option value="Evening">Evening</option>
                  <option value="ODL">ODL</option>
                </select>
              </>
            )}

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#555', fontSize: '0.92rem' }}>
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              Active account
            </label>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            <button type="submit" disabled={saving} style={primaryButtonStyle}>
              {saving ? 'Saving...' : isEditing ? 'Update User' : 'Create User'}
            </button>
            {isEditing && (
              <button type="button" onClick={resetForm} style={secondaryButtonStyle}>
                Cancel
              </button>
            )}
          </div>

          <p style={{ color: '#777', fontSize: '0.85rem', marginTop: 12 }}>
            Lecturer accounts use the configured default lecturer password for first login.
          </p>
        </form>

        <div style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>User Directory</h3>

          {message && <div style={{ ...noticeStyle, background: '#ecfdf3', color: '#027a48', border: '1px solid #abefc6' }}>{message}</div>}
          {error && <div style={{ ...noticeStyle, background: '#fef3f2', color: '#b42318', border: '1px solid #fecdca' }}>{error}</div>}
          {loading && <p>Loading users...</p>}

          <div style={{ display: 'grid', gap: 10 }}>
            {sortedUsers.map((user) => (
              <div key={user.id} style={{ border: '1px solid #edf1f7', borderRadius: 8, padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div>
                    <strong>{user.full_name}</strong>
                    <p style={{ margin: '4px 0 0', color: '#666', fontSize: '0.9rem' }}>{user.email}</p>
                    <p style={{ margin: '4px 0 0', color: '#888', fontSize: '0.84rem' }}>
                      Role: {user.role} {user.is_active ? '· Active' : '· Inactive'}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {user.role !== 'admin' && (
                      <button onClick={() => handleEdit(user)} style={secondaryButtonStyle}>Edit</button>
                    )}
                    {user.role === 'lecturer' && (
                      <button onClick={() => handleResetLecturerPassword(user)} style={accentButtonStyle}>Default Password</button>
                    )}
                    {user.role !== 'admin' && user.id !== currentUserId && (
                      <button onClick={() => handleDelete(user)} style={dangerButtonStyle}>Delete</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  padding: '9px 10px',
  borderRadius: 8,
  border: '1px solid #d9dce3'
};

const primaryButtonStyle = {
  background: '#4f8ef7',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  padding: '9px 14px',
  cursor: 'pointer',
  fontWeight: 600
};

const secondaryButtonStyle = {
  background: '#fff',
  color: '#344054',
  border: '1px solid #d0d5dd',
  borderRadius: 8,
  padding: '9px 12px',
  cursor: 'pointer'
};

const accentButtonStyle = {
  background: '#ecf2ff',
  color: '#1d4ed8',
  border: '1px solid #c7d7fe',
  borderRadius: 8,
  padding: '8px 10px',
  cursor: 'pointer'
};

const dangerButtonStyle = {
  background: '#fff1f2',
  color: '#b42318',
  border: '1px solid #fecdca',
  borderRadius: 8,
  padding: '8px 10px',
  cursor: 'pointer'
};

const noticeStyle = {
  borderRadius: 8,
  padding: '10px 12px',
  marginBottom: 12,
  fontSize: '0.92rem'
};
