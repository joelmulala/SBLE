import React, { useMemo } from 'react';
import PerformanceBarChart from './PerformanceBarChart';
import DistributionPieChart from './DistributionPieChart';
import { Panel } from '../ui';
import p from './Performance.module.css';

export default function PerformanceDashboard({ rows = [], assessmentMetrics = null }) {
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

  if (!rows.length) {
    return null;
  }

  return (
    <div className={p.analyticsGrid}>
      <Panel title="Weighted learner performance">
        <PerformanceBarChart data={rows} />
      </Panel>

      <Panel title="Quiz pass mix" lead="Submitted attempts">
        <DistributionPieChart
          title="Quiz pass mix"
          data={quizDistribution || distributionData}
        />
      </Panel>

      <Panel title="Assignment pass mix" lead="Released grades">
        <DistributionPieChart
          title="Assignment pass mix"
          data={assignmentDistribution || distributionData}
        />
      </Panel>
    </div>
  );
}
