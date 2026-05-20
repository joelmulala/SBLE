import React, { useEffect, useMemo, useState } from 'react';
import api from '../config/api';
import { useKeycloak } from '../auth/AuthProvider';
import {
  WorkspacePageShell,
  PageActions,
  DataTable,
  TableActions,
  Panel,
  Button,
  ConfirmDialog,
  SearchInput,
  FilterSelect
} from '../components/ui';
import StatusPill from '../components/ui/StatusPill';
import ui from '../components/ui/system.module.css';

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

function rolePillVariant(role) {
  if (role === 'admin') return 'admin';
  if (role === 'lecturer') return 'lecturer';
  return 'student';
}

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
  const [roleFilter, setRoleFilter] = useState('all');
  const [confirm, setConfirm] = useState(null);
  const [dirQuery, setDirQuery] = useState('');

  const isEditing = Boolean(editingId);
  const isLecturer = form.role === 'lecturer';
  const isStudent = form.role === 'student';

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

  const tableRows = useMemo(() => {
    let list = users;
    if (roleFilter !== 'all') list = list.filter((u) => u.role === roleFilter);
    return list;
  }, [users, roleFilter]);

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

  const runDelete = async (user) => {
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

  const runResetPassword = async (user) => {
    setError('');
    setMessage('');
    try {
      const res = await api.post(`/users/${user.id}/reset-password`);
      setMessage(
        res.data?.message
          ? `${res.data.message} (${user.full_name}: ${res.data?.default_password})`
          : `Default lecturer password for ${user.full_name}: ${res.data?.default_password}`
      );
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to reset password');
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (user) => (
        <div className={ui.cellStack}>
          <span className={ui.cellPrimary}>{user.full_name}</span>
          <span className={ui.cellMuted}>{user.email}</span>
        </div>
      )
    },
    {
      key: 'role',
      label: 'Role',
      render: (user) => (
        <StatusPill variant={rolePillVariant(user.role)}>{user.role}</StatusPill>
      )
    },
    {
      key: 'status',
      label: 'Status',
      hideOnMobile: true,
      render: (user) => (
        <StatusPill variant={user.is_active !== false ? 'active' : 'inactive'}>
          {user.is_active !== false ? 'Active' : 'Inactive'}
        </StatusPill>
      )
    },
    {
      key: 'detail',
      label: 'Details',
      hideOnMobile: true,
      render: (user) => {
        if (user.role === 'student') {
          return (
            <span className={ui.cellMuted}>
              {user.student_id || '—'}
              {user.program ? ` · ${user.program}` : ''}
            </span>
          );
        }
        if (user.role === 'lecturer') {
          return <span className={ui.cellMuted}>{user.institution || user.staff_email || '—'}</span>;
        }
        return <span className={ui.cellMuted}>—</span>;
      }
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (user) => (
        <TableActions>
          {user.role !== 'admin' ? (
            <Button type="button" variant="ghost" onClick={() => handleEdit(user)}>
              Edit
            </Button>
          ) : null}
          {user.role === 'lecturer' ? (
            <Button type="button" variant="ghost" onClick={() => runResetPassword(user)}>
              Reset password
            </Button>
          ) : null}
          {user.role !== 'admin' && user.id !== currentUserId ? (
            <Button
              type="button"
              variant="danger"
              onClick={() => setConfirm({
                title: 'Delete user',
                message: `Remove ${user.full_name} from the institution? This cannot be undone.`,
                danger: true,
                onConfirm: () => {
                  setConfirm(null);
                  runDelete(user);
                }
              })}
            >
              Delete
            </Button>
          ) : null}
        </TableActions>
      )
    }
  ];

  return (
    <WorkspacePageShell lead="Maintain lecturer and student accounts, roles, and institutional access defaults.">
      <PageActions
        search={(
          <SearchInput
            placeholder="Search directory by name or email…"
            value={dirQuery}
            onChange={(e) => setDirQuery(e.target.value)}
            aria-label="Search user directory"
          />
        )}
        filters={(
          <FilterSelect
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            aria-label="Filter by role"
          >
            <option value="all">All roles</option>
            <option value="lecturer">Lecturers</option>
            <option value="student">Students</option>
            <option value="admin">Admins</option>
          </FilterSelect>
        )}
        actions={(
          <>
            {isEditing ? (
              <Button type="button" variant="ghost" onClick={resetForm}>
                Cancel edit
              </Button>
            ) : null}
            <Button type="button" variant="primary" onClick={resetForm}>
              Add user
            </Button>
          </>
        )}
      />

      {message ? <div className={`${ui.notice} ${ui.noticeSuccess}`}>{message}</div> : null}
      {error ? <div className={`${ui.notice} ${ui.noticeError}`}>{error}</div> : null}

      <div className={ui.splitLayout}>
        <form onSubmit={handleSubmit} className={`${ui.panel} ${ui.formPanel}`}>
          <div className={ui.panelHeader}>
            <h2 className={ui.panelTitle}>{isEditing ? 'Edit user' : 'New user'}</h2>
            <p className={ui.panelLead}>Lecturers receive the configured default password when created.</p>
          </div>
          <div className={ui.panelBody}>
            <div className={ui.field}>
              <label htmlFor="user-full-name">Full name</label>
              <input
                id="user-full-name"
                className={ui.input}
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                required
              />
            </div>
            <div className={ui.field}>
              <label htmlFor="user-email">Email</label>
              <input
                id="user-email"
                type="email"
                className={ui.input}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <div className={ui.field}>
              <label htmlFor="user-role">Role</label>
              <select
                id="user-role"
                className={ui.select}
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                <option value="lecturer">Lecturer</option>
                <option value="student">Student</option>
              </select>
            </div>

            {isLecturer ? (
              <>
                <div className={ui.field}>
                  <label htmlFor="user-institution">Institution</label>
                  <input
                    id="user-institution"
                    className={ui.input}
                    value={form.institution}
                    onChange={(e) => setForm({ ...form, institution: e.target.value })}
                    required={isLecturer}
                  />
                </div>
                <div className={ui.field}>
                  <label htmlFor="user-staff-email">Staff email</label>
                  <input
                    id="user-staff-email"
                    type="email"
                    className={ui.input}
                    value={form.staff_email}
                    onChange={(e) => setForm({ ...form, staff_email: e.target.value })}
                    required={isLecturer}
                  />
                </div>
              </>
            ) : null}

            {isStudent ? (
              <>
                <div className={ui.field}>
                  <label htmlFor="user-student-id">Student ID</label>
                  <input
                    id="user-student-id"
                    className={ui.input}
                    value={form.student_id}
                    onChange={(e) => setForm({ ...form, student_id: e.target.value })}
                    required={isStudent}
                  />
                </div>
                <div className={ui.field}>
                  <label htmlFor="user-program">Program</label>
                  <input
                    id="user-program"
                    className={ui.input}
                    value={form.program}
                    onChange={(e) => setForm({ ...form, program: e.target.value })}
                    required={isStudent}
                  />
                </div>
                <div className={ui.fieldRow}>
                  <div className={ui.field}>
                    <label htmlFor="user-year">Year</label>
                    <input
                      id="user-year"
                      type="number"
                      className={ui.input}
                      value={form.year_of_study}
                      onChange={(e) => setForm({ ...form, year_of_study: e.target.value })}
                      required={isStudent}
                    />
                  </div>
                  <div className={ui.field}>
                    <label htmlFor="user-semester">Semester</label>
                    <input
                      id="user-semester"
                      type="number"
                      className={ui.input}
                      value={form.semester}
                      onChange={(e) => setForm({ ...form, semester: e.target.value })}
                      required={isStudent}
                    />
                  </div>
                </div>
                <div className={ui.field}>
                  <label htmlFor="user-mode">Mode</label>
                  <select
                    id="user-mode"
                    className={ui.select}
                    value={form.mode}
                    onChange={(e) => setForm({ ...form, mode: e.target.value })}
                  >
                    <option value="Full-time">Full-time</option>
                    <option value="Evening">Evening</option>
                    <option value="ODL">ODL</option>
                  </select>
                </div>
              </>
            ) : null}

            <label className={ui.checkboxRow}>
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              />
              Active account
            </label>

            <div className={ui.formActions}>
              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? 'Saving…' : isEditing ? 'Save changes' : 'Create user'}
              </Button>
            </div>
          </div>
        </form>

        <Panel
          title="Directory"
          lead={`${users.length} account${users.length === 1 ? '' : 's'}`}
          flush
        >
          <DataTable
            hideToolbar
            query={dirQuery}
            onQueryChange={setDirQuery}
            columns={columns}
            rows={tableRows}
            rowKey={(u) => u.id}
            loading={loading}
            searchFn={(user, q) => {
              const hay = `${user.full_name} ${user.email} ${user.student_id || ''} ${user.program || ''}`.toLowerCase();
              return hay.includes(q);
            }}
            emptyMessage="No users match your filters."
          />
        </Panel>
      </div>

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title}
        message={confirm?.message}
        danger={confirm?.danger}
        onConfirm={confirm?.onConfirm}
        onCancel={() => setConfirm(null)}
      />
    </WorkspacePageShell>
  );
}
