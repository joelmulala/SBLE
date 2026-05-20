import React from 'react';
import s from './system.module.css';

const VARIANT = {
  neutral: s.pillNeutral,
  admin: s.pillAdmin,
  lecturer: s.pillLecturer,
  student: s.pillStudent,
  active: s.pillActive,
  inactive: s.pillInactive,
  info: s.pillInfo
};

export default function StatusPill({ variant = 'neutral', children }) {
  return (
    <span className={`${s.pill} ${VARIANT[variant] || s.pillNeutral}`}>
      {children}
    </span>
  );
}

export function rolePill(role) {
  const map = { admin: 'admin', lecturer: 'lecturer', student: 'student' };
  return map[role] || 'neutral';
}
