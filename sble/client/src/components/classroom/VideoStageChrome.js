import React from 'react';
import styles from './VideoStageChrome.module.css';

function IconExpand() {
  return (
    <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M9 3H4v5M15 3h5v5M4 15v5h5M20 15v5h-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconShrink() {
  return (
    <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M4 9V4h5M15 4h5v5M4 15v5h5M20 15h-5v5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Minimal top-right controls on the live video well (classroom fullscreen + optional presentation expand).
 */
export default function VideoStageChrome({
  onClassroomFullscreen,
  showPresentationExpand = false,
  presentationFsActive = false,
  onPresentationFullscreen
}) {
  return (
    <div className={styles.chrome}>
      {showPresentationExpand ? (
        <button
          type="button"
          className={[styles.btn, presentationFsActive && styles.btnActive].filter(Boolean).join(' ')}
          onClick={onPresentationFullscreen}
          title={presentationFsActive ? 'Exit expanded slides' : 'Expand shared content'}
          aria-pressed={presentationFsActive}
          aria-label={presentationFsActive ? 'Exit expanded slides' : 'Expand shared content'}
        >
          {presentationFsActive ? <IconShrink /> : <IconExpand />}
        </button>
      ) : null}
      <button
        type="button"
        className={styles.btn}
        onClick={onClassroomFullscreen}
        title="Fullscreen classroom"
        aria-label="Fullscreen classroom"
      >
        <IconExpand />
      </button>
    </div>
  );
}
