import React, { useEffect, useState } from 'react';
import api from '../../config/api';
import { buildFileUploadFormData } from '../../utils/fileTransfer';

const panelStyle = {
  background: '#fff',
  borderRadius: 8,
  padding: 16,
  boxShadow: '0 1px 4px rgba(0,0,0,0.08)'
};

export default function MaterialsUploadPanel({ courseId, courses = [], onUploaded, onCancel }) {
  const [availableCourses, setAvailableCourses] = useState(courses);
  const [selectedCourseId, setSelectedCourseId] = useState(courseId || '');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);
  const [loadingCourses, setLoadingCourses] = useState(courses.length === 0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setSelectedCourseId(courseId || '');
  }, [courseId]);

  useEffect(() => {
    if (courses.length > 0) {
      setAvailableCourses(courses);
      setLoadingCourses(false);
      return;
    }

    const loadCourses = async () => {
      setLoadingCourses(true);
      try {
        const res = await api.get('/courses');
        setAvailableCourses(Array.isArray(res.data) ? res.data : []);
      } catch (_) {
        setAvailableCourses([]);
      } finally {
        setLoadingCourses(false);
      }
    };

    loadCourses();
  }, [courses]);

  const uploadMaterial = async (e) => {
    e.preventDefault();

    const normalizedCourseId = Number(selectedCourseId);

    if (!normalizedCourseId) {
      setError('Please select a valid course before uploading.');
      return;
    }

    if (!title.trim() || !file) {
      setError('Title and file are required.');
      return;
    }

    setUploading(true);
    setError('');
    try {
      const payloadPreview = {
        title: title.trim(),
        courseId: normalizedCourseId,
        fileName: file?.name || null
      };
      console.log('[MaterialsUploadPanel] Upload payload:', payloadPreview);

      const formData = buildFileUploadFormData({
        file,
        courseId: normalizedCourseId,
        title: title.trim()
      });

      const res = await api.post('/materials/upload', formData);
      onUploaded?.(res.data);
      setTitle('');
      setFile(null);
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to upload material');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <h3>Add Material</h3>

      <form onSubmit={uploadMaterial} style={{ ...panelStyle, marginTop: 10, display: 'grid', gap: 10 }}>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Material title"
            required
            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd' }}
          />
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Course</span>
          <select
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            required
            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', background: '#fff' }}
          >
            <option value="">Select course</option>
            {availableCourses.map((course) => (
              <option key={course.id} value={course.id}>{course.title}</option>
            ))}
          </select>
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>File</span>
          <input
            type="file"
            accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.png"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            required
          />
        </label>

        {loadingCourses && <p style={{ margin: 0, color: '#666' }}>Loading courses...</p>}
        {error && <p style={{ color: '#c0392b', margin: 0 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="submit"
            disabled={uploading || loadingCourses || !selectedCourseId}
            style={{ background: '#4f8ef7', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 12px', cursor: 'pointer' }}
          >
            {uploading ? 'Uploading...' : 'Upload Material'}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              style={{ background: '#fff', color: '#344054', border: '1px solid #d0d5dd', borderRadius: 6, padding: '8px 12px', cursor: 'pointer' }}
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
