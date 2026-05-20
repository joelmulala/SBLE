import React from 'react';
import s from './system.module.css';

export default function StatCard({ label, value, hint }) {
  return (
    <article className={s.statCard}>
      <span className={s.statLabel}>{label}</span>
      <span className={s.statValue}>{value}</span>
      {hint ? <span className={s.statHint}>{hint}</span> : null}
    </article>
  );
}
