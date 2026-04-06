import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../config/api';
import EnrollmentPanel from '../../components/lecturer/EnrollmentPanel';

const cardStyle = {
  background: '#fff',
  borderRadius: 10,
  padding: 16,
  boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  border: '1px solid #e7ecf5'
};

export default function LecturerEnrollmentPage() {
  const navigate = useNavigate();
  const { courseId } = useParams();
  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState(courseId || '');
  const [enrollments, setEnrollments] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingEnrollments, setLoadingEnrollments] = useState(false);
  const [error, setError] = useState('');
  const [removingId, setRemovingId] = useState(null);

  useEffect(() => {
    setSelectedCourseId(courseId || '');
  }, [courseId]);

  useEffect(() => {
    const loadCourses = async () => {
      setLoadingCourses(true);
      setError('');
      try {
        const res = await api.get('/courses');
        setCourses(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        setCourses([]);
        setError(err?.response?.data?.error || 'Failed to load courses');
      } finally {
        setLoadingCourses(false);
      }
    };

    loadCourses();
  }, []);

  const fetchEnrollments = useCallback(async (targetCourseId = selectedCourseId) => {
    if (!targetCourseId) {
      setEnrollments([]);
      return;
    }

    setLoadingEnrollments(true);
    setError('');
    try {
      const res = await api.get(`/courses/${targetCourseId}/enrollments`);
      setEnrollments(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setEnrollments([]);
      setError(err?.response?.data?.error || 'Failed to load enrollments');
    } finally {
      setLoadingEnrollments(false);
    }
  }, [selectedCourseId]);

  useEffect(() => {
    fetchEnrollments();
  }, [fetchEnrollments]);

  const selectedCourseName = useMemo(() => {
    const match = courses.find((course) => String(course.id) === String(selectedCourseId));
    return match?.title || 'Selected course';
  }, [courses, selectedCourseId]);

  const handleCourseChange = (event) => {
    const nextCourseId = event.target.value;
    setSelectedCourseId(nextCourseId);

    if (!nextCourseId) {
      navigate('/lecturer/enrollment');
      return;
    }

    navigate(`/lecturer/courses/${nextCourseId}/enrollment`);
  };

  const handleRemove = async (entry) => {
    const studentIdentifier = entry.student?.student_id || entry.student_id;
    if (!selectedCourseId || !studentIdentifier) {
      return;
    }

    setRemovingId(entry.id);
    setError('');
    try {
      await api.delete(`/courses/${selectedCourseId}/enroll/${studentIdentifier}`);
      setEnrollments((prev) => prev.filter((item) => item.id !== entry.id));
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to remove student');
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div>
      <h2>Enrollment Management</h2>
      <p style={{ color: '#666', marginTop: 6 }}>Select a course to manage enrolled students.</p>

      <div style={{ ...cardStyle, marginTop: 18 }}>
        <label htmlFor="enrollment-course-selector" style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>
          Course Selector
        </label>
        <select
          id="enrollment-course-selector"
          value={selectedCourseId}
          onChange={handleCourseChange}
          style={{ width: '100%', maxWidth: 360, padding: '10px 12px', borderRadius: 8, border: '1px solid #d0d5dd', background: '#fff' }}
        >
          <option value="">Select course</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>{course.title}</option>
          ))}
        </select>
        {loadingCourses && <p style={{ marginTop: 10, color: '#666' }}>Loading courses...</p>}
      </div>

      {error && <p style={{ color: '#c0392b', marginTop: 12 }}>{error}</p>}

      {!selectedCourseId && !loadingCourses && (
        <div style={{ ...cardStyle, marginTop: 18 }}>
          <p style={{ margin: 0, color: '#555' }}>Please select a course to view and manage enrollments.</p>
        </div>
      )}

      {selectedCourseId && (
        <>
          <div style={{ marginTop: 20 }}>
            <EnrollmentPanel courseId={selectedCourseId} onEnrollmentChange={() => fetchEnrollments(selectedCourseId)} />
          </div>

          <div style={{ ...cardStyle, marginTop: 18, overflowX: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
              <strong>{selectedCourseName} Enrollments</strong>
              <span style={{ color: '#666', fontSize: '0.9rem' }}>{enrollments.length} student{enrollments.length === 1 ? '' : 's'}</span>
            </div>

            {loadingEnrollments ? (
              <p style={{ color: '#666', margin: 0 }}>Loading enrolled students...</p>
            ) : enrollments.length === 0 ? (
              <p style={{ color: '#888', margin: 0 }}>No students enrolled yet.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={headerCellStyle}>Student ID</th>
                    <th style={headerCellStyle}>Name</th>
                    <th style={headerCellStyle}>Program</th>
                    <th style={headerCellStyle}>Year</th>
                    <th style={headerCellStyle}>Mode</th>
                    <th style={headerCellStyle}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {enrollments.map((entry) => (
                    <tr key={entry.id}>
                      <td style={cellStyle}>{entry.student?.student_id || entry.student_id || '—'}</td>
                      <td style={cellStyle}>{entry.student?.full_name || entry.student?.email || 'Unknown student'}</td>
                      <td style={cellStyle}>{entry.student?.program || '—'}</td>
                      <td style={cellStyle}>{entry.student?.year_of_study || '—'}</td>
                      <td style={cellStyle}>{entry.student?.mode || '—'}</td>
                      <td style={cellStyle}>
                        <button
                          type="button"
                          onClick={() => handleRemove(entry)}
                          disabled={removingId === entry.id}
                          style={removeButtonStyle}
                        >
                          {removingId === entry.id ? 'Removing...' : 'Remove'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}

const headerCellStyle = {
  textAlign: 'left',
  padding: '10px 12px',
  borderBottom: '1px solid #e5e7eb',
  color: '#475467',
  fontSize: '0.85rem'
};

const cellStyle = {
  padding: '10px 12px',
  borderBottom: '1px solid #f2f4f7',
  color: '#344054',
  fontSize: '0.9rem'
};

const removeButtonStyle = {
  background: '#fff',
  color: '#b42318',
  border: '1px solid #fecdca',
  borderRadius: 6,
  padding: '6px 10px',
  cursor: 'pointer',
  fontWeight: 600
};
