import React from 'react';
import styles from './SessionSummaryModal.module.css';

function formatDuration(sec) {
  if (sec == null || sec < 0) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return `${h}h ${mm}m`;
  }
  return `${m}m ${s}s`;
}

function statusLabel(code) {
  const map = {
    present: 'Present',
    late: 'Late',
    left_early: 'Left early',
    partial_attendance: 'Partial attendance'
  };
  return map[code] || code || '—';
}

/**
 * @param {{ summary: object | null, onDismiss: () => void }} props
 */
export default function SessionSummaryModal({ summary, onDismiss }) {
  const ov = summary?.participationOverview || {};
  const rows = Array.isArray(summary?.attendance) ? summary.attendance : [];

  return (
    <div className={styles.scrim} role="dialog" aria-modal="true" aria-labelledby="session-summary-title">
      <div className={styles.card}>
        <h2 id="session-summary-title" className={styles.title}>Class session summary</h2>
        <p className={styles.lead}>
          Attendance and participation snapshot for this live class (institutional record).
        </p>

        {!summary ? (
          <p className={styles.muted}>Summary could not be loaded. The room may have closed before tracking started.</p>
        ) : (
          <>
            <ul className={styles.stats}>
              <li><span>Participants</span><strong>{summary.totalParticipants ?? rows.length}</strong></li>
              <li><span>Raised-hand activity</span><strong>{ov.withRaisedHandSamples ?? 0}</strong></li>
              <li><span>Question signals</span><strong>{ov.withQuestionSamples ?? 0}</strong></li>
              <li><span>Screen sharing</span><strong>{ov.distinctPresenters ?? 0}</strong></li>
              <li><span>Speaking samples</span><strong>{ov.withSpeakingSamples ?? 0}</strong></li>
            </ul>

            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Role</th>
                    <th>Time in class</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.userId}>
                      <td>{r.name || r.userId}</td>
                      <td>{r.role}</td>
                      <td>{formatDuration(r.cumulativeSeconds)}</td>
                      <td>{statusLabel(r.computedStatus)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {summary.rules ? (
              <p className={styles.rules}>
                Status rules (placeholders): late after {summary.rules.lateAfterMinutes} min;
                partial below {Math.round((summary.rules.partialAttendanceBelowRatio || 0) * 100)}% of session length;
                left early if exited more than {summary.rules.leftEarlyIfLeftMinutesBeforeEnd} min before end.
              </p>
            ) : null}
          </>
        )}

        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={onDismiss}>
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
