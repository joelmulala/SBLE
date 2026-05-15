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
 * Compact academic reactions: raise hand, understood, agree (mockup-aligned).
 */
export default function ReactionPopover({
  raisedHand = false,
  participationAck = null,
  participationLocked = false,
  onToggleRaiseHand,
  onToggleUnderstood,
  onToggleAgree,
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

  const understoodActive = participationAck === 'understood';
  const agreeActive = participationAck === 'agree';
  const reactionActive = raisedHand || understoodActive || agreeActive;
  const showIndicatorDot = dockLayout && (reactionActive || open);
  const triggerClass = dockLayout
    ? [styles.triggerDock, open && styles.triggerDockOpen, compact && styles.triggerDockCompact].filter(Boolean).join(' ')
    : [styles.trigger, open && styles.triggerOpen, compact && styles.triggerCompact].filter(Boolean).join(' ');

  return (
    <div className={styles.wrap} ref={rootRef}>
      {showIndicatorDot ? <span className={styles.indicatorDot} aria-hidden /> : null}
      {open ? (
        <div className={styles.trayCompact} role="menu" aria-label="Reactions">
          <button
            type="button"
            className={[styles.emojiBtn, raisedHand && styles.emojiBtnActive].filter(Boolean).join(' ')}
            role="menuitem"
            disabled={participationLocked}
            title={raisedHand ? 'Lower hand' : 'Raise hand'}
            aria-label={raisedHand ? 'Lower hand' : 'Raise hand'}
            aria-pressed={raisedHand}
            onClick={() => onToggleRaiseHand?.()}
          >
            🤚
          </button>
          <button
            type="button"
            className={[styles.emojiBtn, understoodActive && styles.emojiBtnActive].filter(Boolean).join(' ')}
            role="menuitem"
            disabled={participationLocked}
            title={understoodActive ? 'Remove understood' : 'Understood'}
            aria-label={understoodActive ? 'Remove understood' : 'Understood'}
            aria-pressed={understoodActive}
            onClick={() => onToggleUnderstood?.()}
          >
            ✅
          </button>
          <button
            type="button"
            className={[styles.emojiBtn, agreeActive && styles.emojiBtnActive].filter(Boolean).join(' ')}
            role="menuitem"
            disabled={participationLocked}
            title={agreeActive ? 'Remove agree' : 'Agree'}
            aria-label={agreeActive ? 'Remove agree' : 'Agree'}
            aria-pressed={agreeActive}
            onClick={() => onToggleAgree?.()}
          >
            🤝
          </button>
        </div>
      ) : null}
      <button
        type="button"
        className={[triggerClass, reactionActive && styles.triggerDockReactionActive].filter(Boolean).join(' ')}
        aria-expanded={open}
        aria-haspopup="true"
        aria-pressed={reactionActive}
        disabled={participationLocked}
        title="Reactions"
        onClick={() => setOpen((o) => !o)}
      >
        {dockLayout ? (
          <>
            <span className={styles.triggerDockIconRing}>
              <IconSmile />
            </span>
            <span className={styles.triggerDockLabel}>React</span>
          </>
        ) : (
          <>
            <IconSmile />
            <span className={styles.triggerLabel}>React</span>
          </>
        )}
      </button>
    </div>
  );
}
