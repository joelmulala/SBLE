import React from 'react';
import p from './Performance.module.css';

const CATEGORY_BAR = {
  Green: p.barFillGreen,
  Orange: p.barFillOrange,
  Red: p.barFillRed
};

export default function PerformanceBarChart({ data = [] }) {
  const maxScore = Math.max(100, ...data.map((item) => Number(item.average_score) || 0));

  if (!data.length) {
    return <p className={p.chartEmpty}>No exam performance data yet.</p>;
  }

  return (
    <div className={p.barChart}>
      <div className={p.barRow} role="img" aria-label="Student weighted performance chart">
        {data.map((item) => {
          const score = Number(item.average_score) || 0;
          const heightPercent = Math.max(6, (score / maxScore) * 100);
          const label = String(item.student_id || '').slice(-4) || 'N/A';
          const fillClass = CATEGORY_BAR[item.category] || p.barFillDefault;

          return (
            <div key={item.student_id} className={p.barColumn}>
              <span className={p.barScore}>{score}</span>
              <div className={p.barTrack}>
                <div
                  className={`${p.barFill} ${fillClass}`}
                  title={`${item.student_id}: ${score}`}
                  style={{ '--bar-height': `${heightPercent}%` }}
                />
              </div>
              <span className={p.barLabel}>{label}</span>
            </div>
          );
        })}
      </div>

      <div className={p.chartLegend}>
        <Legend color="var(--color-accent-analytics-2)" label="Green (≥70)" />
        <Legend color="var(--color-accent-analytics-3)" label="Orange (50–69)" />
        <Legend color="var(--color-danger)" label="Red (<50)" />
      </div>
    </div>
  );
}

function Legend({ color, label }) {
  return (
    <span className={p.legendItem}>
      <span className={p.legendSwatch} style={{ background: color }} />
      {label}
    </span>
  );
}
