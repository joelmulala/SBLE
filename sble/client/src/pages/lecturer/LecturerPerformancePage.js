import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../config/api';
import CoursePageFrame from '../../components/workspace/CoursePageFrame';
import PerformanceDashboard from '../../components/lecturer/PerformanceDashboard';
import {
  WorkspacePageShell,
  PageActions,
  KpiStatGrid,
  StatCard,
  DataTable,
  FilterSelect,
  EmptyState,
  LoadingState,
  Panel
} from '../../components/ui';
import ui from '../../components/ui/system.module.css';
import p from '../../components/lecturer/Performance.module.css';

const CATEGORY_CLASS = {
  Green: p.categoryGreen,
  Orange: p.categoryOrange,
  Red: p.categoryRed
};

function formatPercent(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return `${Number(value)}%`;
}

export default function LecturerPerformancePage() {
  const navigate = useNavigate();
  const { courseId } = useParams();
  const isDetailRoute = Boolean(courseId);
  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState(courseId || '');
  const [performanceRows, setPerformanceRows] = useState([]);
  const [assessmentMetrics, setAssessmentMetrics] = useState(null);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [loading, setLoading] = useState(Boolean(courseId));
  const [error, setError] = useState('');
  const [rosterQuery, setRosterQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  useEffect(() => {
    setSelectedCourseId(courseId || '');
  }, [courseId]);

  useEffect(() => {
    const loadCourses = async () => {
      setCoursesLoading(true);
      try {
        const res = await api.get('/courses');
        setCourses(Array.isArray(res.data) ? res.data : []);
      } catch {
        setCourses([]);
      } finally {
        setCoursesLoading(false);
      }
    };

    loadCourses();
  }, []);

  useEffect(() => {
    const loadPerformance = async () => {
      if (!courseId) {
        setPerformanceRows([]);
        setAssessmentMetrics(null);
        setError('');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');
      try {
        const res = await api.get(`/courses/${courseId}/performance`);
        setPerformanceRows(Array.isArray(res.data?.performance) ? res.data.performance : []);
        setAssessmentMetrics(res.data?.assessment_metrics || null);
      } catch (err) {
        setPerformanceRows([]);
        setAssessmentMetrics(null);
        setError(err?.response?.data?.error || 'Failed to load performance data');
      } finally {
        setLoading(false);
      }
    };

    loadPerformance();
  }, [courseId]);

  const kpis = useMemo(() => {
    const m = assessmentMetrics;
    const avgCompletion = performanceRows.length
      ? performanceRows.reduce((sum, row) => sum + (Number(row.completionRate) || 0), 0) / performanceRows.length
      : null;

    return {
      courseAverage: m?.class_average != null ? formatPercent(m.class_average) : '—',
      participationRate: m?.pass_rate_percent != null ? formatPercent(m.pass_rate_percent) : '—',
      submissionCompletion: avgCompletion != null ? formatPercent(Math.round(avgCompletion)) : '—',
      activeStudents: m?.students_enrolled ?? performanceRows.length ?? '—',
      hints: {
        courseAverage: m?.average_quiz_percent != null
          ? `Quiz avg ${formatPercent(m.average_quiz_percent)}`
          : 'Weighted class average',
        participationRate: m?.quiz_pass_rate_percent != null
          ? `Quiz pass ${formatPercent(m.quiz_pass_rate_percent)}`
          : 'Students meeting pass threshold',
        submissionCompletion: m?.assignment_submission_rows != null
          ? `${m.assignment_submission_rows} submission rows`
          : 'Mean completion across roster',
        activeStudents: performanceRows.length
          ? `${performanceRows.length} with performance data`
          : 'Enrolled in course'
      }
    };
  }, [assessmentMetrics, performanceRows]);

  const filteredRows = useMemo(() => {
    if (categoryFilter === 'all') return performanceRows;
    return performanceRows.filter((row) => row.category === categoryFilter);
  }, [performanceRows, categoryFilter]);

  const handleCourseChange = (event) => {
    const nextCourseId = event.target.value;
    setSelectedCourseId(nextCourseId);

    if (!nextCourseId) {
      navigate('/lecturer/performance');
      return;
    }

    navigate(`/lecturer/courses/${nextCourseId}/performance`);
  };

  const columns = [
    {
      key: 'studentId',
      label: 'Student ID',
      render: (row) => <span className={ui.cellPrimary}>{row.student_id || row.studentId || '—'}</span>
    },
    {
      key: 'score',
      label: 'Average score',
      render: (row) => (
        <span className={ui.cellMuted}>{row.average_score != null ? row.average_score : '—'}</span>
      )
    },
    {
      key: 'completion',
      label: 'Completion',
      hideOnMobile: true,
      render: (row) => (
        <span className={ui.cellMuted}>
          {row.completionRate != null ? formatPercent(Math.round(row.completionRate)) : '—'}
        </span>
      )
    },
    {
      key: 'category',
      label: 'Category',
      render: (row) => (
        <span className={`${p.categoryLabel} ${CATEGORY_CLASS[row.category] || ''}`}>
          {row.category || '—'}
        </span>
      )
    }
  ];

  const courseSelector = (
    <FilterSelect
      id="performance-course-selector"
      className={ui.filterSelectWide}
      value={selectedCourseId}
      onChange={handleCourseChange}
      disabled={coursesLoading}
      aria-label="Select course for performance analytics"
    >
      <option value="">Select a course</option>
      {courses.map((course) => (
        <option key={course.id} value={course.id}>{course.title}</option>
      ))}
    </FilterSelect>
  );

  const pageBody = (
    <>
      <PageActions filters={courseSelector} />

      {error ? <div className={`${ui.notice} ${ui.noticeError}`}>{error}</div> : null}

      {coursesLoading && !isDetailRoute ? (
        <LoadingState label="Loading courses…" />
      ) : null}

      {!isDetailRoute && !coursesLoading ? (
        <EmptyState message="Select a course to view performance analytics." />
      ) : null}

      {isDetailRoute && loading ? (
        <LoadingState label="Loading performance analytics…" />
      ) : null}

      {isDetailRoute && !loading && !error && performanceRows.length === 0 ? (
        <EmptyState message="No performance data available for this course yet." />
      ) : null}

      {isDetailRoute && !loading && !error && performanceRows.length > 0 ? (
        <>
          <KpiStatGrid>
            <StatCard
              label="Course average"
              value={kpis.courseAverage}
              hint={kpis.hints.courseAverage}
            />
            <StatCard
              label="Participation rate"
              value={kpis.participationRate}
              hint={kpis.hints.participationRate}
            />
            <StatCard
              label="Submission completion"
              value={kpis.submissionCompletion}
              hint={kpis.hints.submissionCompletion}
            />
            <StatCard
              label="Active students"
              value={kpis.activeStudents}
              hint={kpis.hints.activeStudents}
            />
          </KpiStatGrid>

          <PerformanceDashboard
            rows={performanceRows}
            assessmentMetrics={assessmentMetrics}
          />

          <Panel
            title="Student roster"
            lead={`${filteredRows.length} student${filteredRows.length === 1 ? '' : 's'}`}
            flush
          >
            <DataTable
              query={rosterQuery}
              onQueryChange={setRosterQuery}
              searchPlaceholder="Search by student ID…"
              filterSlot={(
                <FilterSelect
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  aria-label="Filter by performance category"
                >
                  <option value="all">All categories</option>
                  <option value="Green">Green</option>
                  <option value="Orange">Orange</option>
                  <option value="Red">Red</option>
                </FilterSelect>
              )}
              columns={columns}
              rows={filteredRows}
              rowKey={(row) => row.student_id || row.studentId}
              searchFn={(row, q) => String(row.student_id || row.studentId || '').toLowerCase().includes(q)}
              emptyMessage="No students match your filters."
            />
          </Panel>
        </>
      ) : null}
    </>
  );

  if (isDetailRoute) {
    return (
      <CoursePageFrame courseId={courseId}>
        <p className={ui.lead}>
          Track student performance categories and assessment outcomes for this course.
        </p>
        {pageBody}
      </CoursePageFrame>
    );
  }

  return (
    <WorkspacePageShell lead="Select a course to view performance analytics and roster outcomes.">
      {pageBody}
    </WorkspacePageShell>
  );
}
