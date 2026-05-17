import React from 'react';
import styles from './DashboardHeroIllustration.module.css';

/**
 * Minimal university dashboard illustration — calm academic vector style.
 */
export default function DashboardHeroIllustration() {
  return (
    <svg
      className={styles.illustration}
      viewBox="0 0 320 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-hidden
    >
      <rect x="40" y="120" width="240" height="12" rx="6" fill="#e2e8f0" />
      <rect x="56" y="48" width="120" height="76" rx="8" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="2" />
      <rect x="64" y="58" width="48" height="6" rx="3" fill="#94a3b8" opacity="0.5" />
      <rect x="64" y="70" width="88" height="4" rx="2" fill="#cbd5e1" />
      <rect x="64" y="80" width="72" height="4" rx="2" fill="#cbd5e1" opacity="0.7" />
      <rect x="64" y="90" width="56" height="4" rx="2" fill="#cbd5e1" opacity="0.5" />
      <circle cx="200" cy="72" r="36" fill="#eef2ff" />
      <path d="M188 72h24M188 84h16" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
      <rect x="196" y="130" width="72" height="48" rx="8" fill="#fff" stroke="#e2e8f0" strokeWidth="1.5" />
      <path d="M208 148h48M208 160h32" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
      <circle cx="88" cy="36" r="20" fill="#ecfdf5" opacity="0.8" />
      <circle cx="248" cy="40" r="14" fill="#fff7ed" opacity="0.9" />
    </svg>
  );
}
