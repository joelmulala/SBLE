import React from 'react';

const colors = {
  Passed: 'var(--color-accent-analytics-2)',
  Average: 'var(--color-accent-analytics-3)',
  Failed: 'var(--color-danger)'
};

export default function DistributionPieChart({ data = [], title }) {
  const total = data.reduce((sum, item) => sum + (item.value || 0), 0);

  if (!total) {
    return (
      <div>
        <h4 style={{ margin: 0 }}>{title}</h4>
        <p style={{ color: 'var(--color-text-muted)', marginTop: 12 }}>No distribution data available yet.</p>
      </div>
    );
  }

  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div>
      <h4 style={{ margin: 0 }}>{title}</h4>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
        <svg width="132" height="132" viewBox="0 0 132 132" aria-label={title}>
          <g transform="translate(66,66) rotate(-90)">
            {data.map((item) => {
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
                  stroke={colors[item.label] || 'var(--color-brand)'}
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

        <div style={{ display: 'grid', gap: 8 }}>
          {data.map((item) => {
            const percentage = total ? Math.round((item.value / total) * 100) : 0;
            return (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: colors[item.label] || 'var(--color-brand)', display: 'inline-block' }} />
                <span style={{ minWidth: 62 }}>{item.label}</span>
                <strong>{percentage}%</strong>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
