import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useKeycloak } from '../auth/AuthProvider';
import api from '../config/api';
import CourseViewPage from '../components/student/CourseViewPage';

export default function CourseDetail() {
  const params = useParams();
  const courseId = params.courseId || params.id;
  const { keycloak } = useKeycloak();
  const isLecturer = keycloak.hasRealmRole('lecturer') || keycloak.hasRealmRole('admin');
  const [course, setCourse] = useState(null);

  useEffect(() => {
    if (!isLecturer || !courseId) return;
    api.get(`/courses/${courseId}`).then((r) => setCourse(r.data)).catch(() => setCourse(null));
  }, [courseId, isLecturer]);

  if (!isLecturer) {
    return <CourseViewPage courseId={courseId} />;
  }

  const sections = [
    { label: 'Materials', path: 'materials', color: '#4f8ef7' },
    { label: 'Assignments', path: 'assignments', color: '#28a745' },
    { label: 'Quizzes', path: 'quizzes', color: '#e67e22' },
    { label: 'Exams', path: 'exams', color: '#dc3545' },
    { label: 'Performance', path: 'performance', color: '#7c3aed' }
  ];

  return (
    <div>
      <h2>{course?.title || `Course #${courseId}`}</h2>
      {course?.description && <p style={{ color: '#666', marginTop: 6 }}>{course.description}</p>}
      {course?.lecturer && <p style={{ color: '#aaa', fontSize: '0.85rem', marginTop: 4 }}>Lecturer: {course.lecturer.full_name}</p>}

      <div style={{ display: 'flex', gap: 12, marginTop: 28, flexWrap: 'wrap' }}>
        {sections.map((section) => (
          <Link
            key={section.path}
            to={`/lecturer/courses/${courseId}/${section.path}`}
            style={{ background: section.color, color: '#fff', padding: '14px 28px', borderRadius: 8, fontWeight: 600, fontSize: '0.95rem', minWidth: 120, textAlign: 'center' }}
          >
            {section.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
