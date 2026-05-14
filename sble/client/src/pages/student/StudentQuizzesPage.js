import React, { useEffect, useMemo, useState } from 'react';
import api from '../../config/api';
import { getQuizHubStudentSnapshot, resolveCourseAccessMessage } from '../../assessment';
import {
  AssessmentShell,
  AssessmentPageHeader,
  AssessmentCard,
  AssessmentMeta,
  AssessmentAlert,
  AssessmentEmpty,
  LinkPrimary,
  StatusBadge
} from '../../components/assessment/AssessmentPrimitives';
import s from '../../components/assessment/AssessmentPrimitives.module.css';

export default function StudentQuizzesPage() {
  const [courses, setCourses] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError('');
      try {
        const [coursesRes, quizzesRes] = await Promise.all([
          api.get('/courses'),
          api.get('/quizzes')
        ]);

        setCourses(Array.isArray(coursesRes.data) ? coursesRes.data : []);
        setQuizzes(Array.isArray(quizzesRes.data) ? quizzesRes.data : []);
      } catch (err) {
        setCourses([]);
        setQuizzes([]);
        setError(resolveCourseAccessMessage(err, 'Failed to load quizzes.'));
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const groupedQuizzes = useMemo(() => {
    const visibleCourseIds = new Set(courses.map((course) => String(course.id)));
    return courses
      .map((course) => ({
        course,
        items: quizzes.filter((item) => visibleCourseIds.has(String(item.course_id)) && String(item.course_id) === String(course.id))
      }))
      .filter((entry) => entry.items.length > 0);
  }, [courses, quizzes]);

  return (
    <AssessmentShell wide>
      <AssessmentPageHeader
        kicker="Learning · quizzes"
        title="Your quizzes"
        lead="See availability at a glance. Timed attempts, windows, and scores are managed in each course’s quiz workspace."
      />

      {error ? <AssessmentAlert type="error">{error}</AssessmentAlert> : null}
      {loading ? <AssessmentMeta>Loading quizzes…</AssessmentMeta> : null}

      <div className={s.formGrid}>
        {groupedQuizzes.map(({ course, items }) => (
          <AssessmentCard key={course.id} as="section">
            <div className={s.cardTitleRow}>
              <h3 className={s.cardTitle}>{course.title}</h3>
              <LinkPrimary to={`/student/courses/${course.id}/quizzes`}>Go to course</LinkPrimary>
            </div>
            <ul style={{ listStyle: 'none', margin: '0.75rem 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {items.map((quiz) => {
                const st = getQuizHubStudentSnapshot(quiz);
                return (
                  <li key={quiz.id} className={s.cardMuted} style={{ borderRadius: 10, padding: '0.65rem 0.75rem', border: '1px solid #e2e8f0' }}>
                    <p className={s.metaStrong} style={{ margin: 0 }}>{quiz.title}</p>
                    <div className={s.flexRow} style={{ marginTop: '0.45rem' }}>
                      <StatusBadge variant={st.badgeVariant}>{st.label}</StatusBadge>
                    </div>
                  </li>
                );
              })}
            </ul>
          </AssessmentCard>
        ))}

        {!loading && !error && groupedQuizzes.length === 0 ? (
          <AssessmentEmpty>No quizzes in your enrolled courses.</AssessmentEmpty>
        ) : null}
      </div>
    </AssessmentShell>
  );
}
