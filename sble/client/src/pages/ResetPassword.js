import React, { useMemo, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useKeycloak } from '../auth/AuthProvider';
import api from '../config/api';
import {
  AuthLayout,
  AuthField,
  AuthButton,
  AuthAlert,
  AuthSuccessPanel,
  AuthActions,
  AuthFooterLink,
  AuthForm
} from '../components/auth/AuthShell';
import { IconLock } from '../components/auth/AuthIcons';
import styles from '../components/auth/AuthLayout.module.css';

const validatePassword = (password) => {
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (!/[a-z]/.test(password)) return 'Include a lowercase letter';
  if (!/[A-Z]/.test(password)) return 'Include an uppercase letter';
  if (!/[0-9]/.test(password)) return 'Include a number';
  return '';
};

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { keycloak, initialized } = useKeycloak();
  const token = useMemo(() => searchParams.get('token') || '', [searchParams]);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (initialized && keycloak.authenticated) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!token) {
      setError('This reset link is invalid. Please request a new password reset.');
      return;
    }

    const strengthError = validatePassword(password);
    if (strengthError) {
      setError(strengthError);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await api.post('/auth/reset-password', { token, password });
      setSuccessMessage(data?.message || 'Your password has been updated. You can now sign in with your new credentials.');
      setSuccess(true);
      setTimeout(() => navigate('/login', { replace: true }), 3200);
    } catch (err) {
      setError(err.userMessage || 'Unable to reset password. Please request a new link.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <AuthLayout
        title="Invalid reset link"
        subtitle="This password reset link is missing or incomplete."
        visualCaption={(
          <>
            <p>Protected recovery</p>
            <span>Request a new link if yours has expired or was already used.</span>
          </>
        )}
      >
        <AuthAlert type="error" title="Link not valid">
          Please use the full link from your email, or request a new password reset.
        </AuthAlert>
        <AuthActions>
          <AuthFooterLink to="/forgot-password">Request a new reset link</AuthFooterLink>
          <AuthFooterLink to="/login" variant="secondary">Back to sign in</AuthFooterLink>
        </AuthActions>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Choose a new password"
      subtitle="Create a strong password for your SBLE account. This link expires soon and works only once."
      visualCaption={(
        <>
          <p>Account security</p>
          <span>Your new credentials will be active immediately after confirmation.</span>
        </>
      )}
    >
      {success ? (
        <div className={styles.form}>
          <AuthSuccessPanel title="Password updated">
            {successMessage}
          </AuthSuccessPanel>
          <AuthAlert type="info">
            Redirecting you to sign in…
          </AuthAlert>
          <AuthActions>
            <AuthFooterLink to="/login">Sign in now</AuthFooterLink>
          </AuthActions>
        </div>
      ) : (
        <AuthForm onSubmit={handleSubmit} loading={submitting} aria-label="Reset password">
          <AuthField
            id="reset-password"
            label="New password"
            type="password"
            icon={IconLock}
            autoComplete="new-password"
            placeholder="Create a strong password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={submitting}
          />

          <AuthField
            id="reset-confirm"
            label="Confirm password"
            type="password"
            icon={IconLock}
            autoComplete="new-password"
            placeholder="Re-enter your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            disabled={submitting}
          />

          <p className={styles.note}>
            Use at least 8 characters with uppercase, lowercase, and a number.
          </p>

          {error ? <AuthAlert type="error">{error}</AuthAlert> : null}

          {submitting && !error ? (
            <AuthAlert type="info" title="Updating password">
              Securing your account…
            </AuthAlert>
          ) : null}

          <AuthButton loading={submitting} disabled={submitting}>
            {submitting ? 'Updating password…' : 'Update password'}
          </AuthButton>

          <AuthActions>
            <AuthFooterLink to="/login" variant="secondary">
              Back to sign in
            </AuthFooterLink>
          </AuthActions>
        </AuthForm>
      )}
    </AuthLayout>
  );
}
