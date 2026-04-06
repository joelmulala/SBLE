import React, { useEffect, useMemo, useState } from 'react';
import api from '../../config/api';

const panelStyle = {
  background: '#fff',
  borderRadius: 8,
  padding: 16,
  boxShadow: '0 1px 4px rgba(0,0,0,0.08)'
};

export default function ResultsView({ courseId }) {
  const [quizzes, setQuizzes] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!courseId) return;
      setLoading(true);
      setError('');
      try {
        const res = await api.get(`/quizzes/course/${courseId}`);
        setQuizzes(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        setError(err?.response?.data?.error || 'Failed to load quiz results');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [courseId]);

  const scoredRows = useMemo(() => {
    return quizzes
      .filter((q) => q.is_published)
      .map((quiz) => {
        const storedScore = localStorage.getItem(`quizScore:${quiz.id}`);
        return {
          id: quiz.id,
          title: quiz.title,
          score: storedScore !== null ? Number(storedScore) : null
        };
      });
  }, [quizzes]);

  return (
    <div>
      <h2>Results</h2>
      <p style={{ color: '#666', marginTop: 6 }}>
        Showing available quiz scores from completed attempts in this browser session.
      </p>

      {loading && <p style={{ marginTop: 12 }}>Loading results...</p>}
      {error && <p style={{ marginTop: 12, color: '#c0392b' }}>{error}</p>}

      {!loading && !error && (
        <div style={{ ...panelStyle, marginTop: 12 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #eee', paddingBottom: 8 }}>Quiz</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #eee', paddingBottom: 8 }}>Score</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #eee', paddingBottom: 8 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {scoredRows.map((row) => (
                <tr key={row.id}>
                  <td style={{ padding: '10px 0', borderBottom: '1px solid #f5f5f5' }}>{row.title}</td>
                  <td style={{ padding: '10px 0', borderBottom: '1px solid #f5f5f5' }}>{row.score ?? '-'}</td>
                  <td style={{ padding: '10px 0', borderBottom: '1px solid #f5f5f5', color: row.score === null ? '#888' : '#16a085' }}>
                    {row.score === null ? 'Not completed yet' : 'Completed'}
                  </td>
                </tr>
              ))}
              {scoredRows.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ paddingTop: 12, color: '#777' }}>No published quizzes available.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
