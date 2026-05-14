import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../config/api';
import {
  AssessmentShell,
  AssessmentPageHeader,
  AssessmentCard,
  AssessmentSectionTitle,
  AssessmentMeta,
  AssessmentAlert,
  AssessmentEmpty,
  BtnPrimary,
  Field,
  SelectInput,
  LinkPrimary,
  StatusBadge
} from '../../components/assessment/AssessmentPrimitives';
import s from '../../components/assessment/AssessmentPrimitives.module.css';

export default function LecturerQuizzesPage() {
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState([]);
  const [courses, setCourses] = useState([]);
  const [questionCounts, setQuestionCounts] = useState({});
  const [showCoursePicker, setShowCoursePicker] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError('');
      try {
        const [quizzesRes, coursesRes] = await Promise.all([
          api.get('/quizzes'),
          api.get('/courses')
        ]);

        const quizRows = Array.isArray(quizzesRes.data) ? quizzesRes.data : [];
        const courseRows = Array.isArray(coursesRes.data) ? coursesRes.data : [];

        setQuizzes(quizRows);
        setCourses(courseRows);

        const countEntries = await Promise.all(quizRows.map(async (quiz) => {
          try {
            const res = await api.get(`/quizzes/${quiz.id}/questions`);
            return [quiz.id, Array.isArray(res.data) ? res.data.length : 0];
          } catch (_) {
            return [quiz.id, Number(quiz.question_count) || 0];
          }
        }));

        setQuestionCounts(Object.fromEntries(countEntries));
      } catch (err) {
        setQuizzes([]);
        setCourses([]);
        setQuestionCounts({});
        setError(err?.response?.data?.error || 'Failed to load quizzes');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const courseNameById = useMemo(() => Object.fromEntries(
    courses.map((course) => [String(course.id), course.title])
  ), [courses]);

  const openQuizBuilder = () => {
    if (!selectedCourseId) {
      setError('Please select a course first.');
      return;
    }

    setError('');
    navigate(`/lecturer/courses/${selectedCourseId}/quizzes?create=1`);
  };

  return (
    <AssessmentShell wide>
      <AssessmentPageHeader
        kicker="Teaching · quizzes"
        title="All quizzes"
        lead="Scan publish state and question counts, then open a course to edit banks, timing, and attempt data."
        toolbar={(
          <BtnPrimary type="button" onClick={() => setShowCoursePicker((prev) => !prev)}>
            {showCoursePicker ? 'Close' : 'New quiz'}
          </BtnPrimary>
        )}
      />

      {error ? <AssessmentAlert type="error">{error}</AssessmentAlert> : null}
      {loading ? <AssessmentMeta>Loading quizzes…</AssessmentMeta> : null}

      {showCoursePicker && (
        <AssessmentCard>
          <AssessmentSectionTitle>Open quiz builder</AssessmentSectionTitle>
          <p className={s.inlineHint}>Pick the course context first. At least one question is required before saving.</p>
          <div className={s.formGrid} style={{ maxWidth: '28rem' }}>
            <Field label="Course">
              <SelectInput value={selectedCourseId} onChange={(e) => setSelectedCourseId(e.target.value)}>
                <option value="">Select course</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>{course.title}</option>
                ))}
              </SelectInput>
            </Field>
            <BtnPrimary type="button" onClick={openQuizBuilder}>Continue to course quizzes</BtnPrimary>
          </div>
        </AssessmentCard>
      )}

      <AssessmentSectionTitle>Directory</AssessmentSectionTitle>

      <div className={s.tableScroll}>
        <table className={s.table}>
          <thead>
            <tr>
              <th className={s.th}>Quiz</th>
              <th className={s.th}>Course</th>
              <th className={s.th}>Status</th>
              <th className={s.th}>Questions</th>
              <th className={s.th}>Workflow</th>
            </tr>
          </thead>
          <tbody>
            {quizzes.map((quiz) => (
              <tr key={quiz.id}>
                <td className={s.td}>
                  <span className={s.metaStrong}>{quiz.title}</span>
                </td>
                <td className={s.td}>{courseNameById[String(quiz.course_id)] || `Course #${quiz.course_id}`}</td>
                <td className={s.td}>
                  <StatusBadge variant={quiz.is_published ? 'success' : 'warning'}>
                    {quiz.is_published ? 'Published' : 'Draft'}
                  </StatusBadge>
                </td>
                <td className={s.td}>{questionCounts[quiz.id] ?? Number(quiz.question_count) ?? 0}</td>
                <td className={s.td}>
                  <LinkPrimary to={`/lecturer/courses/${quiz.course_id}/quizzes?draftQuizId=${quiz.id}`}>
                    Open course workspace
                  </LinkPrimary>
                </td>
              </tr>
            ))}
            {!loading && quizzes.length === 0 && (
              <tr>
                <td className={s.td} colSpan={5}>
                  <AssessmentEmpty>No quizzes yet.</AssessmentEmpty>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AssessmentShell>
  );
}
