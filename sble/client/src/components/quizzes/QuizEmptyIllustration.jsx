import React from 'react';
import s from './AssessmentQuiz.module.css';

/** Minimal “online quiz” vector for empty assessment states */
export default function QuizEmptyIllustration() {
  return (
    <svg
      className={s.emptyIllustration}
      viewBox="0 0 180 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect x="20" y="88" width="140" height="8" rx="4" fill="#e2e8f0" />
      <rect x="36" y="20" width="72" height="56" rx="6" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1.5" />
      <circle cx="108" cy="36" r="18" fill="none" stroke="#94a3b8" strokeWidth="2" />
      <path d="M108 28v16M100 36h16" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
      <rect x="44" y="32" width="40" height="4" rx="2" fill="#cbd5e1" />
      <rect x="44" y="42" width="32" height="4" rx="2" fill="#e2e8f0" />
      <rect x="44" y="52" width="28" height="4" rx="2" fill="#e2e8f0" opacity="0.7" />
    </svg>
  );
}
