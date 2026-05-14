import React from 'react';
import styles from './ParticipationIndicators.module.css';

/**
 * Compact academic acknowledgement signals (icon-only).
 * @param {{ onAck: (kind: 'understood'|'agree'|'listening') => void, className?: string, disabled?: boolean, compact?: boolean }} props
 */
export default function ParticipationIndicators({ onAck, className = '', disabled = false, compact = false }) {
  const btn = (extra) => [styles.iconBtn, compact && styles.iconBtnCompact, extra].filter(Boolean).join(' ');
  return (
    <div
      className={[styles.group, compact && styles.groupCompact, className].filter(Boolean).join(' ')}
      role="group"
      aria-label="Quick signals"
    >
      <button
        type="button"
        className={btn()}
        disabled={disabled}
        title="Understood"
        aria-label="Understood"
        onClick={() => onAck('understood')}
      >
        <span className={[styles.glyph, compact && styles.glyphCompact].filter(Boolean).join(' ')} aria-hidden>👍</span>
      </button>
      <button
        type="button"
        className={btn()}
        disabled={disabled}
        title="Agree"
        aria-label="Agree"
        onClick={() => onAck('agree')}
      >
        <span className={[styles.agreeMark, compact && styles.agreeMarkCompact].filter(Boolean).join(' ')} aria-hidden>✓</span>
      </button>
      <button
        type="button"
        className={btn()}
        disabled={disabled}
        title="Listening"
        aria-label="Listening"
        onClick={() => onAck('listening')}
      >
        <span className={[styles.glyph, compact && styles.glyphCompact].filter(Boolean).join(' ')} aria-hidden>👂</span>
      </button>
    </div>
  );
}
