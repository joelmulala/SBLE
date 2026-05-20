import React from 'react';
import s from './system.module.css';

/**
 * Enterprise action row: search (left) · filters (center/right) · CTA (far right).
 */
export default function PageActions({ search = null, filters = null, actions = null }) {
  if (!search && !filters && !actions) return null;

  const toolbarClass = `${s.actions}${search ? '' : ` ${s.actionsNoSearch}`}`.trim();

  return (
    <div className={toolbarClass} role="toolbar" aria-label="Page actions">
      {search ? <div className={s.actionsSearch}>{search}</div> : null}
      {filters ? <div className={s.actionsFilters}>{filters}</div> : null}
      {actions ? <div className={s.actionsEnd}>{actions}</div> : null}
    </div>
  );
}
