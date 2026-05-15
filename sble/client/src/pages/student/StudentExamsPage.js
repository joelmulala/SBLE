import React, { useEffect, useMemo, useState } from 'react';
import api from '../../config/api';
import { resolveCourseAccessMessage } from '../../assessment';
import {
  AssessmentShell,
  AssessmentPageHeader,
  AssessmentCard,
  AssessmentMeta,
  AssessmentAlert,
  AssessmentEmpty,
  StatusBadge,
  LinkPrimary
} from '../../components/assessment/AssessmentPrimitives';
import s from '../../components/assessment/AssessmentPrimitives.module.css';

export default function StudentExamsPage() {
  const [courses, setCourses] = useState([]);
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError('');
      try {
        const [coursesRes, examsRes] = await Promise.all([
          api.get('/courses'),
          api.get('/exams')
        ]);
        setCourses(Array.isArray(coursesRes.data) ? coursesRes.data : []);
        setExams(Array.isArray(examsRes.data) ? examsRes.data : []);
      } catch (err) {
        setCourses([]);
        setExams([]);
        setError(resolveCourseAccessMessage(err, 'Failed to load exams.'));
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const grouped = useMemo(() => {
    const visibleIds = new Set(courses.map((c) => String(c.id)));
    return courses.map((course) => ({
      course,
      items: exams.filter(
        (exam) => visibleIds.has(String(exam.course_id)) && String(exam.course_id) === String(course.id)
      )
    })).filter((group) => group.items.length > 0);
  }, [courses, exams]);

  return (
    <AssessmentShell>
      <AssessmentPageHeader
        kicker="Assessments"
        title="Exams"
        lead="Released exam papers across your enrolled courses."
      />

      {error ? <AssessmentAlert>{error}</AssessmentAlert> : null}
      {loading ? <AssessmentMeta>Loading exams...</AssessmentMeta> : null}

      {!loading && grouped.length === 0 ? (
        <AssessmentEmpty>No released exams yet.</AssessmentEmpty>
      ) : null}

      {grouped.map(({ course, items }) => (
        <AssessmentCard key={course.id}>
          <h2 className={s.sectionTitle}>{course.title}</h2>
          <ul className={s.list}>
            {items.map((exam) => (
              <li key={exam.id} className={s.queueItem}>
                <div>
                  <strong>{exam.title}</strong>
                  <AssessmentMeta>
                    {exam.scheduled_at ? `Scheduled: ${new Date(exam.scheduled_at).toLocaleString()}` : 'No schedule'}
                  </AssessmentMeta>
                </div>
                <div>
                  <StatusBadge variant={exam.is_released ? 'success' : 'warning'}>
                    {exam.is_released ? 'Released' : 'Locked'}
                  </StatusBadge>
                  {exam.is_released ? (
                    <div style={{ marginTop: '0.5rem' }}>
                      <LinkPrimary to={`/student/courses/${course.id}/exams`}>Open exam</LinkPrimary>
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </AssessmentCard>
      ))}
    </AssessmentShell>
  );
}
