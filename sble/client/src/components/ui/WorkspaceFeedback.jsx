import React from 'react';
import s from './WorkspaceFeedback.module.css';

export function PageGate({ variant = 'loading', title, message }) {
  const copy = {
    loading: {
      title: title || 'Loading workspace',
      message: message || 'Preparing your SBLE session…'
    },
    denied: {
      title: title || 'Access restricted',
      message: message || 'You do not have permission to view this area.'
    }
  };
  const { title: t, message: m } = copy[variant] || copy.loading;

  return (
    <div className={s.gate} role="status" aria-live="polite">
      <div className={s.gateCard}>
        <div className={s.spinner} aria-hidden />
        <h1 className={s.gateTitle}>{t}</h1>
        <p className={s.gateLead}>{m}</p>
      </div>
    </div>
  );
}

export function WorkspaceLoading({ label = 'Loading…', centered = false }) {
  return (
    <div
      className={`${s.loading} ${centered ? s.loadingCentered : ''}`.trim()}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className={s.spinner} aria-hidden />
      <span>{label}</span>
    </div>
  );
}

export function WorkspaceSkeleton({ lines = 3 }) {
  const widths = [s.skeletonLineWide, s.skeletonLineMid, s.skeletonLineShort];
  return (
    <div className={s.skeletonGroup} aria-hidden>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className={`${s.skeletonLine} ${widths[i % widths.length]}`} />
      ))}
    </div>
  );
}

export function WorkspaceEmpty({ title, message, action }) {
  return (
    <div className={s.empty} role="status">
      {title ? <h3 className={s.emptyTitle}>{title}</h3> : null}
      <p className={s.emptyMessage}>{message}</p>
      {action ? <div className={s.emptyAction}>{action}</div> : null}
    </div>
  );
}

export function WorkspaceError({ message, onRetry, retryLabel = 'Try again' }) {
  return (
    <div className={s.error} role="alert">
      <span>{message}</span>
      {onRetry ? (
        <button type="button" className={s.retryBtn} onClick={onRetry}>
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}
