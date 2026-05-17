import React from 'react';
import styles from './ClassroomEmptyIllustration.module.css';

/** Modern online-classroom vector for waiting / empty / disconnected states */
export default function ClassroomEmptyIllustration() {
  return (
    <svg
      className={styles.art}
      viewBox="0 0 200 140"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <ellipse cx="100" cy="128" rx="72" ry="6" fill="#1e293b" opacity="0.35" />
      <rect x="28" y="24" width="144" height="88" rx="10" fill="#0f172a" stroke="#334155" strokeWidth="1.5" />
      <rect x="36" y="32" width="128" height="72" rx="6" fill="#1e293b" />
      <circle cx="72" cy="58" r="14" fill="#334155" />
      <path d="M58 78c4-8 12-12 14-12s10 4 14 12" stroke="#475569" strokeWidth="2" strokeLinecap="round" />
      <rect x="98" y="44" width="52" height="6" rx="3" fill="#334155" />
      <rect x="98" y="56" width="40" height="5" rx="2.5" fill="#475569" opacity="0.7" />
      <rect x="98" y="68" width="44" height="5" rx="2.5" fill="#475569" opacity="0.5" />
      <path
        d="M148 88l12 8 12-8"
        stroke="#2dd4bf"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.85"
      />
      <circle cx="164" cy="36" r="10" fill="none" stroke="#2dd4bf" strokeWidth="1.5" opacity="0.6" />
      <path d="M164 30v12M158 36h12" stroke="#2dd4bf" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}
