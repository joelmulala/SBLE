import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../config/api';
import { useAssessmentRoles } from '../../assessment';
import {
  AssessmentShell,
  AssessmentPageHeader,
  AssessmentAlert,
  AssessmentEmpty,
  AssessmentMeta
} from '../../components/assessment/AssessmentPrimitives';
import LecturerGradebookView from '../../components/gradebook/LecturerGradebookView';
import StudentGradesView from '../../components/gradebook/StudentGradesView';
import CoursePageFrame from '../../components/workspace/CoursePageFrame';

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
          if (!routeCourseId && courses.length && !selectedCourseId && isLecturer) {
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
  }, [routeCourseId, isLecturer]);

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
      } catch (_) {
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

  const pageTitle = isLecturer ? 'Gradebook' : 'My grades';
  const pageLead = isLecturer
    ? 'Review submissions, grading progress, and course outcomes at a glance.'
    : 'Your course performance, feedback, and completion progress in one place.';

  const showStudentOverview = isStudent && !activeCourseId && overview?.courses?.length > 1;

  return (
    <AssessmentShell wide={isLecturer}>
      <CoursePageFrame courseId={routeCourseId} pageTitle="Gradebook">
      <AssessmentPageHeader
        kicker="Academic outcomes"
        title={pageTitle}
        lead={pageLead}
      />

      {error ? <AssessmentAlert>{error}</AssessmentAlert> : null}

      {loading && !showStudentOverview && !courseDetail ? (
        <AssessmentMeta>Loading...</AssessmentMeta>
      ) : null}

      {!loading && !overview?.courses?.length ? (
        <AssessmentEmpty>No courses available.</AssessmentEmpty>
      ) : null}

      {isLecturer && courseDetail ? (
        <LecturerGradebookView
          courseDetail={courseDetail}
          courseOptions={courseOptions}
          selectedCourseId={selectedCourseId}
          onCourseChange={setSelectedCourseId}
          routeCourseId={routeCourseId}
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
      </CoursePageFrame>
    </AssessmentShell>
  );
}
