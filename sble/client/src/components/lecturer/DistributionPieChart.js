import React from 'react';
import p from './Performance.module.css';

const SLICE_COLORS = {
  Passed: 'var(--color-accent-analytics-2)',
  Average: 'var(--color-accent-analytics-3)',
  Failed: 'var(--color-danger)'
};

function sliceColor(label, index) {
  if (SLICE_COLORS[label]) return SLICE_COLORS[label];
  const palette = [
    'var(--color-accent-analytics-2)',
    'var(--color-accent-analytics-3)',
    'var(--color-danger)',
    'var(--color-brand)'
  ];
  return palette[index % palette.length];
}

export default function DistributionPieChart({ data = [], title = 'Distribution' }) {
  const total = data.reduce((sum, item) => sum + (item.value || 0), 0);

  if (!total) {
    return <p className={p.chartEmpty}>No distribution data available yet.</p>;
  }

  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className={p.pieWrap}>
      <svg className={p.pieSvg} width="132" height="132" viewBox="0 0 132 132" aria-label={title}>
        <g transform="translate(66,66) rotate(-90)">
          {data.map((item, index) => {
            const value = item.value || 0;
            const sliceLength = total ? (value / total) * circumference : 0;
            const dashArray = `${sliceLength} ${circumference - sliceLength}`;
            const dashOffset = -offset;
            offset += sliceLength;

            return (
              <circle
                key={item.label}
                r={radius}
                cx="0"
                cy="0"
                fill="transparent"
                stroke={sliceColor(item.label, index)}
                strokeWidth="22"
                strokeDasharray={dashArray}
                strokeDashoffset={dashOffset}
              />
            );
          })}
          <circle r="30" cx="0" cy="0" fill="var(--color-surface)" />
        </g>
        <text x="66" y="60" textAnchor="middle" fontSize="20" fontWeight="700" fill="var(--color-text)">{total}</text>
        <text x="66" y="79" textAnchor="middle" fontSize="10" fill="var(--color-text-muted)">students</text>
      </svg>

      <div className={p.pieLegend}>
        {data.map((item, index) => {
          const percentage = total ? Math.round((item.value / total) * 100) : 0;
          return (
            <div key={item.label} className={p.pieLegendRow}>
              <span
                className={p.legendSwatch}
                style={{ background: sliceColor(item.label, index) }}
              />
              <span className={p.pieLegendLabel}>{item.label}</span>
              <strong className={p.pieLegendValue}>{percentage}%</strong>
            </div>
          );
        })}
      </div>
    </div>
  );
}
