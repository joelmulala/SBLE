import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../config/api';
import AssessmentWorkspace from '../../components/workspace/AssessmentWorkspace';
import CourseCommunicationHub from '../../components/communication/CourseCommunicationHub';
import ui from '../../components/ui/system.module.css';

export default function CourseCommunicationsPage() {
  const { courseId } = useParams();
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const loadCourse = async () => {
      if (!courseId) return;
      try {
        await api.get(`/courses/${courseId}`);
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
    <AssessmentWorkspace courseId={courseId}>
      <p className={ui.lead}>Announcements, discussions, and live session notices.</p>
      {error ? <div className={`${ui.notice} ${ui.noticeError}`}>{error}</div> : null}
      <CourseCommunicationHub courseId={courseId} />
    </AssessmentWorkspace>
  );
}
