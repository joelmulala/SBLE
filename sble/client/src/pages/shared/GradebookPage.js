import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../config/api';
import { useAssessmentRoles } from '../../assessment';
import AssessmentWorkspace from '../../components/workspace/AssessmentWorkspace';
import LecturerGradebookView from '../../components/gradebook/LecturerGradebookView';
import StudentGradesView from '../../components/gradebook/StudentGradesView';
import {
  PageActions,
  FilterSelect,
  LoadingState,
  EmptyState
} from '../../components/ui';
import ui from '../../components/ui/system.module.css';

export default function GradebookPage() {
  const { courseId: routeCourseId } = useParams();
  const { isLecturer, isStudent } = useAssessmentRoles();
  const [overview, setOverview] = useState(null);
  const [courseDetail, setCourseDetail] = useState(null);
  const [selectedCourseId, setSelectedCourseId] = useState(routeCourseId || '');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [studentBreakdown, setStudentBreakdown] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const activeCourseId = routeCourseId || selectedCourseId;

  useEffect(() => {
    if (routeCourseId) setSelectedCourseId(String(routeCourseId));
  }, [routeCourseId]);

  useEffect(() => {
    let cancelled = false;
    const loadOverview = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await api.get('/gradebook');
        const courses = Array.isArray(res.data?.courses) ? res.data.courses : [];
        if (!cancelled) {
          setOverview({ courses });
          const shouldAutoSelectCourse =
            !routeCourseId &&
            courses.length &&
            !selectedCourseId &&
            (isLecturer || (isStudent && courses.length === 1));
          if (shouldAutoSelectCourse) {
            setSelectedCourseId(String(courses[0].courseId));
          }
        }
      } catch (err) {
        if (!cancelled) {
          setOverview(null);
          setError(err?.response?.data?.error || 'Failed to load gradebook');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadOverview();
  }, [routeCourseId, isLecturer, isStudent]);

  useEffect(() => {
    if (!activeCourseId) {
      setCourseDetail(null);
      return undefined;
    }

    let cancelled = false;
    const loadCourse = async () => {
      setError('');
      try {
        const res = await api.get(`/gradebook/course/${activeCourseId}`);
        if (!cancelled) {
          setCourseDetail(res.data);
          if (isLecturer && res.data?.rows?.length) {
            setSelectedStudentId((prev) => prev || String(res.data.rows[0].userId));
          }
        }
      } catch (err) {
        if (!cancelled) {
          setCourseDetail(null);
          setError(err?.response?.data?.error || 'Failed to load course gradebook');
        }
      }
    };

    loadCourse();
    return () => { cancelled = true; };
  }, [activeCourseId, isLecturer]);

  useEffect(() => {
    if (!isLecturer || !activeCourseId || !selectedStudentId) {
      setStudentBreakdown(null);
      return undefined;
    }

    let cancelled = false;
    const loadBreakdown = async () => {
      try {
        const res = await api.get(`/gradebook/course/${activeCourseId}/student/${selectedStudentId}`);
        if (!cancelled) setStudentBreakdown(res.data?.student || null);
      } catch {
        if (!cancelled) setStudentBreakdown(null);
      }
    };

    loadBreakdown();
    return () => { cancelled = true; };
  }, [isLecturer, activeCourseId, selectedStudentId]);

  const courseOptions = useMemo(
    () => (overview?.courses || []).map((c) => ({
      id: String(c.courseId),
      title: c.courseTitle
    })),
    [overview]
  );

  const pageLead = isLecturer
    ? 'Review submissions, grading progress, and course outcomes at a glance.'
    : 'Your course performance, feedback, and completion progress in one place.';

  const showStudentOverview = isStudent && !activeCourseId && overview?.courses?.length > 1;

  const gradebookBody = (
    <>
      <p className={ui.lead}>{pageLead}</p>

      {isLecturer && !routeCourseId && courseOptions.length > 1 ? (
        <PageActions
          filters={(
            <FilterSelect
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className={ui.filterSelectWide}
              aria-label="Select course for gradebook"
            >
              {courseOptions.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </FilterSelect>
          )}
        />
      ) : null}

      {error ? <div className={`${ui.notice} ${ui.noticeError}`}>{error}</div> : null}

      {loading && !showStudentOverview && !courseDetail ? (
        <LoadingState label="Loading gradebook…" />
      ) : null}

      {!loading && !overview?.courses?.length ? (
        <EmptyState
          title="No performance data available"
          message={isStudent
            ? 'Enrolled courses with released grades will appear here.'
            : 'No courses available.'}
        />
      ) : null}

      {isLecturer && courseDetail ? (
        <LecturerGradebookView
          courseDetail={courseDetail}
          selectedStudentId={selectedStudentId}
          onSelectStudent={setSelectedStudentId}
          studentBreakdown={studentBreakdown}
        />
      ) : null}

      {isStudent ? (
        <StudentGradesView
          overview={overview}
          courseDetail={courseDetail}
          courseOptions={courseOptions}
          selectedCourseId={selectedCourseId}
          onCourseChange={setSelectedCourseId}
          routeCourseId={routeCourseId}
          loading={loading}
        />
      ) : null}
    </>
  );

  return (
    <AssessmentWorkspace courseId={routeCourseId || null}>
      {gradebookBody}
    </AssessmentWorkspace>
  );
}
