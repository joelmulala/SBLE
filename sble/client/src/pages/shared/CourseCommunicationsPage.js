import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../config/api';
import {
  AssessmentShell,
  AssessmentPageHeader,
  AssessmentMeta,
  AssessmentAlert
} from '../../components/assessment/AssessmentPrimitives';
import CourseCommunicationHub from '../../components/communication/CourseCommunicationHub';
import CoursePageFrame from '../../components/workspace/CoursePageFrame';

export default function CourseCommunicationsPage() {
  const { courseId } = useParams();
  const [courseTitle, setCourseTitle] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const loadCourse = async () => {
      if (!courseId) return;
      try {
        const res = await api.get(`/courses/${courseId}`);
        if (!cancelled) setCourseTitle(res.data?.title || '');
      } catch (err) {
        if (!cancelled) {
          setError(err?.response?.data?.error || 'Failed to load course');
        }
      }
    };
    loadCourse();
    return () => { cancelled = true; };
  }, [courseId]);

  return (
    <AssessmentShell>
      <CoursePageFrame courseId={courseId} pageTitle="Communication">
        <AssessmentPageHeader
          kicker="Course communication"
          title={courseTitle || 'Communication'}
          lead="Announcements, discussions, and live session notices."
        />
        {error ? <AssessmentAlert>{error}</AssessmentAlert> : null}
        <CourseCommunicationHub courseId={courseId} courseTitle={courseTitle} />
      </CoursePageFrame>
    </AssessmentShell>
  );
}
