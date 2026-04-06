import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../config/api';

export default function StudentMaterialsPage() {
  const [courses, setCourses] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError('');
      try {
        const [coursesRes, materialsRes] = await Promise.all([
          api.get('/courses'),
          api.get('/materials')
        ]);

        setCourses(Array.isArray(coursesRes.data) ? coursesRes.data : []);
        setMaterials(Array.isArray(materialsRes.data) ? materialsRes.data : []);
      } catch (err) {
        setCourses([]);
        setMaterials([]);
        setError(err?.response?.data?.error || 'Failed to load materials.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const groupedMaterials = useMemo(() => {
    const visibleCourseIds = new Set(courses.map((course) => String(course.id)));
    return courses
      .map((course) => ({
        course,
        items: materials.filter((item) => visibleCourseIds.has(String(item.course_id)) && String(item.course_id) === String(course.id))
      }))
      .filter((entry) => entry.items.length > 0);
  }, [courses, materials]);

  if (loading) return <p>Loading materials...</p>;

  return (
    <div>
      <h2>Materials</h2>
      <p style={{ color: '#666', marginTop: 6 }}>Materials from all your enrolled courses.</p>
      {error && <p style={{ color: '#c0392b', marginTop: 12 }}>{error}</p>}

      <div style={{ display: 'grid', gap: 14, marginTop: 18 }}>
        {groupedMaterials.map(({ course, items }) => (
          <section key={course.id} style={sectionStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0 }}>{course.title}</h3>
              <Link to={`/student/courses/${course.id}/materials`} style={linkButtonStyle}>Open Course Materials</Link>
            </div>

            <ul style={{ listStyle: 'none', padding: 0, marginTop: 12, display: 'grid', gap: 10 }}>
              {items.map((material) => (
                <li key={material.id} style={itemStyle}>
                  <strong>{material.file_name || material.title}</strong>
                  <div style={{ color: '#666', fontSize: '0.9rem', marginTop: 4 }}>{material.title}</div>
                </li>
              ))}
            </ul>
          </section>
        ))}

        {!error && groupedMaterials.length === 0 && (
          <p style={{ color: '#888' }}>No materials found in your enrolled courses.</p>
        )}
      </div>
    </div>
  );
}

const sectionStyle = {
  background: '#fff',
  borderRadius: 8,
  padding: 16,
  boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  border: '1px solid #eef2f7'
};

const itemStyle = {
  padding: '10px 12px',
  borderRadius: 8,
  background: '#f8fafc',
  border: '1px solid #eef2f7'
};

const linkButtonStyle = {
  display: 'inline-flex',
  textDecoration: 'none',
  background: '#4f8ef7',
  color: '#fff',
  borderRadius: 8,
  padding: '8px 12px',
  fontWeight: 600
};