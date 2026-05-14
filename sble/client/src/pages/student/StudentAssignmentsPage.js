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
  LinkPrimary
} from '../../components/assessment/AssessmentPrimitives';
import s from '../../components/assessment/AssessmentPrimitives.module.css';

export default function StudentAssignmentsPage() {
  const [courses, setCourses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError('');
      try {
        const [coursesRes, assignmentsRes] = await Promise.all([
          api.get('/courses'),
          api.get('/assignments')
        ]);

        setCourses(Array.isArray(coursesRes.data) ? coursesRes.data : []);
        setAssignments(Array.isArray(assignmentsRes.data) ? assignmentsRes.data : []);
      } catch (err) {
        setCourses([]);
        setAssignments([]);
        setError(resolveCourseAccessMessage(err, 'Failed to load assignments.'));
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const groupedAssignments = useMemo(() => {
    const visibleCourseIds = new Set(courses.map((course) => String(course.id)));
    return courses
      .map((course) => ({
        course,
        items: assignments.filter((item) => visibleCourseIds.has(String(item.course_id)) && String(item.course_id) === String(course.id))
      }))
      .filter((entry) => entry.items.length > 0);
  }, [courses, assignments]);

  return (
    <AssessmentShell wide>
      <AssessmentPageHeader
        kicker="Learning · assignments"
        title="Your assignments"
        lead="This hub lists briefs across enrolled courses. Open a course to upload files, track due dates, and read instructor feedback."
      />

      {error ? <AssessmentAlert type="error">{error}</AssessmentAlert> : null}
      {loading ? <AssessmentMeta>Loading assignments…</AssessmentMeta> : null}

      <div className={s.formGrid}>
        {groupedAssignments.map(({ course, items }) => (
          <AssessmentCard key={course.id} as="section">
            <div className={s.cardTitleRow}>
              <h3 className={s.cardTitle}>{course.title}</h3>
              <LinkPrimary to={`/student/courses/${course.id}/assignments`}>Go to course</LinkPrimary>
            </div>
            <ul style={{ listStyle: 'none', margin: '0.75rem 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {items.map((assignment) => (
                <li key={assignment.id} className={s.cardMuted} style={{ borderRadius: 10, padding: '0.65rem 0.75rem', border: '1px solid #e2e8f0' }}>
                  <p className={s.metaStrong} style={{ margin: 0 }}>{assignment.title}</p>
                  {assignment.description ? <p className={s.meta} style={{ margin: '0.35rem 0 0' }}>{assignment.description}</p> : null}
                  {assignment.due_date ? (
                    <p className={s.metaStrong} style={{ margin: '0.35rem 0 0', color: '#b45309' }}>
                      Due {new Date(assignment.due_date).toLocaleString()}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </AssessmentCard>
        ))}

        {!loading && !error && groupedAssignments.length === 0 ? (
          <AssessmentEmpty>No assignments in your enrolled courses.</AssessmentEmpty>
        ) : null}
      </div>
    </AssessmentShell>
  );
}
