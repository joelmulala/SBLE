import React from 'react';
import styles from './RaisedHandsCue.module.css';

/**
 * Subtle lecturer cue when students raise hands — opens people panel on click.
 */
export default function RaisedHandsCue({ count = 0, names = [], onOpenPeople }) {
  if (!count) return null;

  const preview = names.slice(0, 2).join(', ');
  const more = count > 2 ? ` +${count - 2}` : '';

  return (
    <button
      type="button"
      className={styles.cue}
      onClick={onOpenPeople}
      aria-label={`${count} raised hand${count === 1 ? '' : 's'}. Open people panel`}
    >
      <span className={styles.icon} aria-hidden>🤚</span>
      <span className={styles.text}>
        {count} raised
        {preview ? <span className={styles.names}> · {preview}{more}</span> : null}
      </span>
    </button>
  );
}
