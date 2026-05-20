import React from 'react';
import s from './system.module.css';

export function SearchInput({ className = '', ...rest }) {
  return <input type="search" className={`${s.searchInput} ${className}`.trim()} {...rest} />;
}

export function FilterSelect({ className = '', children, ...rest }) {
  return (
    <select className={`${s.filterSelect} ${className}`.trim()} {...rest}>
      {children}
    </select>
  );
}

export default function FilterBar({ children, className = '' }) {
  return <div className={`${s.filterBar} ${className}`.trim()}>{children}</div>;
}
