import React from 'react';
import styles from './EmbeddedRoomPanel.module.css';

/**
 * Floating in-room panel (chat, people, notes) — fullscreen-safe overlay inside the video shell.
 */
export default function EmbeddedRoomPanel({
  title,
  open,
  onClose,
  stack = 'top',
  children
}) {
  if (!open) return null;

  return (
    <div
      className={[styles.panel, stack === 'bottom' ? styles.panelBottom : styles.panelTop].join(' ')}
      role="dialog"
      aria-label={title}
    >
      <header className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
        <button type="button" className={styles.close} onClick={onClose} aria-label={`Close ${title}`}>
          ×
        </button>
      </header>
      <div className={styles.body}>{children}</div>
    </div>
  );
}
