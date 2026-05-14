import React, { useMemo } from 'react';
import PerformanceBarChart from './PerformanceBarChart';
import DistributionPieChart from './DistributionPieChart';

const panelStyle = {
  background: 'var(--color-surface)',
  borderRadius: 10,
  padding: 18,
  boxShadow: 'var(--shadow-soft)',
  border: '1px solid var(--color-border)'
};

const categoryColor = {
  Green: 'var(--color-accent-analytics-2)',
  Orange: 'var(--color-accent-analytics-3)',
  Red: 'var(--color-danger)'
};

export default function PerformanceDashboard({ rows = [], loading = false, error = '', assessmentMetrics = null }) {
  const summary = useMemo(() => {
    const counts = { Green: 0, Orange: 0, Red: 0 };
    rows.forEach((r) => {
      const category = r?.category;
      if (counts[category] !== undefined) counts[category] += 1;
    });
    return counts;
  }, [rows]);

  const distributionData = useMemo(() => ([
    { label: 'Passed', value: summary.Green || 0 },
    { label: 'Average', value: summary.Orange || 0 },
    { label: 'Failed', value: summary.Red || 0 }
  ]), [summary]);

  const quizDistribution = useMemo(() => {
    const m = assessmentMetrics;
    if (!m || typeof m.quiz_pass_count !== 'number') return null;
    const pass = m.quiz_pass_count || 0;
    const fail = m.quiz_fail_count || 0;
    if (pass + fail === 0) return [{ label: 'No completed attempts', value: 1 }];
    return [
      { label: `Pass (≥50%) — ${pass}`, value: pass },
      { label: `Below 50% — ${fail}`, value: fail }
    ];
  }, [assessmentMetrics]);

  const assignmentDistribution = useMemo(() => {
    const m = assessmentMetrics;
    if (!m || typeof m.assignment_pass_count !== 'number') return null;
    const pass = m.assignment_pass_count || 0;
    const fail = m.assignment_fail_count || 0;
    if (pass + fail === 0) return [{ label: 'No released grades', value: 1 }];
    return [
      { label: `Pass (≥50) — ${pass}`, value: pass },
      { label: `Below — ${fail}`, value: fail }
    ];
  }, [assessmentMetrics]);

  return (
    <div>
      <h3>Performance Dashboard</h3>

      {assessmentMetrics && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
          <div style={{ ...panelStyle, padding: '10px 14px' }}>
            <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.82rem' }}>Quiz attempts (submitted)</p>
            <p style={{ margin: '4px 0 0', fontWeight: 700 }}>{assessmentMetrics.quiz_completed_attempts ?? 0}</p>
            <p style={{ margin: '6px 0 0', color: 'var(--color-text-muted)', fontSize: '0.78rem' }}>
              Avg score: {assessmentMetrics.average_quiz_percent != null ? `${assessmentMetrics.average_quiz_percent}%` : '—'}
            </p>
          </div>
          <div style={{ ...panelStyle, padding: '10px 14px' }}>
            <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.82rem' }}>Assignment submissions</p>
            <p style={{ margin: '4px 0 0', fontWeight: 700 }}>{assessmentMetrics.assignment_submission_rows ?? 0}</p>
            <p style={{ margin: '6px 0 0', color: 'var(--color-text-muted)', fontSize: '0.78rem' }}>
              Released grades: {assessmentMetrics.assignment_grades_released ?? 0}
              {' · '}
              Avg: {assessmentMetrics.average_released_assignment_grade != null ? assessmentMetrics.average_released_assignment_grade : '—'}
            </p>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
        {Object.entries(summary).map(([key, count]) => (
          <div key={key} style={{ ...panelStyle, padding: '10px 14px', borderLeft: `4px solid ${categoryColor[key]}` }}>
            <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>{key}</p>
            <p style={{ margin: 0, fontWeight: 700, fontSize: '1.2rem', color: categoryColor[key] }}>{count}</p>
          </div>
        ))}
      </div>

      {loading && <p style={{ marginTop: 12 }}>Loading performance...</p>}
      {error && <p style={{ marginTop: 12, color: 'var(--color-danger)' }}>{error}</p>}

      {!loading && !error && rows.length > 0 && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1.4fr) repeat(2, minmax(240px, 1fr))', gap: 12, marginTop: 12, alignItems: 'stretch' }}>
            <div style={{ ...panelStyle, height: '100%' }}>
              <h4 style={{ margin: 0 }}>Weighted learner performance</h4>
              <PerformanceBarChart data={rows} />
            </div>

            <div style={{ ...panelStyle, height: '100%' }}>
              <DistributionPieChart title="Quiz pass mix (submitted attempts)" data={quizDistribution || distributionData} />
            </div>

            <div style={{ ...panelStyle, height: '100%' }}>
              <DistributionPieChart title="Assignment pass mix (released grades)" data={assignmentDistribution || distributionData} />
            </div>
          </div>

          <div style={{ ...panelStyle, marginTop: 12, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid var(--color-border)', paddingBottom: 8 }}>Student ID</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid var(--color-border)', paddingBottom: 8 }}>Average Score</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid var(--color-border)', paddingBottom: 8 }}>Category</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.student_id}>
                    <td style={{ padding: '10px 0', borderBottom: '1px solid var(--color-border)' }}>{row.student_id}</td>
                    <td style={{ padding: '10px 0', borderBottom: '1px solid var(--color-border)' }}>{row.average_score}</td>
                    <td style={{ padding: '10px 0', borderBottom: '1px solid var(--color-border)', color: categoryColor[row.category] || 'var(--color-text-muted)', fontWeight: 600 }}>
                      {row.category}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!loading && !error && rows.length === 0 && (
        <p style={{ marginTop: 12, color: 'var(--color-text-muted)' }}>No performance data available</p>
      )}
    </div>
  );
}
