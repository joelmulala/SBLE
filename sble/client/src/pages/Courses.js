import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useKeycloak } from '../auth/AuthProvider';
import api from '../config/api';
import {
  WorkspacePageShell,
  Button,
  LoadingState,
  EmptyState,
  StatusPill
} from '../components/ui';
import ui from '../components/ui/system.module.css';
import styles from './Courses.module.css';

export default function Courses() {
  const navigate = useNavigate();
  const { keycloak } = useKeycloak();
  const isLecturer = keycloak.hasRealmRole('lecturer') || keycloak.hasRealmRole('admin');
  const courseBasePath = isLecturer ? '/lecturer/courses' : '/student/courses';

  const [courses, setCourses] = useState([]);
  const [activeRooms, setActiveRooms] = useState([]);
  const [assignmentCountByCourse, setAssignmentCountByCourse] = useState({});
  const [quizCountByCourse, setQuizCountByCourse] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadCourses = async () => {
      setLoading(true);
      setError('');
      try {
        const [coursesRes, roomsRes, assignmentsRes, quizzesRes] = await Promise.all([
          api.get('/courses'),
          api.get('/rooms/active').catch(() => ({ data: [] })),
          api.get('/assignments').catch(() => ({ data: [] })),
          api.get('/quizzes').catch(() => ({ data: [] }))
        ]);
        const nextCourses = Array.isArray(coursesRes.data) ? coursesRes.data : [];
        const rooms = Array.isArray(roomsRes.data) ? roomsRes.data : [];
        const assignments = Array.isArray(assignmentsRes.data) ? assignmentsRes.data : [];
        const quizzes = Array.isArray(quizzesRes.data) ? quizzesRes.data : [];

        const nextAssignmentCount = assignments.reduce((acc, assignment) => {
          const key = String(assignment.course_id || assignment.courseId || '');
          if (!key) return acc;
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {});

        const nextQuizCount = quizzes.reduce((acc, quiz) => {
          const key = String(quiz.course_id || quiz.courseId || '');
          if (!key) return acc;
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {});

        setCourses(nextCourses);
        setActiveRooms(rooms);
        setAssignmentCountByCourse(nextAssignmentCount);
        setQuizCountByCourse(nextQuizCount);
      } catch (err) {
        setError(err?.response?.data?.error || 'Failed to load courses.');
      } finally {
        setLoading(false);
      }
    };

    loadCourses();
  }, []);

  const roomByCourseId = useMemo(() => {
    const map = {};
    activeRooms.forEach((room) => {
      const cid = String(room.courseId || room.course_id || '');
      const rid = room.roomId || room.room_id;
      if (cid && rid && !map[cid]) map[cid] = rid;
    });
    return map;
  }, [activeRooms]);

  const pageLead = isLecturer
    ? 'Courses you teach. Open a course to manage content, assessments, and live sessions.'
    : 'Your enrolled courses. Open a course to continue learning, submit work, and join live classes.';

  if (loading) {
    return (
      <WorkspacePageShell lead={pageLead}>
        <LoadingState label="Loading courses…" />
      </WorkspacePageShell>
    );
  }

  return (
    <WorkspacePageShell lead={pageLead}>
      {error ? <div className={`${ui.notice} ${ui.noticeError}`}>{error}</div> : null}

      {!error && courses.length === 0 ? (
        <EmptyState
          title={isLecturer ? 'No courses yet' : 'No enrolled courses'}
          message={isLecturer
            ? 'Courses you are assigned to teach will appear here.'
            : 'When you are enrolled in a course, it will appear here for you to open.'}
        />
      ) : null}

      {courses.length > 0 ? (
        <section className={styles.courseGrid} aria-label="Course list">
          {courses.map((course) => {
            const cid = String(course.id);
            const liveRoomId = roomByCourseId[cid];
            const assignmentCount = assignmentCountByCourse[cid] || 0;
            const quizCount = quizCountByCourse[cid] || 0;
            const coursePath = `${courseBasePath}/${course.id}`;

            return (
              <article key={course.id} className={styles.courseCard}>
                <div className={styles.cardHead}>
                  <h2 className={styles.title}>{course.title}</h2>
                  <span className={styles.courseCode}>CRS-{course.id}</span>
                </div>

                <p className={styles.meta}>
                  {course.lecturer?.full_name || 'Lecturer not assigned'}
                </p>

                {course.description ? (
                  <p className={styles.description}>{course.description}</p>
                ) : null}

                <div className={styles.signals}>
                  {liveRoomId ? (
                    <StatusPill variant="active">Live class in progress</StatusPill>
                  ) : (
                    <span className={styles.signalMuted}>No live session</span>
                  )}
                  {assignmentCount > 0 ? (
                    <span className={styles.signal}>
                      {assignmentCount} assignment{assignmentCount === 1 ? '' : 's'}
                    </span>
                  ) : null}
                  {quizCount > 0 ? (
                    <span className={styles.signal}>
                      {quizCount} {quizCount === 1 ? 'quiz' : 'quizzes'}
                    </span>
                  ) : null}
                </div>

                <div className={styles.cardActions}>
                  {liveRoomId ? (
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => navigate(`/room/${encodeURIComponent(liveRoomId)}`)}
                    >
                      Join live class
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant={liveRoomId ? 'ghost' : 'primary'}
                    onClick={() => navigate(coursePath)}
                  >
                    Open course
                  </Button>
                </div>
              </article>
            );
          })}
        </section>
      ) : null}
    </WorkspacePageShell>
  );
}
