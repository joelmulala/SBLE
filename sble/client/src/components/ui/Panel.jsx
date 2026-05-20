import React from 'react';
import s from './system.module.css';

export default function Panel({
  title,
  lead,
  children,
  flush = false,
  headerExtra = null,
  className = ''
}) {
  return (
    <section className={`${s.panel} ${className}`.trim()}>
      {title || lead || headerExtra ? (
        <div className={s.panelHeader}>
          {title ? <h2 className={s.panelTitle}>{title}</h2> : null}
          {lead ? <p className={s.panelLead}>{lead}</p> : null}
          {headerExtra}
        </div>
      ) : null}
      <div className={flush ? `${s.panelBody} ${s.panelBodyFlush}` : s.panelBody}>
        {children}
      </div>
    </section>
  );
}
