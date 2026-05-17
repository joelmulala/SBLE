import React from 'react';
import styles from './AuthLayout.module.css';

/**
 * Modern academic vector — student studying on a laptop (approved art direction).
 */
export default function AuthIllustration() {
  return (
    <svg
      className={styles.illustration}
      viewBox="0 0 560 440"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Student studying on a laptop in a modern learning environment"
    >
      <defs>
        <linearGradient id="authBgOrb" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#dbeafe" stopOpacity="0.9" />
          <stop offset="1" stopColor="#e0e7ff" stopOpacity="0.4" />
        </linearGradient>
        <linearGradient id="authDesk" x1="60" y1="310" x2="500" y2="360" gradientUnits="userSpaceOnUse">
          <stop stopColor="#e8eef6" />
          <stop offset="1" stopColor="#cbd5e1" />
        </linearGradient>
        <linearGradient id="authScreen" x1="175" y1="195" x2="355" y2="295" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f8fafc" />
          <stop offset="1" stopColor="#dbe4ff" />
        </linearGradient>
        <linearGradient id="authShirt" x1="255" y1="175" x2="365" y2="310" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3b5bdb" />
          <stop offset="1" stopColor="#5c7cfa" />
        </linearGradient>
        <linearGradient id="authHair" x1="300" y1="95" x2="340" y2="155" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1e293b" />
          <stop offset="1" stopColor="#334155" />
        </linearGradient>
      </defs>

      <circle cx="95" cy="88" r="52" fill="url(#authBgOrb)" />
      <circle cx="455" cy="105" r="64" fill="#d1fae5" opacity="0.55" />
      <circle cx="480" cy="320" r="40" fill="#dbeafe" opacity="0.45" />

      <ellipse cx="280" cy="408" rx="210" ry="20" fill="#94a3b8" opacity="0.2" />

      <rect x="72" y="302" width="416" height="16" rx="8" fill="url(#authDesk)" />
      <rect x="72" y="314" width="416" height="6" rx="2" fill="#94a3b8" opacity="0.25" />

      <rect x="118" y="248" width="228" height="62" rx="8" fill="#64748b" opacity="0.2" />
      <rect x="126" y="256" width="212" height="46" rx="5" fill="url(#authScreen)" stroke="#c7d2fe" strokeWidth="1.5" />
      <rect x="140" y="268" width="72" height="5" rx="2.5" fill="#3b5bdb" opacity="0.65" />
      <rect x="140" y="280" width="120" height="4" rx="2" fill="#94a3b8" opacity="0.35" />
      <rect x="140" y="290" width="90" height="4" rx="2" fill="#94a3b8" opacity="0.25" />
      <circle cx="318" cy="279" r="6" fill="#10b981" opacity="0.7" />

      <path
        d="M248 308V272c0-48 32-88 72-88s72 40 72 88v36"
        fill="url(#authShirt)"
      />
      <path
        d="M248 308h144v8c0 4-32 8-72 8s-72-4-72-8v-8z"
        fill="#2f4ccb"
        opacity="0.85"
      />

      <circle cx="320" cy="138" r="46" fill="#f5d0b8" />
      <path
        d="M274 138c0-28 20-50 46-50s46 22 46 50c0 8-2 14-6 20"
        fill="url(#authHair)"
      />
      <ellipse cx="320" cy="168" rx="42" ry="10" fill="url(#authHair)" />

      <path d="M298 132c4 2 8 3 12 3" stroke="#2c3e5c" strokeWidth="2" strokeLinecap="round" opacity="0.35" />
      <path d="M330 132c4 2 8 3 12 3" stroke="#2c3e5c" strokeWidth="2" strokeLinecap="round" opacity="0.35" />

      <rect x="338" y="278" width="130" height="10" rx="5" fill="#64748b" opacity="0.35" />
      <ellipse cx="405" cy="283" rx="18" ry="8" fill="#f5d0b8" />

      <rect x="408" y="188" width="56" height="76" rx="10" fill="#fff" stroke="#e2e8f0" strokeWidth="2" />
      <path d="M420 208h32M420 222h24M420 236h28" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="436" cy="248" r="8" fill="#dbeafe" />
      <path d="M432 248l3 3 5-6" stroke="#3b5bdb" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />

      <path
        d="M88 220c20-30 48-48 80-48"
        stroke="#93c5fd"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.5"
      />
      <path
        d="M472 240c-18 24-44 38-72 38"
        stroke="#6ee7b7"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.45"
      />
    </svg>
  );
}
