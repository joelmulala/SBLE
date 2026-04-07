import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../config/api';
import MaterialsUploadPanel from '../../components/lecturer/MaterialsUploadPanel';

const cardStyle = {
  background: '#fff',
  borderRadius: 10,
  padding: 16,
  boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  border: '1px solid #e7ecf5'
};

export default function LecturerMaterialsPage() {
  const { courseId } = useParams();
  const isDetailRoute = Boolean(courseId);
  const [materials, setMaterials] = useState([]);
  const [courses, setCourses] = useState([]);
  const [showUploader, setShowUploader] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError('');
      try {
        const [materialsRes, coursesRes] = await Promise.all([
          api.get('/materials'),
          api.get('/courses')
        ]);

        setMaterials(Array.isArray(materialsRes.data) ? materialsRes.data : []);
        setCourses(Array.isArray(coursesRes.data) ? coursesRes.data : []);
      } catch (err) {
        setMaterials([]);
        setCourses([]);
        setError(err?.response?.data?.error || 'Failed to load materials');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const courseNameById = useMemo(() => Object.fromEntries(
    courses.map((course) => [String(course.id), course.title])
  ), [courses]);

  const visibleMaterials = useMemo(() => {
    if (!courseId) return materials;
    return materials.filter((material) => String(material.course_id) === String(courseId));
  }, [materials, courseId]);

  const handleUploaded = (material) => {
    setMaterials((prev) => [material, ...prev]);
    setShowUploader(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ marginBottom: 6 }}>Materials</h2>
          <p style={{ color: '#666', marginTop: 6 }}>
            {isDetailRoute ? 'Upload and manage materials for this course.' : 'View uploaded materials across your lecturer-managed courses.'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowUploader(true)}
          style={{ background: '#4f8ef7', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 14px', cursor: 'pointer', fontWeight: 600 }}
        >
          Upload Material
        </button>
      </div>

      {showUploader && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            display: 'grid',
            placeItems: 'center',
            padding: 16,
            zIndex: 1000
          }}
          onClick={() => setShowUploader(false)}
        >
          <div
            style={{ width: '100%', maxWidth: 620 }}
            onClick={(e) => e.stopPropagation()}
          >
            <MaterialsUploadPanel
              courseId={courseId}
              courses={courses}
              onUploaded={handleUploaded}
              onCancel={() => setShowUploader(false)}
            />
          </div>
        </div>
      )}

      {error && <p style={{ color: '#c0392b', marginTop: 12 }}>{error}</p>}
      {loading && <p style={{ marginTop: 12 }}>Loading materials...</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px,1fr))', gap: 14, marginTop: 18 }}>
        {visibleMaterials.map((material) => (
          <div key={material.id} style={cardStyle}>
            <strong>{material.title}</strong>
            <p style={{ color: '#666', fontSize: '0.88rem', marginTop: 6 }}>{material.file_name || 'Untitled file'}</p>
            <p style={{ color: '#555', fontSize: '0.85rem', marginTop: 8 }}>
              Course: {courseNameById[String(material.course_id)] || `Course #${material.course_id}`}
            </p>
          </div>
        ))}
      </div>

      {!loading && visibleMaterials.length === 0 && <p style={{ color: '#888', marginTop: 14 }}>No materials uploaded</p>}
    </div>
  );
}
