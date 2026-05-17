import React from 'react';
import { Link } from 'react-router-dom';
import s from './Productivity.module.css';

export default function WorkspaceAwareness({ items, loading }) {
  if (loading) return null;
  const highlights = (items || []).slice(0, 5);
  if (!highlights.length) return null;

  return (
    <ul className={s.awarenessList} aria-label="Recent academic updates">
      {highlights.map((item) => (
        <li key={item.id} className={s.awarenessItem}>
          <span className={s.awarenessDot} aria-hidden />
          <span>
            {item.href ? (
              <Link to={item.href}>{item.title}</Link>
            ) : (
              <strong style={{ color: 'var(--color-text)' }}>{item.title}</strong>
            )}
            {item.subtitle ? ` — ${item.subtitle}` : null}
          </span>
        </li>
      ))}
    </ul>
  );
}
