import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useKeycloak } from '../auth/AuthProvider';
import api from '../config/api';
import { buildFileUploadFormData, triggerBlobDownload } from '../utils/fileTransfer';

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
    const form = buildFileUploadFormData({
      file,
      courseId,
      title
    });
    try {
      const res = await api.post('/materials/upload', form);
      setMaterials((prev) => [res.data, ...prev]);
      setFile(null);
      setTitle('');
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
    } catch (_) {
      alert('Download failed');
    }
  };

  return (
    <div className="app-page">
      <div className="app-container app-stack">
      <section className="app-surface">
        <div className="app-surface-body">
          <p className="app-kicker">{isLecturer ? 'Course Delivery' : 'Course Study'}</p>
          <h1 className="page-title" style={{ marginTop: '0.35rem' }}>Learning Materials</h1>
        </div>
      </section>
      {loading && <p className="app-meta">Loading materials...</p>}
      {error && <p style={{ color: '#c0392b' }}>{error}</p>}

      {isLecturer && (
        <form onSubmit={handleUpload} className="app-surface app-surface-body" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Material title" required
            style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #ddd', flex: 1 }} />
          <input type="file" accept=".pdf,.doc,.docx,.jpg,.png" onChange={(e) => setFile(e.target.files?.[0] || null)} required />
          <button type="submit" disabled={uploading}
            style={{ background: '#4f8ef7', color: '#fff', padding: '8px 20px', borderRadius: 6, border: 'none', cursor: 'pointer' }}>
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </form>
      )}

      <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10, padding: 0 }}>
        {materials.map((material) => (
          <li key={material.id} className="app-surface app-surface-body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div>
              <strong>{material.file_name || material.title}</strong>
              <p style={{ color: '#666', marginTop: 4 }}>{material.title}</p>
              <p style={{ color: '#98a2b3', fontSize: '0.82rem', marginTop: 4 }}>
                Uploaded: {material.created_at ? new Date(material.created_at).toLocaleString() : 'Unknown date'}
              </p>
            </div>
            <button onClick={() => downloadMaterial(material.id, material.file_name)}
              style={{ color: '#4f8ef7', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>Download</button>
          </li>
        ))}
        {!loading && materials.length === 0 && <p style={{ color: '#888' }}>No materials uploaded yet.</p>}
      </ul>
      </div>
    </div>
  );
}

function resolveCourseAccessMessage(err, fallback) {
  const status = err?.response?.status;
  if (status === 403) return 'Access denied: you are not enrolled in this course.';
  if (status === 404) return 'This course does not exist or is no longer available.';
  return err?.response?.data?.error || fallback;
}
