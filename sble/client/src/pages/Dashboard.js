import React, { useEffect, useState } from 'react';
import { useKeycloak } from '../auth/AuthProvider';
import useAuthSync from '../hooks/useAuthSync';
import api from '../config/api';

export default function Dashboard() {
  const { keycloak } = useKeycloak();
  useAuthSync();

  const name = keycloak.tokenParsed?.name || 'User';
  const isLecturer = keycloak.hasRealmRole('lecturer') || keycloak.hasRealmRole('admin');
  const [stats, setStats] = useState({
    courses: 0,
    students: 0,
    assignments: 0,
    quizzesExams: 0,
    materials: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadSummary = async () => {
      setLoading(true);
      setError('');

      try {
        const [coursesRes, assignmentsRes, quizzesRes, materialsRes, examsRes] = await Promise.all([
          api.get('/courses'),
          api.get('/assignments').catch(() => ({ data: [] })),
          api.get('/quizzes').catch(() => ({ data: [] })),
          api.get('/materials').catch(() => ({ data: [] })),
          api.get('/exams').catch(() => ({ data: [] }))
        ]);

        const courses = Array.isArray(coursesRes.data) ? coursesRes.data : [];
        const assignments = Array.isArray(assignmentsRes.data) ? assignmentsRes.data : [];
        const quizzes = Array.isArray(quizzesRes.data) ? quizzesRes.data : [];
        const materials = Array.isArray(materialsRes.data) ? materialsRes.data : [];
        const exams = Array.isArray(examsRes.data) ? examsRes.data : [];

        const enrollmentResults = isLecturer
          ? await Promise.all(courses.map((course) => api.get(`/courses/${course.id}/enrollments`).catch(() => ({ data: [] }))))
          : [];

        const students = enrollmentResults.reduce((total, response) => {
          const rows = Array.isArray(response.data) ? response.data : [];
          return total + rows.length;
        }, 0);

        if (!cancelled) {
          setStats({
            courses: courses.length,
            students,
            assignments: assignments.length,
            quizzesExams: quizzes.length + exams.length,
            materials: materials.length
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.response?.data?.error || 'Failed to load dashboard summary.');
          setStats({ courses: 0, students: 0, assignments: 0, quizzesExams: 0, materials: 0 });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadSummary();
    return () => { cancelled = true; };
  }, [isLecturer]);

  return (
    <div>
      <h1>Welcome back, {name}</h1>
      <p style={{ color: '#888', marginTop: 6 }}>Dashboard overview</p>

      {error && <div style={{ ...noticeStyle, background: '#fef3f2', color: '#b42318', border: '1px solid #fecdca' }}>{error}</div>}
      {loading && <p style={{ marginTop: 18 }}>Loading dashboard...</p>}

      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginTop: 28 }}>
          <StatCard label="Total Courses" value={stats.courses} color="#4f8ef7" />
          <StatCard label="Total Students" value={isLecturer ? stats.students : 0} color="#16a085" />
          <StatCard label="Total Assignments" value={stats.assignments} color="#28a745" />
          <StatCard label="Total Quizzes/Exams" value={stats.quizzesExams} color="#e67e22" />
          <StatCard label="Total Materials" value={stats.materials} color="#8e44ad" />
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={{ background: '#fff', borderRadius: 10, padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: '1px solid #eef2f7', borderLeft: `4px solid ${color}`, minHeight: 110, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <p style={{ color: '#888', fontSize: '0.85rem', margin: 0 }}>{label}</p>
      <p style={{ fontSize: '2rem', fontWeight: 700, color, marginTop: 6, marginBottom: 0 }}>{value}</p>
    </div>
  );
}

const noticeStyle = {
  borderRadius: 8,
  padding: '10px 12px',
  marginTop: 14,
  fontSize: '0.92rem'
};
