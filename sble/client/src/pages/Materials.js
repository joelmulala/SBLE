import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useKeycloak } from '../auth/AuthProvider';
import api from '../config/api';
import { buildFileUploadFormData, triggerBlobDownload } from '../utils/fileTransfer';
import {
  AssessmentShell,
  AssessmentPageHeader,
  AssessmentCard,
  AssessmentSectionTitle,
  AssessmentAlert,
  AssessmentEmpty,
  AssessmentMeta,
  BtnPrimary,
  Field,
  TextInput
} from '../components/assessment/AssessmentPrimitives';
import CoursePageFrame from '../components/workspace/CoursePageFrame';

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
    const form = buildFileUploadFormData({ file, courseId, title });
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
      setError('Download failed.');
    }
  };

  return (
    <AssessmentShell>
      <CoursePageFrame courseId={courseId} pageTitle="Materials">
        <AssessmentPageHeader
          kicker={isLecturer ? 'Course delivery' : 'Course study'}
          title="Learning materials"
          lead="Course readings and files organized with your learning path."
        />

        {loading ? <AssessmentMeta>Loading materials...</AssessmentMeta> : null}
        {error ? <AssessmentAlert>{error}</AssessmentAlert> : null}

        {isLecturer && courseId ? (
          <AssessmentCard>
            <AssessmentSectionTitle>Upload material</AssessmentSectionTitle>
            <form onSubmit={handleUpload} style={{ display: 'grid', gap: 'var(--space-4)' }}>
              <Field label="Title">
                <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Material title" required />
              </Field>
              <Field label="File">
                <input type="file" accept=".pdf,.doc,.docx,.jpg,.png" onChange={(e) => setFile(e.target.files?.[0] || null)} required />
              </Field>
              <BtnPrimary type="submit" disabled={uploading}>{uploading ? 'Uploading...' : 'Upload'}</BtnPrimary>
            </form>
          </AssessmentCard>
        ) : null}

        {!loading && materials.length === 0 ? (
          <AssessmentEmpty>No materials uploaded yet.</AssessmentEmpty>
        ) : (
          <AssessmentCard>
            <AssessmentSectionTitle>Materials</AssessmentSectionTitle>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {materials.map((material) => (
                <li
                  key={material.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                    padding: 'var(--space-3)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)'
                  }}
                >
                  <div>
                    <strong>{material.title || material.file_name}</strong>
                    <AssessmentMeta>
                      {material.created_at ? new Date(material.created_at).toLocaleString() : ''}
                    </AssessmentMeta>
                  </div>
                  <BtnPrimary type="button" onClick={() => downloadMaterial(material.id, material.file_name)}>
                    Download
                  </BtnPrimary>
                </li>
              ))}
            </ul>
          </AssessmentCard>
        )}
      </CoursePageFrame>
    </AssessmentShell>
  );
}

function resolveCourseAccessMessage(err, fallback) {
  const status = err?.response?.status;
  if (status === 403) return 'Access denied: you are not enrolled in this course.';
  if (status === 404) return 'This course does not exist or is no longer available.';
  return err?.response?.data?.error || fallback;
}
