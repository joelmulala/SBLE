import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import AuthIllustration from './AuthIllustration';
import {
  IconMail,
  IconLock,
  IconEye,
  IconSpinner,
  IconCheckCircle,
  IconShield,
  IconSend
} from './AuthIcons';
import styles from './AuthLayout.module.css';

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
  visualCaption
}) {
  return (
    <div className={styles.shell}>
      <div className={styles.split}>
        <div className={styles.panelForm}>
          <div className={styles.formInner}>
            <header className={styles.brand}>
              <div className={styles.brandMark}>
                <span className={styles.brandLogo} aria-hidden>S</span>
                <div className={styles.brandText}>
                  <p className={styles.brandName}>SBLE</p>
                  <p className={styles.brandEyebrow}>Smart Blended Learning Environment</p>
                </div>
              </div>
              <h1 className={styles.title}>{title}</h1>
              {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
            </header>
            {children}
            {footer}
          </div>
        </div>
        <aside className={styles.panelVisual}>
          <div className={styles.visualGlow} />
          <div className={styles.visualAccent} />
          <AuthIllustration />
          <div className={styles.visualCaption}>
            {visualCaption || (
              <>
                <p>Learn anywhere, teach with confidence.</p>
                <span>Your institutional workspace for blended education.</span>
              </>
            )}
          </div>
        </aside>
      </div>
      <footer className={styles.footer}>
        <span>SBLE</span>
        {' '}
        | All Rights Reserved © 2026
      </footer>
    </div>
  );
}

export function AuthField({
  id,
  label,
  type = 'text',
  icon: Icon,
  value,
  onChange,
  placeholder,
  autoComplete,
  required,
  disabled,
  error
}) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword && showPassword ? 'text' : type;

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <div className={styles.inputWrap}>
        {Icon ? (
          <span className={styles.inputIcon}>
            <Icon />
          </span>
        ) : null}
        <input
          id={id}
          className={`${styles.input} ${isPassword ? styles.inputWithToggle : ''}`}
          type={inputType}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        {isPassword ? (
          <button
            type="button"
            className={styles.togglePassword}
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            tabIndex={-1}
          >
            <IconEye open={showPassword} />
          </button>
        ) : null}
      </div>
      {error ? (
        <span id={`${id}-error`} className={styles.note} style={{ color: 'var(--color-danger)' }}>
          {error}
        </span>
      ) : null}
    </div>
  );
}

export function AuthAlert({ type = 'error', children, title }) {
  const isSuccess = type === 'success';
  const isInfo = type === 'info';
  const className = [
    styles.alert,
    isSuccess ? styles.alertSuccess : isInfo ? styles.alertInfo : styles.alertError
  ].join(' ');

  const Icon = isSuccess ? IconCheckCircle : IconShield;

  return (
    <div role={type === 'error' ? 'alert' : 'status'} className={className}>
      <span className={styles.alertIcon}>
        <Icon />
      </span>
      <div>
        {title ? <strong style={{ display: 'block', marginBottom: '0.25rem' }}>{title}</strong> : null}
        {children}
      </div>
    </div>
  );
}

export function AuthLoadingBar({ active }) {
  if (!active) return null;
  return (
    <div className={styles.loadingBar} role="progressbar" aria-label="Processing">
      <div className={styles.loadingBarFill} />
    </div>
  );
}

export function AuthSuccessPanel({ title, children, variant = 'default' }) {
  const isEmail = variant === 'email';
  return (
    <div className={styles.successPanel} role="status">
      <div className={`${styles.successPanelIcon} ${isEmail ? styles.successPanelIconEmail : ''}`}>
        {isEmail ? <IconSend /> : <IconCheckCircle />}
      </div>
      <h2 className={styles.successPanelTitle}>{title}</h2>
      <p className={styles.successPanelText}>{children}</p>
    </div>
  );
}

export function AuthSelect({
  id,
  label,
  value,
  onChange,
  options,
  disabled,
  required
}) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>{label}</label>
      <div className={styles.selectWrap}>
        <select
          id={id}
          className={styles.select}
          value={value}
          onChange={onChange}
          disabled={disabled}
          required={required}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

export function AuthRoleToggle({ value, onChange, disabled }) {
  return (
    <div className={styles.field}>
      <span className={styles.label}>I am registering as</span>
      <div className={styles.roleToggle} role="group" aria-label="Account type">
        <button
          type="button"
          className={`${styles.roleToggleBtn} ${value === 'student' ? styles.roleToggleBtnActive : ''}`}
          onClick={() => onChange('student')}
          disabled={disabled}
          aria-pressed={value === 'student'}
        >
          Student
        </button>
        <button
          type="button"
          className={`${styles.roleToggleBtn} ${value === 'lecturer' ? styles.roleToggleBtnActive : ''}`}
          onClick={() => onChange('lecturer')}
          disabled={disabled}
          aria-pressed={value === 'lecturer'}
        >
          Lecturer
        </button>
      </div>
    </div>
  );
}

export function AuthForm({ children, onSubmit, loading, className, 'aria-label': ariaLabel }) {
  return (
    <form
      className={[styles.form, className].filter(Boolean).join(' ')}
      onSubmit={onSubmit}
      aria-label={ariaLabel}
    >
      <AuthLoadingBar active={loading} />
      {children}
    </form>
  );
}

export function AuthLinkDivider() {
  return <div className={styles.linkDivider} role="presentation" />;
}

export function AuthButton({ children, disabled, type = 'submit', loading }) {
  return (
    <button type={type} disabled={disabled || loading} className={styles.btnPrimary}>
      {loading ? <IconSpinner /> : null}
      {children}
    </button>
  );
}

export function AuthFooterLink({ to, children, variant = 'tertiary' }) {
  const className = variant === 'secondary' ? styles.linkSecondary : styles.linkTertiary;
  return (
    <Link to={to} className={className}>
      {children}
    </Link>
  );
}

export function AuthActions({ children }) {
  return <div className={styles.actionsStack}>{children}</div>;
}

export function AuthShell(props) {
  return <AuthLayout {...props} />;
}

export function AuthInput(props) {
  return (
    <AuthField
      id={props.id}
      label={props['aria-label'] || props.placeholder || 'Field'}
      type={props.type}
      value={props.value}
      onChange={props.onChange}
      placeholder={props.placeholder}
      autoComplete={props.autoComplete}
      required={props.required}
      disabled={props.disabled}
      icon={props.type === 'email' ? IconMail : props.type === 'password' ? IconLock : null}
    />
  );
}
