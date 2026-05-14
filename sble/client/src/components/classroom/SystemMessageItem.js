import React from 'react';
import styles from './SystemMessageItem.module.css';

/**
 * @param {{ body: string, timeLabel?: string }} props
 */
export default function SystemMessageItem({ body, timeLabel }) {
  return (
    <li className={styles.row} role="status">
      <span className={styles.meta}>{timeLabel}</span>
      <p className={styles.text}>{body}</p>
    </li>
  );
}
