import React, { useCallback, useEffect, useState } from 'react';
import api from '../../config/api';
import {
  AssessmentAlert,
  AssessmentMeta
} from '../assessment/AssessmentPrimitives';
import CourseStructureView from './CourseStructureView';
import LecturerModuleBuilder from './LecturerModuleBuilder';
import CourseContextSidebar from '../workspace/CourseContextSidebar';
import s from './CourseModules.module.css';

export default function CourseLearningHome({
  courseId,
  course,
  isLecturer,
  onStartLiveRoom,
  startingLiveRoom,
  liveRoomError
}) {
  const rolePrefix = isLecturer ? 'lecturer' : 'student';
  const [structure, setStructure] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [builderMode, setBuilderMode] = useState(false);

  const loadStructure = useCallback(async () => {
    if (!courseId) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/courses/${courseId}/structure`);
      setStructure(res.data);
    } catch (err) {
      setStructure(null);
      setError(err?.response?.data?.error || 'Failed to load course structure');
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    loadStructure();
  }, [loadStructure]);

  return (
    <div className={s.learningHome}>
      <section className={`app-surface ${s.hero}`}>
        <div className="app-surface-body">
          <p className={s.heroKicker}>{isLecturer ? 'Course workspace' : 'Learning path'}</p>
          <h1 className={s.heroTitle}>{course?.title || `Course #${courseId}`}</h1>
          {course?.description ? <p className={s.heroLead}>{course.description}</p> : null}
          {course?.lecturer ? (
            <AssessmentMeta style={{ marginTop: 'var(--space-3)' }}>Lecturer: {course.lecturer.full_name}</AssessmentMeta>
          ) : null}
          {isLecturer ? (
            <div className={s.builderActions} style={{ marginTop: 'var(--space-4)' }}>
              <button
                type="button"
                className="app-button app-button--primary"
                onClick={onStartLiveRoom}
                disabled={startingLiveRoom}
              >
                {startingLiveRoom ? 'Opening...' : 'Open live room'}
              </button>
              <button
                type="button"
                className="app-button app-button--secondary"
                onClick={() => setBuilderMode((v) => !v)}
              >
                {builderMode ? 'View learning path' : 'Organize modules'}
              </button>
            </div>
          ) : null}
          {liveRoomError ? <AssessmentAlert>{liveRoomError}</AssessmentAlert> : null}
        </div>
      </section>

      {error ? <AssessmentAlert>{error}</AssessmentAlert> : null}
      {loading ? <AssessmentMeta>Loading course modules...</AssessmentMeta> : null}

      {!loading && (
        <div className={s.layout}>
          <main>
            {isLecturer && builderMode ? (
              <LecturerModuleBuilder
                courseId={courseId}
                structure={structure}
                onChanged={loadStructure}
              />
            ) : (
              <CourseStructureView
                structure={structure}
                rolePrefix={rolePrefix}
                courseId={courseId}
              />
            )}
          </main>

          <CourseContextSidebar courseId={courseId} isLecturer={isLecturer} />
        </div>
      )}
    </div>
  );
}
