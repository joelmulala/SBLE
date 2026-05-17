import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
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
  AuthForm,
  AuthLinkDivider
} from '../components/auth/AuthShell';
import { IconMail } from '../components/auth/AuthIcons';
import styles from '../components/auth/AuthLayout.module.css';

const GENERIC_SUCCESS = 'If an account exists for this email, a secure reset link has been sent. Check your inbox and spam folder.';

export default function ForgotPassword() {
  const { keycloak, initialized } = useKeycloak();
  const [email, setEmail] = useState('');
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
    setSubmitting(true);

    try {
      const { data } = await api.post('/auth/forgot-password', { email: email.trim() });
      setSuccessMessage(data?.message || GENERIC_SUCCESS);
      setSuccess(true);
      setEmail('');
    } catch (err) {
      if (err.response?.status === 429) {
        setError(err.userMessage || 'Too many attempts. Please wait and try again.');
      } else if (err.response?.status === 400) {
        setError(err.userMessage || 'Enter a valid email address.');
      } else {
        setSuccessMessage(GENERIC_SUCCESS);
        setSuccess(true);
        setEmail('');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter the email linked to your SBLE account. We will send a secure, one-time reset link."
      visualCaption={(
        <>
          <p>Secure account recovery</p>
          <span>Reset links expire quickly to protect your academic workspace.</span>
        </>
      )}
    >
      {success ? (
        <div className={styles.form}>
          <AuthSuccessPanel title="Check your email" variant="email">
            {successMessage}
          </AuthSuccessPanel>
          <AuthAlert type="info" title="What happens next?">
            Open the link in your email on this device. The link works once and expires after a short period for your security.
          </AuthAlert>
          <AuthActions>
            <AuthFooterLink to="/login">Back to sign in</AuthFooterLink>
            <AuthLinkDivider />
            <AuthFooterLink to="/register" variant="secondary">
              Create account
            </AuthFooterLink>
          </AuthActions>
        </div>
      ) : (
        <AuthForm onSubmit={handleSubmit} loading={submitting} aria-label="Forgot password">
          <AuthField
            id="forgot-email"
            label="Email address"
            type="email"
            icon={IconMail}
            autoComplete="email"
            placeholder="you@university.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={submitting}
          />

          {error ? <AuthAlert type="error">{error}</AuthAlert> : null}

          {submitting && !error ? (
            <AuthAlert type="info" title="Sending reset link">
              Please wait while we process your request securely…
            </AuthAlert>
          ) : null}

          <AuthButton loading={submitting} disabled={submitting}>
            {submitting ? 'Sending reset link…' : 'Send reset link'}
          </AuthButton>

          <AuthActions>
            <AuthFooterLink to="/login" variant="secondary">
              Back to sign in
            </AuthFooterLink>
            <AuthLinkDivider />
            <AuthFooterLink to="/register">
              Create account
            </AuthFooterLink>
          </AuthActions>
        </AuthForm>
      )}
    </AuthLayout>
  );
}
