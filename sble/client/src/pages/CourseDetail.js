import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useKeycloak } from '../auth/AuthProvider';
import api from '../config/api';

export default function CourseDetail() {
  const { id } = useParams();
  const { keycloak } = useKeycloak();
  const isLecturer = keycloak.hasRealmRole('lecturer') || keycloak.hasRealmRole('admin');
  const [course, setCourse] = useState(null);

  useEffect(() => {
    api.get(`/courses/${id}`).then(r => setCourse(r.data)).catch(() => {});
  }, [id]);

  const sections = [
    { label: 'Materials', path: 'materials', color: '#4f8ef7' },
    { label: 'Assignments', path: 'assignments', color: '#28a745' },
    { label: 'Quizzes', path: 'quizzes', color: '#e67e22' },
    ...(isLecturer ? [{ label: 'Exams', path: 'exams', color: '#dc3545' }] : [])
  ];

  return (
    <div>
      <h2>{course?.title || `Course #${id}`}</h2>
      {course?.description && <p style={{ color: '#666', marginTop: 6 }}>{course.description}</p>}
      {course?.lecturer && <p style={{ color: '#aaa', fontSize: '0.85rem', marginTop: 4 }}>Lecturer: {course.lecturer.full_name}</p>}

      <div style={{ display: 'flex', gap: 12, marginTop: 28, flexWrap: 'wrap' }}>
        {sections.map(s => (
          <Link key={s.path} to={`/courses/${id}/${s.path}`}
            style={{ background: s.color, color: '#fff', padding: '14px 28px', borderRadius: 8, fontWeight: 600, fontSize: '0.95rem', minWidth: 120, textAlign: 'center' }}>
            {s.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
