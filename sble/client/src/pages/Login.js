import React, { useState } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useKeycloak } from '../auth/AuthProvider';
import {
  AuthLayout,
  AuthField,
  AuthButton,
  AuthAlert,
  AuthActions,
  AuthFooterLink,
  AuthForm,
  AuthLinkDivider
} from '../components/auth/AuthShell';
import { IconMail, IconLock } from '../components/auth/AuthIcons';
import styles from '../components/auth/AuthLayout.module.css';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { keycloak, initialized, login } = useKeycloak();
  const registered = location.state?.registered;
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (initialized && keycloak.authenticated) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      await login(form.email.trim(), form.password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.userMessage || err.response?.data?.error || 'Invalid email or password. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to access your courses, live classes, and academic resources."
    >
      <AuthForm onSubmit={handleSubmit} loading={submitting} aria-label="Sign in">
        {registered ? (
          <AuthAlert type="success" title="Account created">
            Your registration is complete. Sign in with your email and password.
          </AuthAlert>
        ) : null}
        <AuthField
          id="login-email"
          label="Email address"
          type="email"
          icon={IconMail}
          autoComplete="email"
          placeholder="you@university.edu"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
          disabled={submitting}
        />

        <AuthField
          id="login-password"
          label="Password"
          type="password"
          icon={IconLock}
          autoComplete="current-password"
          placeholder="Enter your password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
          disabled={submitting}
        />

        {error ? <AuthAlert type="error">{error}</AuthAlert> : null}

        <AuthButton loading={submitting} disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </AuthButton>

        <AuthActions>
          <AuthFooterLink to="/forgot-password" variant="secondary">
            Forgot password?
          </AuthFooterLink>
          <AuthLinkDivider />
          <AuthFooterLink to="/register">
            Create account
          </AuthFooterLink>
        </AuthActions>
      </AuthForm>

      <div className={styles.divider} role="presentation" />
      <p className={styles.note}>
        <strong>Students and lecturers</strong>
        {' '}
        can register for an account. Admin access is managed by your institution.
      </p>
    </AuthLayout>
  );
}
