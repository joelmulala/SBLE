import React from 'react';
import s from './system.module.css';

export default function KpiStatGrid({ children, label = 'Summary metrics' }) {
  return (
    <section className={s.kpiGrid} aria-label={label}>
      {children}
    </section>
  );
}
