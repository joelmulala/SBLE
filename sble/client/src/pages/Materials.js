import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useKeycloak } from '../auth/AuthProvider';
import api from '../config/api';
import { buildFileUploadFormData, triggerBlobDownload } from '../utils/fileTransfer';
import { Field, TextInput } from '../components/assessment/AssessmentPrimitives';
import AssessmentWorkspace from '../components/workspace/AssessmentWorkspace';
import {
  PageActions,
  Panel,
  Button,
  DataTable,
  TableActions,
  SearchInput,
  LoadingState
} from '../components/ui';
import ui from '../components/ui/system.module.css';

export default function Materials() {
  const { courseId } = useParams();
  const { keycloak } = useKeycloak();
  const isLecturer = keycloak.hasRealmRole('lecturer') || keycloak.hasRealmRole('admin');
  const isStudent = keycloak.hasRealmRole('student');

  const [materials, setMaterials] = useState([]);
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [tableQuery, setTableQuery] = useState('');

  useEffect(() => {
    const loadMaterials = async () => {
      setLoading(true);
      setError('');

      try {
        if (courseId && isStudent) {
          const coursesRes = await api.get('/courses');
          const visibleCourses = Array.isArray(coursesRes.data) ? coursesRes.data : [];
          const hasAccess = visibleCourses.some((course) => String(course.id) === String(courseId));

          if (!hasAccess) {
            setMaterials([]);
            setError('Access denied: you are not enrolled in this course or the course does not exist.');
            return;
          }
        }

        const endpoint = courseId ? `/materials/course/${courseId}` : '/materials';
        const res = await api.get(endpoint);
        setMaterials(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        setMaterials([]);
        setError(resolveCourseAccessMessage(err, 'Failed to load materials.'));
      } finally {
        setLoading(false);
      }
    };

    loadMaterials();
  }, [courseId, isStudent]);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file || !title || !courseId) return;
    setUploading(true);
    setError('');
    const form = buildFileUploadFormData({ file, courseId, title });
    try {
      const res = await api.post('/materials/upload', form);
      setMaterials((prev) => [res.data, ...prev]);
      setFile(null);
      setTitle('');
      setShowUpload(false);
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to upload material.');
    } finally {
      setUploading(false);
    }
  };

  const downloadMaterial = async (materialId, fileName) => {
    try {
      const response = await api.get(`/materials/${materialId}/download`, { responseType: 'blob' });
      triggerBlobDownload(response, fileName || `material-${materialId}`);
    } catch {
      setError('Download failed.');
    }
  };

  const columns = useMemo(() => [
    {
      key: 'title',
      label: 'Material',
      render: (material) => (
        <div className={ui.cellStack}>
          <span className={ui.cellPrimary}>{material.title || material.file_name}</span>
          <span className={ui.cellMuted}>{material.file_name || 'File'}</span>
        </div>
      )
    },
    {
      key: 'uploaded',
      label: 'Uploaded',
      hideOnMobile: true,
      render: (material) => (
        <span className={ui.cellMuted}>
          {material.created_at ? new Date(material.created_at).toLocaleString() : '—'}
        </span>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (material) => (
        <TableActions>
          <Button type="button" variant="primary" onClick={() => downloadMaterial(material.id, material.file_name)}>
            Download
          </Button>
        </TableActions>
      )
    }
  ], []);

  return (
    <AssessmentWorkspace courseId={courseId}>
      <p className={ui.lead}>
        {isLecturer
          ? 'Upload and organize course readings, files, and resources for students.'
          : 'Course readings and files organized with your learning path.'}
      </p>

      <PageActions
        search={(
          <SearchInput
            placeholder="Search materials…"
            value={tableQuery}
            onChange={(e) => setTableQuery(e.target.value)}
            aria-label="Search materials"
          />
        )}
        actions={isLecturer && courseId ? (
          <Button
            type="button"
            variant="primary"
            onClick={() => setShowUpload((prev) => !prev)}
          >
            {showUpload ? 'Close upload' : 'Upload material'}
          </Button>
        ) : null}
      />

      {error ? <div className={`${ui.notice} ${ui.noticeError}`}>{error}</div> : null}

      {isLecturer && showUpload && courseId ? (
        <Panel title="Upload material">
          <form onSubmit={handleUpload} className={ui.stackSection}>
            <Field label="Title">
              <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Material title" required />
            </Field>
            <div className={ui.field}>
              <label htmlFor="material-file">File</label>
              <input
                id="material-file"
                type="file"
                className={ui.input}
                accept=".pdf,.doc,.docx,.jpg,.png"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                required
              />
            </div>
            <div className={ui.formActions}>
              <Button type="submit" variant="primary" disabled={uploading}>
                {uploading ? 'Uploading…' : 'Upload'}
              </Button>
            </div>
          </form>
        </Panel>
      ) : null}

      <Panel
        title="Course materials"
        lead={loading ? '' : `${materials.length} file${materials.length === 1 ? '' : 's'}`}
        flush
      >
        {loading ? (
          <div className={ui.tableState}>
            <LoadingState label="Loading materials…" />
          </div>
        ) : (
          <DataTable
            hideToolbar
            query={tableQuery}
            onQueryChange={setTableQuery}
            columns={columns}
            rows={materials}
            rowKey={(m) => m.id}
            searchFn={(material, q) => {
              const hay = `${material.title} ${material.file_name}`.toLowerCase();
              return hay.includes(q);
            }}
            emptyMessage="No materials uploaded yet."
          />
        )}
      </Panel>
    </AssessmentWorkspace>
  );
}

function resolveCourseAccessMessage(err, fallback) {
  const status = err?.response?.status;
  if (status === 403) return 'Access denied: you are not enrolled in this course.';
  if (status === 404) return 'This course does not exist or is no longer available.';
  return err?.response?.data?.error || fallback;
}
