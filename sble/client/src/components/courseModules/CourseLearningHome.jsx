import React, { useCallback, useEffect, useState } from 'react';
import api from '../../config/api';
import { AssessmentAlert, AssessmentMeta } from '../assessment/AssessmentPrimitives';
import { Button } from '../ui';
import ui from '../ui/system.module.css';
import CourseStructureView from './CourseStructureView';
import LecturerModuleBuilder from './LecturerModuleBuilder';
import CourseContextSidebar from '../workspace/CourseContextSidebar';
import s from './CourseModules.module.css';

export default function CourseLearningHome({
  courseId,
  course,
  isLecturer,
  embeddedInShell = false,
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

  const useCompactChrome = embeddedInShell;
  const showSidebarNav = !embeddedInShell;

  return (
    <div className={s.learningHome}>
      {useCompactChrome ? (
        <p className={ui.lead}>
          {isLecturer
            ? 'Organize modules, start live sessions, and guide students through this course.'
            : 'Follow the learning path below. Use the course sections above for materials, assignments, quizzes, exams, and grades.'}
        </p>
      ) : (
        <section className={`app-surface ${s.hero}`}>
          <div className="app-surface-body">
            <p className={s.heroKicker}>{isLecturer ? 'Course workspace' : 'Learning path'}</p>
            <h1 className={s.heroTitle}>{course?.title || `Course #${courseId}`}</h1>
            {course?.description ? <p className={s.heroLead}>{course.description}</p> : null}
            {course?.lecturer ? (
              <p className={s.heroMeta}>Lecturer: {course.lecturer.full_name}</p>
            ) : null}
          </div>
        </section>
      )}

      {isLecturer ? (
        <div className={s.lecturerToolbar}>
          <Button
            type="button"
            variant="primary"
            onClick={onStartLiveRoom}
            disabled={startingLiveRoom}
          >
            {startingLiveRoom ? 'Opening…' : 'Open live room'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setBuilderMode((v) => !v)}
          >
            {builderMode ? 'View learning path' : 'Organize modules'}
          </Button>
        </div>
      ) : null}

      {liveRoomError ? <div className={`${ui.notice} ${ui.noticeError}`}>{liveRoomError}</div> : null}
      {error ? <div className={`${ui.notice} ${ui.noticeError}`}>{error}</div> : null}
      {loading ? <AssessmentMeta>Loading course modules…</AssessmentMeta> : null}

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

          <CourseContextSidebar
            courseId={courseId}
            isLecturer={isLecturer}
            showNavLinks={showSidebarNav}
            showManageContent={showSidebarNav}
          />
        </div>
      )}
    </div>
  );
}
