import React, { useEffect, useRef, useState } from 'react';
import styles from './ReactionPopover.module.css';

function IconSmile() {
  return (
    <svg className={styles.triggerIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 14s1.2 1.5 4 1.5 4-1.5 4-1.5" strokeLinecap="round" />
      <circle cx="9" cy="10" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="15" cy="10" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * Academic reaction tray (raise hand, acknowledgements). Opens above the trigger.
 * @param {{
 *   participationLocked?: boolean,
 *   role?: 'lecturer' | 'student',
 *   onToggleRaiseHand: () => void,
 *   onAckUnderstood: () => void,
 *   onAckAgree: () => void,
 *   onToggleQuestion?: () => void,
 *   onRequestPresent?: () => void,
 *   onRequestSpeak?: () => void,
 *   onCancelRequest?: () => void,
 *   compact?: boolean,
 *   dockLayout?: boolean
 * }} props
 */
export default function ReactionPopover({
  raisedHand = false,
  hasQuestion = false,
  participationLocked = false,
  role = 'student',
  onToggleRaiseHand,
  onAckUnderstood,
  onAckAgree,
  onToggleQuestion,
  onRequestPresent,
  onRequestSpeak,
  onCancelRequest,
  compact = false,
  dockLayout = false
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      const r = rootRef.current;
      if (r && !r.contains(e.target)) setOpen(false);
    };
    const t = setTimeout(() => document.addEventListener('pointerdown', onDoc, true), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('pointerdown', onDoc, true);
    };
  }, [open]);

  const showStudentLinks = role === 'student' && onRequestPresent && onRequestSpeak && onCancelRequest;
  const showIndicatorDot = dockLayout && (raisedHand || hasQuestion || open);
  const triggerClass = dockLayout
    ? [styles.triggerDock, open && styles.triggerDockOpen, compact && styles.triggerDockCompact].filter(Boolean).join(' ')
    : [styles.trigger, open && styles.triggerOpen, compact && styles.triggerCompact].filter(Boolean).join(' ');

  return (
    <div className={styles.wrap} ref={rootRef}>
      {showIndicatorDot ? <span className={styles.indicatorDot} aria-hidden /> : null}
      <button
        type="button"
        className={triggerClass}
        aria-expanded={open}
        aria-haspopup="true"
        disabled={participationLocked}
        title="Reactions"
        onClick={() => setOpen((o) => !o)}
      >
        {dockLayout ? (
          <>
            <span className={styles.triggerDockIconRing}>
              <IconSmile />
            </span>
            <span className={styles.triggerDockLabel}>Reactions</span>
          </>
        ) : (
          <>
            <IconSmile />
            <span className={styles.triggerLabel}>Reactions</span>
          </>
        )}
      </button>
      {open ? (
        <div className={styles.tray} role="menu">
          <button
            type="button"
            className={[styles.trayBtn, raisedHand && styles.trayBtnActive].filter(Boolean).join(' ')}
            role="menuitem"
            disabled={participationLocked}
            onClick={() => {
              onToggleRaiseHand();
              setOpen(false);
            }}
          >
            <span className={styles.trayGlyph} aria-hidden>🤚</span>
            <span className={styles.trayText}>{raisedHand ? 'Lower hand' : 'Raise hand'}</span>
          </button>
          <button
            type="button"
            className={styles.trayBtn}
            role="menuitem"
            disabled={participationLocked}
            onClick={() => {
              onAckUnderstood();
              setOpen(false);
            }}
          >
            <span className={styles.trayGlyph} aria-hidden>✅</span>
            <span className={styles.trayText}>Understood</span>
          </button>
          <button
            type="button"
            className={styles.trayBtn}
            role="menuitem"
            disabled={participationLocked}
            onClick={() => {
              onAckAgree();
              setOpen(false);
            }}
          >
            <span className={styles.trayGlyph} aria-hidden>🤝</span>
            <span className={styles.trayText}>Agree</span>
          </button>
          {onToggleQuestion ? (
            <button
              type="button"
              className={[styles.trayBtn, styles.trayBtnSubtle, hasQuestion && styles.trayBtnActive].filter(Boolean).join(' ')}
              role="menuitem"
              disabled={participationLocked}
              onClick={() => {
                onToggleQuestion();
                setOpen(false);
              }}
            >
              <span className={styles.trayText}>{hasQuestion ? 'Clear question' : 'I have a question'}</span>
            </button>
          ) : null}
          {showStudentLinks ? (
            <div className={styles.trayDivider} role="presentation" />
          ) : null}
          {showStudentLinks ? (
            <div className={styles.trayStudent}>
              <button
                type="button"
                className={styles.trayLink}
                role="menuitem"
                disabled={participationLocked}
                onClick={() => {
                  onRequestPresent();
                  setOpen(false);
                }}
              >
                Request to present
              </button>
              <button
                type="button"
                className={styles.trayLink}
                role="menuitem"
                disabled={participationLocked}
                onClick={() => {
                  onRequestSpeak();
                  setOpen(false);
                }}
              >
                Request to speak
              </button>
              <button
                type="button"
                className={styles.trayLink}
                role="menuitem"
                onClick={() => {
                  onCancelRequest();
                  setOpen(false);
                }}
              >
                Clear requests
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
