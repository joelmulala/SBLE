import React from 'react';
import styles from './PresentationRequestQueue.module.css';

/**
 * @param {{
 *   requests: Array<{ id: string, kind: string, name?: string, actor: string }>,
 *   onDecision: (requestId: string, decision: 'approve'|'reject') => void,
 *   disabled?: boolean
 * }} props
 */
export default function PresentationRequestQueue({ requests, onDecision, disabled = false }) {
  if (!requests.length) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyTitle}>Requests</p>
        <p className={styles.emptyText}>No pending presentation or speaking requests.</p>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <p className={styles.title}>Pending requests</p>
      <ul className={styles.list}>
        {requests.map((r) => (
          <li key={r.id} className={styles.row}>
            <div className={styles.meta}>
              <span className={styles.name}>{r.name || r.actor}</span>
              <span className={styles.kind}>{r.kind === 'presentation' ? 'Presentation' : 'Speaking'}</span>
            </div>
            <div className={styles.actions}>
              <button type="button" className={styles.approve} disabled={disabled} onClick={() => onDecision(r.id, 'approve')}>
                Approve
              </button>
              <button type="button" className={styles.reject} disabled={disabled} onClick={() => onDecision(r.id, 'reject')}>
                Decline
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
