import React, { useEffect, useState } from 'react';
import { useKeycloak } from '../../auth/AuthProvider';
import api from '../../config/api';
import {
  WorkspacePageShell,
  PageActions,
  DataTable,
  TableActions,
  Panel,
  Button,
  SearchInput
} from '../ui';
import ui from '../ui/system.module.css';

const emptyForm = {
  title: '',
  description: ''
};

export default function CourseManagementPage() {
  const { keycloak } = useKeycloak();
  const isAdmin = keycloak.hasRealmRole('admin');
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [tableQuery, setTableQuery] = useState('');

  const loadCourses = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/courses');
      setCourses(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to load courses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCourses();
  }, []);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (course) => {
    setEditingId(course.id);
    setForm({
      title: course.title || '',
      description: course.description || ''
    });
    setShowForm(true);
    setError('');
  };

  const saveCourse = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;

    setSaving(true);
    setError('');
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim()
      };

      if (editingId) {
        const res = await api.put(`/courses/${editingId}`, payload);
        setCourses((prev) => prev.map((course) => (course.id === editingId ? res.data : course)));
      } else {
        const res = await api.post('/courses', payload);
        setCourses((prev) => [res.data, ...prev]);
      }

      resetForm();
    } catch (err) {
      setError(err?.response?.data?.error || `Failed to ${editingId ? 'update' : 'create'} course`);
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      key: 'title',
      label: 'Course',
      render: (course) => (
        <div className={ui.cellStack}>
          <span className={ui.cellPrimary}>{course.title}</span>
          <span className={ui.cellMuted}>{course.description || 'No description'}</span>
        </div>
      )
    },
    {
      key: 'id',
      label: 'ID',
      hideOnMobile: true,
      render: (course) => <span className={ui.cellMuted}>{course.id}</span>
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (course) => (
        <TableActions>
          <Button type="button" variant="ghost" onClick={() => handleEdit(course)}>
            Edit
          </Button>
          <Button to={`/lecturer/courses/${course.id}`} variant="ghost">
            Open
          </Button>
          <Button to={`/lecturer/courses/${course.id}/enrollment`} variant="ghost">
            Enrollment
          </Button>
        </TableActions>
      )
    }
  ];

  return (
    <WorkspacePageShell
      lead={isAdmin
        ? 'Review and maintain the institution course catalog.'
        : 'Manage your assigned courses from one workspace.'}
    >
      <PageActions
        search={(
          <SearchInput
            placeholder="Search catalog…"
            value={tableQuery}
            onChange={(e) => setTableQuery(e.target.value)}
            aria-label="Search courses"
          />
        )}
        actions={(
          <Button
            type="button"
            variant="primary"
            onClick={() => {
              if (showForm && !editingId) resetForm();
              else {
                setForm(emptyForm);
                setEditingId(null);
                setShowForm(true);
              }
            }}
          >
            {showForm && !editingId ? 'Close form' : 'Create course'}
          </Button>
        )}
      />

      {error ? <div className={`${ui.notice} ${ui.noticeError}`}>{error}</div> : null}

      {showForm ? (
        <form onSubmit={saveCourse} className={ui.panel}>
          <div className={ui.panelHeader}>
            <h2 className={ui.panelTitle}>{editingId ? 'Edit course' : 'New course'}</h2>
          </div>
          <div className={ui.panelBody}>
            <div className={ui.field}>
              <label htmlFor="course-title">Title</label>
              <input
                id="course-title"
                className={ui.input}
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                required
              />
            </div>
            <div className={ui.field}>
              <label htmlFor="course-desc">Description</label>
              <textarea
                id="course-desc"
                className={ui.textarea}
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>
            <div className={ui.formActions}>
              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create course'}
              </Button>
              <Button type="button" variant="ghost" onClick={resetForm}>
                Cancel
              </Button>
            </div>
          </div>
        </form>
      ) : null}

      <Panel title="Catalog" lead={`${courses.length} course${courses.length === 1 ? '' : 's'}`} flush>
        <DataTable
          hideToolbar
          query={tableQuery}
          onQueryChange={setTableQuery}
          columns={columns}
          rows={courses}
          rowKey={(c) => c.id}
          loading={loading}
          searchPlaceholder="Search courses…"
          searchFn={(course, q) => {
            const hay = `${course.title} ${course.description || ''} ${course.id}`.toLowerCase();
            return hay.includes(q);
          }}
          emptyMessage="No courses found."
        />
      </Panel>
    </WorkspacePageShell>
  );
}
