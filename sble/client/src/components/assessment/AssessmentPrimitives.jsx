import React from 'react';
import { Link } from 'react-router-dom';
import s from './AssessmentPrimitives.module.css';

export function AssessmentShell({ children, wide = false }) {
  return (
    <div className="app-page">
      <div className={`app-container app-stack ${s.stack} ${wide ? s.stackWide : ''}`}>
        {children}
      </div>
    </div>
  );
}

export function AssessmentPageHeader({ kicker, title, lead, toolbar }) {
  return (
    <header className={s.pageHeader}>
      {kicker ? <p className={s.kicker}>{kicker}</p> : null}
      <div className={s.pageHeaderRow}>
        <div>
          <h1 className={s.title}>{title}</h1>
          {lead ? <p className={s.lead}>{lead}</p> : null}
        </div>
        {toolbar ? <div className={s.headerToolbar}>{toolbar}</div> : null}
      </div>
    </header>
  );
}

export function AssessmentCard({ as: Comp = 'section', children, muted = false, className = '' }) {
  return <Comp className={`${s.card} ${muted ? s.cardMuted : ''} ${className}`.trim()}>{children}</Comp>;
}

export function AssessmentSectionTitle({ children, action }) {
  return (
    <div className={s.sectionHead}>
      <h2 className={s.sectionTitle}>{children}</h2>
      {action || null}
    </div>
  );
}

const BADGE_CLASS = {
  neutral: s.badgeNeutral,
  info: s.badgeInfo,
  success: s.badgeSuccess,
  warning: s.badgeWarning,
  danger: s.badgeDanger
};

export function StatusBadge({ variant = 'neutral', children }) {
  return <span className={BADGE_CLASS[variant] || s.badgeNeutral}>{children}</span>;
}

export function AssessmentMeta({ children, strong = false }) {
  return <p className={strong ? s.metaStrong : s.meta}>{children}</p>;
}

export function AssessmentToolbar({ children }) {
  return <div className={s.toolbar}>{children}</div>;
}

export function AssessmentDivider() {
  return <div className={s.divider} role="presentation" />;
}

export function AssessmentAlert({ type = 'error', children }) {
  const cls = type === 'success' ? s.alertSuccess : type === 'warn' ? s.alertWarn : s.alertError;
  return <div className={cls}>{children}</div>;
}

export function AssessmentEmpty({ children }) {
  return <div className={s.empty}>{children}</div>;
}

export function BtnPrimary({ className = '', type = 'button', ...rest }) {
  return <button type={type} className={`${s.btnPrimary} ${className}`.trim()} {...rest} />;
}

export function BtnSecondary({ className = '', type = 'button', ...rest }) {
  return <button type={type} className={`${s.btnSecondary} ${className}`.trim()} {...rest} />;
}

export function BtnAccent({ className = '', type = 'button', ...rest }) {
  return <button type={type} className={`${s.btnAccent} ${className}`.trim()} {...rest} />;
}

export function BtnDanger({ className = '', type = 'button', ...rest }) {
  return <button type={type} className={`${s.btnDanger} ${className}`.trim()} {...rest} />;
}

export function LinkPrimary({ className = '', children, ...rest }) {
  return (
    <Link className={`${s.navLinkPrimary} ${className}`.trim()} {...rest}>
      {children}
    </Link>
  );
}

export function LinkSecondary({ className = '', children, ...rest }) {
  return (
    <Link className={`${s.navLinkSecondary} ${className}`.trim()} {...rest}>
      {children}
    </Link>
  );
}

export function SelectInput({ className = '', ...rest }) {
  return <select className={`${s.select} ${className}`.trim()} {...rest} />;
}

export function Field({ label, children }) {
  return (
    <label className={s.field}>
      {label}
      {children}
    </label>
  );
}

export function TextInput(props) {
  return <input className={s.input} {...props} />;
}

export function TextArea(props) {
  return <textarea className={s.textarea} {...props} />;
}

export function AssessmentList({ children }) {
  return <ul className={s.list}>{children}</ul>;
}

export function QueueItem({ children }) {
  return <div className={s.queueItem}>{children}</div>;
}

export function GradingForm({ children }) {
  return <div className={s.gradingForm}>{children}</div>;
}

export function CardTitleRow({ title, aside }) {
  return (
    <div className={s.cardTitleRow}>
      <h3 className={s.cardTitle}>{title}</h3>
      {aside || null}
    </div>
  );
}

export function StatsRow({ children }) {
  return <div className={s.statsRow}>{children}</div>;
}

export function Stat({ label, value }) {
  return (
    <span className={s.stat}>
      {label}: <strong>{value}</strong>
    </span>
  );
}
