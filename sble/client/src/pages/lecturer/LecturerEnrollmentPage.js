import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useKeycloak } from '../../auth/AuthProvider';
import api from '../../config/api';
import {
  WorkspacePageShell,
  PageActions,
  DataTable,
  TableActions,
  Panel,
  Button,
  ConfirmDialog,
  SearchInput,
  FilterSelect
} from '../../components/ui';
import EnrollmentPanel from '../../components/lecturer/EnrollmentPanel';
import ui from '../../components/ui/system.module.css';

export default function LecturerEnrollmentPage() {
  const navigate = useNavigate();
  const { keycloak } = useKeycloak();
  const { courseId } = useParams();
  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState(courseId || '');
  const [enrollments, setEnrollments] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingEnrollments, setLoadingEnrollments] = useState(false);
  const [error, setError] = useState('');
  const [removingId, setRemovingId] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [rosterQuery, setRosterQuery] = useState('');

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

  const runRemove = async (entry) => {
    const studentIdentifier = entry.student?.student_id || entry.student_id;
    if (!selectedCourseId || !studentIdentifier) return;

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

  const columns = [
    {
      key: 'studentId',
      label: 'Student ID',
      render: (entry) => entry.student?.student_id || entry.student_id || '—'
    },
    {
      key: 'name',
      label: 'Name',
      render: (entry) => (
        <div className={ui.cellStack}>
          <span className={ui.cellPrimary}>
            {entry.student?.full_name || entry.student?.email || 'Unknown'}
          </span>
          <span className={ui.cellMuted}>{entry.student?.email || ''}</span>
        </div>
      )
    },
    {
      key: 'program',
      label: 'Program',
      hideOnMobile: true,
      render: (entry) => entry.student?.program || '—'
    },
    {
      key: 'year',
      label: 'Year',
      hideOnMobile: true,
      render: (entry) => entry.student?.year_of_study || '—'
    },
    {
      key: 'mode',
      label: 'Mode',
      hideOnMobile: true,
      render: (entry) => entry.student?.mode || '—'
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (entry) => (
        <TableActions>
          <Button
            type="button"
            variant="danger"
            disabled={removingId === entry.id}
            onClick={() => setConfirm({
              title: 'Remove enrollment',
              message: `Remove ${entry.student?.full_name || 'this student'} from ${selectedCourseName}?`,
              danger: true,
              onConfirm: () => {
                setConfirm(null);
                runRemove(entry);
              }
            })}
          >
            {removingId === entry.id ? 'Removing…' : 'Remove'}
          </Button>
        </TableActions>
      )
    }
  ];

  return (
    <WorkspacePageShell lead="Select a course, add students, and maintain roster access.">
      <PageActions
        search={selectedCourseId ? (
          <SearchInput
            placeholder="Search roster…"
            value={rosterQuery}
            onChange={(e) => setRosterQuery(e.target.value)}
            aria-label="Search enrolled students"
          />
        ) : (
          <span className={ui.cellMuted}>Select a course to search the roster.</span>
        )}
        filters={(
          <FilterSelect
            id="enrollment-course-selector"
            className={ui.filterSelectWide}
            value={selectedCourseId}
            onChange={handleCourseChange}
            disabled={loadingCourses}
            aria-label="Course for enrollment"
          >
            <option value="">Select a course</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>{course.title}</option>
            ))}
          </FilterSelect>
        )}
      />

      {error ? <div className={`${ui.notice} ${ui.noticeError}`}>{error}</div> : null}

      {loadingCourses ? <p className={ui.emptyHint}>Loading courses…</p> : null}

      {!selectedCourseId && !loadingCourses ? (
        <p className={ui.emptyHint}>Choose a course to manage enrollments.</p>
      ) : null}

      {selectedCourseId ? (
        <>
          <EnrollmentPanel
            courseId={selectedCourseId}
            onEnrollmentChange={() => fetchEnrollments(selectedCourseId)}
          />

          <Panel
            title={selectedCourseName}
            lead={`${enrollments.length} student${enrollments.length === 1 ? '' : 's'} enrolled`}
            flush
          >
            <DataTable
              hideToolbar
              query={rosterQuery}
              onQueryChange={setRosterQuery}
              columns={columns}
              rows={enrollments}
              rowKey={(e) => e.id}
              loading={loadingEnrollments}
              searchFn={(entry, q) => {
                const hay = `${entry.student?.full_name} ${entry.student?.email} ${entry.student?.student_id}`.toLowerCase();
                return hay.includes(q);
              }}
              emptyMessage="No students enrolled yet."
            />
          </Panel>
        </>
      ) : null}

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title}
        message={confirm?.message}
        danger={confirm?.danger}
        onConfirm={confirm?.onConfirm}
        onCancel={() => setConfirm(null)}
      />
    </WorkspacePageShell>
  );
}
