import React from 'react';

const iconProps = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true
};

export function IconMail() {
  return (
    <svg {...iconProps}>
      <path d="M4 6h16v12H4z" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  );
}

export function IconLock() {
  return (
    <svg {...iconProps}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export function IconEye({ open = false }) {
  if (open) {
    return (
      <svg {...iconProps}>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  return (
    <svg {...iconProps}>
      <path d="M3 3l18 18" />
      <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
      <path d="M9.9 5.1A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a18.2 18.2 0 0 1-4.1 5.2" />
      <path d="M6.1 6.1C3.5 7.8 2 12 2 12s3.5 7 10 7a10.4 10.4 0 0 0 2.2-.3" />
    </svg>
  );
}

export function IconSpinner() {
  return (
    <svg className="auth-spinner" width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function IconCheckCircle() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 2.5 2.5L16 9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconShield() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M12 3 4 6v6c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V6l-8-3z" strokeLinejoin="round" />
    </svg>
  );
}

export function IconSend() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="m22 2-7 20-4-9-9-4 20-7z" strokeLinejoin="round" />
    </svg>
  );
}

export function IconUser() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="8" r="4" />
      <path d="M5 20c0-4 3.5-6 7-6s7 2 7 6" />
    </svg>
  );
}

export function IconStudent() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M12 3 2 8l10 5 10-5-10-5Z" strokeLinejoin="round" />
      <path d="M6 11v5c0 2 2.5 4 6 4s6-2 6-4v-5" strokeLinejoin="round" />
    </svg>
  );
}

export function IconLecturer() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M4 19V5h16v14" strokeLinejoin="round" />
      <path d="M8 9h8M8 13h5" strokeLinecap="round" />
      <path d="M4 19h16" strokeLinecap="round" />
    </svg>
  );
}

export function IconIdBadge() {
  return (
    <svg {...iconProps}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="11" r="2" />
      <path d="M14 10h4M14 14h4" strokeLinecap="round" />
    </svg>
  );
}

export function IconBook() {
  return (
    <svg {...iconProps}>
      <path d="M5 4h9a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Z" />
      <path d="M8 4v13a3 3 0 0 0 3 3" />
    </svg>
  );
}

export function IconBuilding() {
  return (
    <svg {...iconProps}>
      <path d="M4 20V9l8-4 8 4v11" strokeLinejoin="round" />
      <path d="M9 20v-5h6v5M9 12h.01M15 12h.01" strokeLinecap="round" />
    </svg>
  );
}

export function IconCamera() {
  return (
    <svg {...iconProps}>
      <path d="M4 8h3l2-2h6l2 2h3v11H4V8Z" strokeLinejoin="round" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  );
}
