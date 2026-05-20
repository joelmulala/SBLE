import React from 'react';
import s from './system.module.css';

/**
 * Page wrapper — Layout owns title/breadcrumbs; shell provides spacing + optional lead only.
 */
export default function WorkspacePageShell({ lead = null, children, className = '' }) {
  return (
    <div className={`${s.page} ${className}`.trim()}>
      {lead ? <p className={s.lead}>{lead}</p> : null}
      {children}
    </div>
  );
}
