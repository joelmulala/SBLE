import React from 'react';

const categoryColor = {
  Green: '#2ecc71',
  Orange: '#f39c12',
  Red: '#e74c3c'
};

export default function PerformanceBarChart({ data = [] }) {
  const maxScore = Math.max(100, ...data.map((item) => Number(item.average_score) || 0));

  if (!data.length) {
    return <p style={{ color: '#777', marginTop: 12 }}>No exam performance data yet.</p>;
  }

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, minHeight: 220, padding: '8px 0 0' }}>
        {data.map((item) => {
          const score = Number(item.average_score) || 0;
          const heightPercent = Math.max(6, (score / maxScore) * 100);
          const label = String(item.student_id || '').slice(-4) || 'N/A';
          const color = categoryColor[item.category] || '#4f8ef7';

          return (
            <div key={item.student_id} style={{ flex: 1, minWidth: 34, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.78rem', color: '#555', fontWeight: 600 }}>{score}</span>
              <div style={{ height: 180, width: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: '#f8fafc', borderRadius: 6 }}>
                <div
                  title={`${item.student_id}: ${score}`}
                  style={{
                    width: '70%',
                    height: `${heightPercent}%`,
                    background: color,
                    borderRadius: '6px 6px 0 0',
                    minHeight: 10
                  }}
                />
              </div>
              <span style={{ fontSize: '0.74rem', color: '#777' }}>{label}</span>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12, fontSize: '0.82rem' }}>
        <Legend color="#2ecc71" label="Green (>=70)" />
        <Legend color="#f39c12" label="Orange (50-69)" />
        <Legend color="#e74c3c" label="Red (<50)" />
      </div>
    </div>
  );
}

function Legend({ color, label }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#555' }}>
      <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block' }} />
      {label}
    </span>
  );
}
