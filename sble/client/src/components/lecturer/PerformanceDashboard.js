import React, { useMemo } from 'react';
import PerformanceBarChart from './PerformanceBarChart';
import DistributionPieChart from './DistributionPieChart';

const panelStyle = {
  background: '#fff',
  borderRadius: 10,
  padding: 18,
  boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  border: '1px solid #e7ecf5'
};

const categoryColor = {
  Green: '#2ecc71',
  Orange: '#f39c12',
  Red: '#e74c3c'
};

export default function PerformanceDashboard({ rows = [], loading = false, error = '' }) {

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

  return (
    <div>
      <h3>Performance Dashboard</h3>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
        {Object.entries(summary).map(([key, count]) => (
          <div key={key} style={{ ...panelStyle, padding: '10px 14px', borderLeft: `4px solid ${categoryColor[key]}` }}>
            <p style={{ margin: 0, color: '#666', fontSize: '0.85rem' }}>{key}</p>
            <p style={{ margin: 0, fontWeight: 700, fontSize: '1.2rem', color: categoryColor[key] }}>{count}</p>
          </div>
        ))}
      </div>

      {loading && <p style={{ marginTop: 12 }}>Loading performance...</p>}
      {error && <p style={{ marginTop: 12, color: '#c0392b' }}>{error}</p>}

      {!loading && !error && rows.length > 0 && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1.4fr) repeat(2, minmax(240px, 1fr))', gap: 12, marginTop: 12, alignItems: 'stretch' }}>
            <div style={{ ...panelStyle, height: '100%' }}>
              <h4 style={{ margin: 0 }}>Exam Performance</h4>
              <PerformanceBarChart data={rows} />
            </div>

            <div style={{ ...panelStyle, height: '100%' }}>
              <DistributionPieChart title="Quiz Results" data={distributionData} />
            </div>

            <div style={{ ...panelStyle, height: '100%' }}>
              <DistributionPieChart title="Assignment Results" data={distributionData} />
            </div>
          </div>

          <div style={{ ...panelStyle, marginTop: 12, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #eee', paddingBottom: 8 }}>Student ID</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #eee', paddingBottom: 8 }}>Average Score</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #eee', paddingBottom: 8 }}>Category</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.student_id}>
                    <td style={{ padding: '10px 0', borderBottom: '1px solid #f5f5f5' }}>{row.student_id}</td>
                    <td style={{ padding: '10px 0', borderBottom: '1px solid #f5f5f5' }}>{row.average_score}</td>
                    <td style={{ padding: '10px 0', borderBottom: '1px solid #f5f5f5', color: categoryColor[row.category] || '#555', fontWeight: 600 }}>
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
        <p style={{ marginTop: 12, color: '#777' }}>No performance data available</p>
      )}
    </div>
  );
}
