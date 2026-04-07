import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
    quizzes: 0,
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
        const [coursesRes, assignmentsRes, quizzesRes, materialsRes] = await Promise.all([
          api.get('/courses'),
          api.get('/assignments').catch(() => ({ data: [] })),
          api.get('/quizzes').catch(() => ({ data: [] })),
          api.get('/materials').catch(() => ({ data: [] }))
        ]);

        const courses = Array.isArray(coursesRes.data) ? coursesRes.data : [];
        const assignments = Array.isArray(assignmentsRes.data) ? assignmentsRes.data : [];
        const quizzes = Array.isArray(quizzesRes.data) ? quizzesRes.data : [];
        const materials = Array.isArray(materialsRes.data) ? materialsRes.data : [];

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
            quizzes: quizzes.length,
            materials: materials.length
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.response?.data?.error || 'Failed to load dashboard summary.');
          setStats({ courses: 0, students: 0, assignments: 0, quizzes: 0, materials: 0 });
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

  const cards = [
    { label: 'Total Courses', value: stats.courses, color: '#2563eb', icon: '📚' },
    { label: 'Total Students', value: isLecturer ? stats.students : 0, color: '#0f766e', icon: '👥' },
    { label: 'Total Assignments', value: stats.assignments, color: '#16a34a', icon: '📝' },
    { label: 'Total Quizzes', value: stats.quizzes, color: '#d97706', icon: '🧪' },
    { label: 'Total Materials', value: stats.materials, color: '#7c3aed', icon: '📁' }
  ];

  const quickActions = [
    { label: 'Create Course', to: '/lecturer/courses', color: '#2563eb' },
    { label: 'Upload Material', to: '/lecturer/materials', color: '#7c3aed' },
    { label: 'Create Assignment', to: '/lecturer/assignments', color: '#16a34a' },
    { label: 'Create Quiz', to: '/lecturer/quizzes', color: '#d97706' }
  ];

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <h1 style={{ marginBottom: 6 }}>Welcome back, {name}</h1>
        <p style={{ color: '#667085', margin: 0 }}>
          {isLecturer ? 'Here is your teaching overview for SBLE.' : 'Here is your learning overview for SBLE.'}
        </p>
      </div>

      {error && <div style={{ ...noticeStyle, background: '#fef3f2', color: '#b42318', border: '1px solid #fecdca' }}>{error}</div>}
      {loading && <p style={{ marginTop: 18 }}>Loading dashboard...</p>}

      {!loading && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 16, marginTop: 24 }}>
            {cards.map((card) => (
              <StatCard key={card.label} {...card} />
            ))}
          </div>

          {isLecturer && (
            <section style={sectionStyle}>
              <div style={{ marginBottom: 14 }}>
                <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Quick Actions</h2>
                <p style={{ margin: '6px 0 0', color: '#667085' }}>Jump straight to your most common lecturer tasks.</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                {quickActions.map((action) => (
                  <Link key={action.label} to={action.to} style={{ ...actionLinkStyle, borderLeft: `4px solid ${action.color}` }}>
                    {action.label}
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, color, icon }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: '20px 22px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: '1px solid #eef2f7', borderLeft: `4px solid ${color}`, minHeight: 112, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <p style={{ color: '#667085', fontSize: '0.88rem', margin: 0 }}>{label}</p>
        <span style={{ fontSize: '1.2rem' }}>{icon}</span>
      </div>
      <p style={{ fontSize: '2rem', fontWeight: 700, color, margin: 0 }}>{value}</p>
    </div>
  );
}

const sectionStyle = {
  marginTop: 24,
  background: '#fff',
  borderRadius: 12,
  padding: '20px 22px',
  boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  border: '1px solid #eef2f7'
};

const actionLinkStyle = {
  display: 'flex',
  alignItems: 'center',
  minHeight: 48,
  padding: '12px 14px',
  borderRadius: 10,
  textDecoration: 'none',
  color: '#1f2937',
  fontWeight: 600,
  background: '#f8fafc',
  border: '1px solid #e5e7eb'
};

const noticeStyle = {
  borderRadius: 8,
  padding: '10px 12px',
  marginTop: 14,
  fontSize: '0.92rem'
};
