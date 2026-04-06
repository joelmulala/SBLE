import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../config/api';

export default function StudentAssignmentsPage() {
  const [courses, setCourses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError('');
      try {
        const [coursesRes, assignmentsRes] = await Promise.all([
          api.get('/courses'),
          api.get('/assignments')
        ]);

        setCourses(Array.isArray(coursesRes.data) ? coursesRes.data : []);
        setAssignments(Array.isArray(assignmentsRes.data) ? assignmentsRes.data : []);
      } catch (err) {
        setCourses([]);
        setAssignments([]);
        setError(err?.response?.data?.error || 'Failed to load assignments.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const groupedAssignments = useMemo(() => {
    const visibleCourseIds = new Set(courses.map((course) => String(course.id)));
    return courses
      .map((course) => ({
        course,
        items: assignments.filter((item) => visibleCourseIds.has(String(item.course_id)) && String(item.course_id) === String(course.id))
      }))
      .filter((entry) => entry.items.length > 0);
  }, [courses, assignments]);

  if (loading) return <p>Loading assignments...</p>;

  return (
    <div>
      <h2>Assignments</h2>
      <p style={{ color: '#666', marginTop: 6 }}>Assignments from all your enrolled courses.</p>
      {error && <p style={{ color: '#c0392b', marginTop: 12 }}>{error}</p>}

      <div style={{ display: 'grid', gap: 14, marginTop: 18 }}>
        {groupedAssignments.map(({ course, items }) => (
          <section key={course.id} style={sectionStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0 }}>{course.title}</h3>
              <Link to={`/student/courses/${course.id}/assignments`} style={linkButtonStyle}>Open Course Assignments</Link>
            </div>

            <ul style={{ listStyle: 'none', padding: 0, marginTop: 12, display: 'grid', gap: 10 }}>
              {items.map((assignment) => (
                <li key={assignment.id} style={itemStyle}>
                  <strong>{assignment.title}</strong>
                  {assignment.description && <div style={{ color: '#666', fontSize: '0.9rem', marginTop: 4 }}>{assignment.description}</div>}
                  {assignment.due_date && <div style={{ color: '#b54708', fontSize: '0.85rem', marginTop: 6 }}>Due: {new Date(assignment.due_date).toLocaleString()}</div>}
                </li>
              ))}
            </ul>
          </section>
        ))}

        {!error && groupedAssignments.length === 0 && (
          <p style={{ color: '#888' }}>No assignments found in your enrolled courses.</p>
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