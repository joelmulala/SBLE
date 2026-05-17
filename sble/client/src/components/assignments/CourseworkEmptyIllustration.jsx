import React from 'react';
import s from './Assignments.module.css';

/** Minimal “student coursework” vector for empty assignment states */
export default function CourseworkEmptyIllustration() {
  return (
    <svg
      className={s.emptyIllustration}
      viewBox="0 0 200 140"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-hidden
    >
      <rect x="24" y="100" width="152" height="8" rx="4" fill="#e2e8f0" />
      <rect x="40" y="28" width="88" height="64" rx="6" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1.5" />
      <rect x="48" y="38" width="40" height="5" rx="2.5" fill="#cbd5e1" />
      <rect x="48" y="48" width="64" height="3" rx="1.5" fill="#e2e8f0" />
      <rect x="48" y="56" width="52" height="3" rx="1.5" fill="#e2e8f0" opacity="0.8" />
      <rect x="48" y="64" width="44" height="3" rx="1.5" fill="#e2e8f0" opacity="0.6" />
      <path d="M136 44l20 12-20 12V44z" fill="#eef2ff" stroke="#c7d2fe" strokeWidth="1.5" />
      <circle cx="100" cy="22" r="12" fill="#ecfdf5" />
    </svg>
  );
}
