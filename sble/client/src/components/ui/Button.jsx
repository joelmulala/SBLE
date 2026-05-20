import React from 'react';
import { Link } from 'react-router-dom';
import s from './system.module.css';

const VARIANT = {
  default: '',
  primary: s.btnPrimary,
  danger: s.btnDanger,
  ghost: s.btnGhost
};

export default function Button({
  variant = 'default',
  className = '',
  type = 'button',
  to,
  children,
  ...rest
}) {
  const cls = [s.btn, VARIANT[variant] || '', className].filter(Boolean).join(' ');

  if (to) {
    return (
      <Link to={to} className={cls} {...rest}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} className={cls} {...rest}>
      {children}
    </button>
  );
}
